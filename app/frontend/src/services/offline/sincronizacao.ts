import { useAuth } from "../../store/auth";
import { ErroApi } from "../api/client";
import { especiesApi, syncApi } from "../api/endpoints";
import { abrirBanco, aplicarPull, atualizarMeta, contarEspecies, indexedDbDisponivel, lerMeta } from "./banco";

// Orquestração do pull (GET /sync/alteracoes) para o banco local do usuário.
// Nunca lança: falha de rede, 5xx ou navegador sem IndexedDB só deixam o banco
// como estava e voltam como `{ ok: false }`.

export type MotivoFalhaPull = "sem-indexeddb" | "sem-conexao" | "servidor" | "sessao" | "erro-local";

export type ResultadoPull =
  | { ok: true; servidorEm: string; cargaCompleta: boolean }
  | { ok: false; motivo: MotivoFalhaPull; mensagem: string };

// Um pull por usuário de cada vez: disparos simultâneos (ex.: StrictMode) recebem a mesma promessa.
const emAndamento = new Map<string, Promise<ResultadoPull>>();

const SEM_PENDENCIAS: ReadonlySet<string> = new Set();

// O servidor carimba o `updatedAt` na escrita, não no commit: uma transação que
// escreveu antes de `servidorEm` e comitou depois ficaria de fora de um pull com
// `desde = servidorEm`. Por isso o pedido recua o `desde` por esta margem fixa
// (o `desde` gravado continua o `servidorEm`). Rebuscar alguns registros é
// inofensivo: a gravação é por id e respeita as pendências.
export const MARGEM_DESDE_MS = 5 * 60 * 1000;

// `desde` enviado ao servidor; undefined = carga completa.
export function desdeDoPedido(desdeGravado: string | null): string | undefined {
  if (!desdeGravado) return undefined;
  const instante = Date.parse(desdeGravado);
  if (Number.isNaN(instante)) return undefined;
  return new Date(instante - MARGEM_DESDE_MS).toISOString();
}

// O token enviado precisa ser do mesmo usuário do banco que vai receber os dados.
const sessaoDoUsuario = (usuarioId: string) => useAuth.getState().usuario?.id === usuarioId;
const SESSAO_TROCADA: ResultadoPull = { ok: false, motivo: "sessao", mensagem: "A sessão atual é de outro usuário." };

// `pendentes`: ids com mudança local ainda não enviada (a fila de operações offline, quando existir);
// o pull não toca neles. Numa chamada deduplicada, valem os da primeira chamada.
export function puxarAlteracoes(usuarioId: string, pendentes: ReadonlySet<string> = SEM_PENDENCIAS): Promise<ResultadoPull> {
  const atual = emAndamento.get(usuarioId);
  if (atual) return atual;
  const pull = executarPull(usuarioId, pendentes).finally(() => emAndamento.delete(usuarioId));
  emAndamento.set(usuarioId, pull);
  return pull;
}

function falha(erro: unknown): ResultadoPull {
  if (erro instanceof ErroApi) {
    if (erro.status === 0) return { ok: false, motivo: "sem-conexao", mensagem: erro.message };
    if (erro.status === 401) return { ok: false, motivo: "sessao", mensagem: erro.message };
    return { ok: false, motivo: "servidor", mensagem: erro.message };
  }
  return { ok: false, motivo: "erro-local", mensagem: erro instanceof Error ? erro.message : String(erro) };
}

async function executarPull(usuarioId: string, pendentes: ReadonlySet<string>): Promise<ResultadoPull> {
  if (!indexedDbDisponivel()) {
    return { ok: false, motivo: "sem-indexeddb", mensagem: "Este navegador não oferece armazenamento local (IndexedDB)." };
  }
  if (!sessaoDoUsuario(usuarioId)) return SESSAO_TROCADA;
  try {
    const db = await abrirBanco(usuarioId);
    const [meta, qtdEspecies] = await Promise.all([lerMeta(db), contarEspecies(db)]);
    // undefined = carga completa (nunca houve pull ou o `desde` gravado é inválido).
    const desdePedido = desdeDoPedido(meta.desde);

    // O catálogo de espécies não vem no pull; é buscado enquanto o store estiver vazio.
    // Se só ele falhar, os dados são aplicados e as espécies ficam para o próximo pull.
    const [alteracoes, especies] = await Promise.allSettled([
      syncApi.alteracoes(desdePedido),
      qtdEspecies === 0 ? especiesApi.listar() : Promise.resolve(null),
    ]);
    if (alteracoes.status === "rejected") return falha(alteracoes.reason);
    // A sessão pode ter mudado durante a request (logout + login em outra conta):
    // sem esta segunda checagem, a resposta poderia ir para o banco errado.
    if (!sessaoDoUsuario(usuarioId)) return SESSAO_TROCADA;

    await aplicarPull(db, alteracoes.value, pendentes, especies.status === "fulfilled" ? especies.value : null);
    return { ok: true, servidorEm: alteracoes.value.servidorEm, cargaCompleta: desdePedido === undefined };
  } catch (erro) {
    return falha(erro);
  }
}

// Pede ao navegador que não apague os dados locais sob pressão de espaço.
// Quem decide é o navegador; o resultado fica em `meta.armazenamentoPersistente`
// (false também quando a API não existe). Nunca lança.
export async function pedirArmazenamentoPersistente(usuarioId: string): Promise<boolean> {
  let persistente = false;
  try {
    const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
    if (storage?.persisted) persistente = await storage.persisted();
    if (!persistente && storage?.persist) persistente = await storage.persist();
  } catch {
    persistente = false;
  }
  if (indexedDbDisponivel()) {
    try {
      await atualizarMeta(await abrirBanco(usuarioId), { armazenamentoPersistente: persistente });
    } catch {
      // Sem banco local, não há onde registrar; o app segue normal.
    }
  }
  return persistente;
}
