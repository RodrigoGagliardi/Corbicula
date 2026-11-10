import { useAuth } from "../../store/auth";
import { useSincronizacao } from "../../store/sincronizacao";
import { ErroApi } from "../api/client";
import { especiesApi, syncApi } from "../api/endpoints";
import {
  abrirBanco,
  aplicarPull,
  atualizarFila,
  atualizarMeta,
  contarEspecies,
  contarFila,
  indexedDbDisponivel,
  lerFila,
  lerMeta,
  type BancoOffline,
} from "./banco";
import { aplicarResultados, paraEnvio, proximoLote } from "./fila";
import { semRede } from "./leituraLocal";

// Orquestração do pull (GET /sync/alteracoes) para o banco local do usuário.
// Nunca lança: falha de rede, 5xx ou navegador sem IndexedDB só deixam o banco
// como estava e voltam como `{ ok: false }`.

export type MotivoFalhaPull = "sem-indexeddb" | "sem-conexao" | "servidor" | "sessao" | "erro-local";

export type ResultadoPull =
  | { ok: true; servidorEm: string; cargaCompleta: boolean; alterados: number }
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

// `pendentes`: ids com mudança local ainda não enviada; o pull não toca neles.
// As entidades da fila do banco local entram sempre (lidas dentro da transação
// do `aplicarPull`). Numa chamada deduplicada, valem os da primeira chamada.
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

    const alterados = await aplicarPull(db, alteracoes.value, pendentes, especies.status === "fulfilled" ? especies.value : null);
    return { ok: true, servidorEm: alteracoes.value.servidorEm, cargaCompleta: desdePedido === undefined, alterados };
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

// ─── Ciclo completo: envio da fila (POST /sync) e pull ───────────────────────

type FalhaPull = Extract<ResultadoPull, { ok: false }>;

export interface ResultadoSincronizacao {
  // Operações que saíram da fila (aplicadas ou duplicadas) e as que pararam
  // (conflito ou recusa, esperando decisão do usuário).
  enviadas: number;
  paradas: number;
  // Falha que interrompeu o envio; null = enviou tudo o que podia.
  falhaEnvio: FalhaPull | null;
  // null = pull não tentado (o envio falhou antes).
  pull: ResultadoPull | null;
  naFila: number;
}

export const sincronizacaoOk = (r: ResultadoSincronizacao) => r.falhaEnvio === null && r.pull?.ok === true;

// Esperas entre tentativas depois de falhas transitórias seguidas (rede, timeout, 5xx).
export const ESPERAS_MS = [15_000, 30_000, 60_000, 120_000, 300_000];
export const esperaDaTentativa = (falhasSeguidas: number) =>
  ESPERAS_MS[Math.min(Math.max(falhasSeguidas, 1), ESPERAS_MS.length) - 1];

// Rodadas máximas de envio num ciclo (cada uma, um lote de até 500).
const MAX_RODADAS = 50;

const sincronizacoes = new Map<string, Promise<ResultadoSincronizacao>>();
// Ciclo seguinte, pedido durante um ciclo em andamento.
const repeticoes = new Map<string, Promise<ResultadoSincronizacao>>();
const falhasSeguidas = new Map<string, number>();
const novasTentativas = new Map<string, ReturnType<typeof setTimeout>>();

const SEM_REDE: FalhaPull = { ok: false, motivo: "sem-conexao", mensagem: "Sem conexão com o servidor." };

// Cancela a nova tentativa agendada (de um usuário ou de todos) e zera a espera.
export function cancelarNovaTentativa(usuarioId?: string): void {
  for (const [id, timer] of novasTentativas) {
    if (usuarioId && id !== usuarioId) continue;
    clearTimeout(timer);
    novasTentativas.delete(id);
  }
  if (usuarioId) falhasSeguidas.delete(usuarioId);
  else falhasSeguidas.clear();
}

// Envia a fila e depois puxa as alterações. Nunca lança.
// Uma chamada durante um ciclo em andamento agenda um ciclo novo logo depois dele
// (a escrita que a motivou pode ter chegado depois do envio ou do pull); as
// chamadas seguintes, ainda durante o ciclo, recebem esse mesmo ciclo novo.
export function sincronizar(usuarioId: string): Promise<ResultadoSincronizacao> {
  const atual = sincronizacoes.get(usuarioId);
  if (atual) {
    const repeticao = repeticoes.get(usuarioId);
    if (repeticao) return repeticao;
    const nova = atual.then(() => {
      repeticoes.delete(usuarioId);
      return sincronizar(usuarioId);
    });
    repeticoes.set(usuarioId, nova);
    return nova;
  }
  const ciclo = executarSincronizacao(usuarioId).finally(() => sincronizacoes.delete(usuarioId));
  sincronizacoes.set(usuarioId, ciclo);
  return ciclo;
}

// Atualiza o contador da fila do usuário da sessão. Nunca lança.
export async function atualizarContagem(usuarioId: string): Promise<number> {
  if (!indexedDbDisponivel()) return 0;
  try {
    const naFila = await contarFila(await abrirBanco(usuarioId));
    if (sessaoDoUsuario(usuarioId)) useSincronizacao.setState({ naFila });
    return naFila;
  } catch {
    return 0;
  }
}

type ResultadoEnvio = Pick<ResultadoSincronizacao, "enviadas" | "paradas" | "falhaEnvio">;

async function enviarFila(db: BancoOffline, usuarioId: string): Promise<ResultadoEnvio> {
  const envio: ResultadoEnvio = { enviadas: 0, paradas: 0, falhaEnvio: null };
  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    const lote = proximoLote(await lerFila(db));
    if (lote.length === 0) break;
    // O token enviado precisa ser do dono da fila.
    if (!sessaoDoUsuario(usuarioId)) return { ...envio, falhaEnvio: SESSAO_TROCADA as FalhaPull };
    let resposta;
    try {
      resposta = await syncApi.enviar(lote.map(paraEnvio));
    } catch (erro) {
      // Rede, timeout, 5xx ou 401: a fila fica como está; o reenvio usa os mesmos ids.
      return { ...envio, falhaEnvio: falha(erro) as FalhaPull };
    }
    const mudancas = aplicarResultados(lote, resposta.resultados);
    await atualizarFila(db, mudancas);
    envio.enviadas += mudancas.remover.length;
    envio.paradas += mudancas.atualizar.length;
    // Nenhum resultado casou com o lote: parar evita reenviar o mesmo lote sem fim.
    if (mudancas.remover.length + mudancas.atualizar.length === 0) break;
  }
  return envio;
}

// Falha que vale nova tentativa sozinha: rede/timeout ou servidor (5xx, 4xx do lote).
// Sessão (401) não: o novo login dispara a sincronização.
function falhaTransitoria(r: ResultadoSincronizacao): boolean {
  const motivo = r.falhaEnvio?.motivo ?? (r.pull && !r.pull.ok ? r.pull.motivo : null);
  return motivo === "sem-conexao" || motivo === "servidor";
}

async function executarSincronizacao(usuarioId: string): Promise<ResultadoSincronizacao> {
  const timer = novasTentativas.get(usuarioId);
  if (timer) clearTimeout(timer);
  novasTentativas.delete(usuarioId);

  const vazio = { enviadas: 0, paradas: 0, pull: null, naFila: 0 };
  if (!indexedDbDisponivel()) {
    return {
      ...vazio,
      falhaEnvio: { ok: false, motivo: "sem-indexeddb", mensagem: "Este navegador não oferece armazenamento local (IndexedDB)." },
    };
  }
  if (!sessaoDoUsuario(usuarioId)) return { ...vazio, falhaEnvio: SESSAO_TROCADA as FalhaPull };
  // Sem rede não há o que tentar; o evento "online" dispara a próxima.
  if (semRede()) return { ...vazio, naFila: await atualizarContagem(usuarioId), falhaEnvio: SEM_REDE };

  useSincronizacao.setState({ sincronizando: true });
  let resultado: ResultadoSincronizacao;
  try {
    const db = await abrirBanco(usuarioId);
    const envio = await enviarFila(db, usuarioId);
    const pull = envio.falhaEnvio ? null : await puxarAlteracoes(usuarioId);
    resultado = { ...envio, pull, naFila: await contarFila(db) };
  } catch (erro) {
    resultado = { ...vazio, falhaEnvio: falha(erro) as FalhaPull };
  }

  if (sessaoDoUsuario(usuarioId)) {
    const mudou =
      resultado.enviadas + resultado.paradas > 0 || (resultado.pull?.ok === true && resultado.pull.alterados > 0);
    useSincronizacao.setState((s) => ({
      sincronizando: false,
      naFila: resultado.naFila,
      concluidas: mudou ? s.concluidas + 1 : s.concluidas,
    }));
  } else {
    useSincronizacao.setState({ sincronizando: false });
  }

  if (!falhaTransitoria(resultado)) {
    falhasSeguidas.delete(usuarioId);
  } else if (!semRede() && sessaoDoUsuario(usuarioId)) {
    const falhas = (falhasSeguidas.get(usuarioId) ?? 0) + 1;
    falhasSeguidas.set(usuarioId, falhas);
    novasTentativas.set(
      usuarioId,
      setTimeout(() => {
        novasTentativas.delete(usuarioId);
        void sincronizar(usuarioId);
      }, esperaDaTentativa(falhas))
    );
  }
  return resultado;
}
