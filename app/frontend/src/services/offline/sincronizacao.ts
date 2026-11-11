import { useAuth } from "../../store/auth";
import { useSincronizacao } from "../../store/sincronizacao";
import { ErroApi } from "../api/client";
import { especiesApi, fotosApi, syncApi } from "../api/endpoints";
import {
  abrirBanco,
  aplicarPull,
  atualizarFila,
  atualizarMeta,
  contarEspecies,
  contarFila,
  contarFotosPendentes,
  guardarFoto,
  indexedDbDisponivel,
  lerFila,
  lerFotos,
  lerMeta,
  removerFoto,
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
    // `recarregar`: uma decisão pediu carga completa (ex.: exclusão local descartada).
    const desdePedido = meta.recarregar ? undefined : desdeDoPedido(meta.desde);

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

    const alterados = await aplicarPull(
      db,
      alteracoes.value,
      pendentes,
      especies.status === "fulfilled" ? especies.value : null,
      desdePedido === undefined
    );
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
  // Fotos guardadas que subiram, que saíram ou pararam (404/4xx), e a falha
  // transitória que parou o envio delas.
  fotosEnviadas: number;
  fotosAlteradas: number;
  falhaFotos: FalhaPull | null;
  // null = pull não tentado (o envio falhou antes).
  pull: ResultadoPull | null;
  naFila: number;
}

export const sincronizacaoOk = (r: ResultadoSincronizacao) =>
  r.falhaEnvio === null && r.falhaFotos === null && r.pull?.ok === true;

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

// Atualiza os contadores (fila e fotos) do usuário da sessão; devolve o da fila. Nunca lança.
export async function atualizarContagem(usuarioId: string): Promise<number> {
  if (!indexedDbDisponivel()) return 0;
  try {
    const db = await abrirBanco(usuarioId);
    const [naFila, fotosPendentes] = await Promise.all([contarFila(db), contarFotosPendentes(db)]);
    if (sessaoDoUsuario(usuarioId)) useSincronizacao.setState({ naFila, fotosPendentes });
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
    envio.paradas += mudancas.atualizar.filter((o) => o.estado !== "pendente").length;
    // Nenhum resultado casou com o lote: parar evita reenviar o mesmo lote sem fim.
    if (mudancas.remover.length + mudancas.atualizar.length === 0) break;
  }
  return envio;
}

// Fotos guardadas cujo registro já existe no servidor (nenhum create dele na
// fila), da mais antiga para a mais nova. Roda depois do envio da fila: as fotos
// apontam para os ids gerados no cliente.
//  - 404: o registro sumiu do servidor; a foto é descartada.
//  - Outro 4xx (exceto 401, 408, 429): arquivo recusado; a foto para com a mensagem.
//  - Rede, timeout, 5xx, 401, 408, 429: para o envio; a foto fica para a próxima.
//  - Erro que não vem da API (ex.: bytes ilegíveis): a foto para, para não segurar as outras.
async function enviarFotos(
  db: BancoOffline,
  usuarioId: string
): Promise<{ enviadas: number; alteradas: number; falha: FalhaPull | null }> {
  const [fotos, fila] = await Promise.all([lerFotos(db), lerFila(db)]);
  const aguardandoCreate = new Set(fila.filter((op) => op.operacao === "create").map((op) => op.entidadeId));
  const prontas = fotos
    .filter((f) => f.estado === "pendente" && !aguardandoCreate.has(f.entidadeId))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  let enviadas = 0;
  let alteradas = 0;
  for (const foto of prontas) {
    if (!sessaoDoUsuario(usuarioId)) return { enviadas, alteradas, falha: SESSAO_TROCADA as FalhaPull };
    try {
      await fotosApi.enviar(new Blob([foto.bytes], { type: foto.tipo }), foto.vinculo);
      await removerFoto(db, foto.id);
      enviadas += 1;
    } catch (erro) {
      if (!(erro instanceof ErroApi)) {
        const ultimoErro = erro instanceof Error ? erro.message : String(erro);
        await guardarFoto(db, { ...foto, estado: "erro", tentativas: foto.tentativas + 1, ultimoErro });
        alteradas += 1;
        continue;
      }
      if (erro.status === 404) {
        await removerFoto(db, foto.id);
        alteradas += 1;
        continue;
      }
      if (erro.status >= 400 && erro.status < 500 && ![401, 408, 429].includes(erro.status)) {
        await guardarFoto(db, { ...foto, estado: "erro", tentativas: foto.tentativas + 1, ultimoErro: erro.message });
        alteradas += 1;
        continue;
      }
      return { enviadas, alteradas, falha: falha(erro) as FalhaPull };
    }
  }
  return { enviadas, alteradas, falha: null };
}

// Falha que vale nova tentativa sozinha: rede/timeout ou servidor (5xx, 4xx do lote).
// Sessão (401) não: o novo login dispara a sincronização.
function falhaTransitoria(r: ResultadoSincronizacao): boolean {
  const motivos = [r.falhaEnvio?.motivo, r.falhaFotos?.motivo, r.pull && !r.pull.ok ? r.pull.motivo : undefined];
  return motivos.some((m) => m === "sem-conexao" || m === "servidor");
}

async function executarSincronizacao(usuarioId: string): Promise<ResultadoSincronizacao> {
  const timer = novasTentativas.get(usuarioId);
  if (timer) clearTimeout(timer);
  novasTentativas.delete(usuarioId);

  const vazio = { enviadas: 0, paradas: 0, fotosEnviadas: 0, fotosAlteradas: 0, falhaFotos: null, pull: null, naFila: 0 };
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
    const fotos = envio.falhaEnvio ? { enviadas: 0, alteradas: 0, falha: null } : await enviarFotos(db, usuarioId);
    const pull = envio.falhaEnvio ? null : await puxarAlteracoes(usuarioId);
    resultado = {
      ...envio,
      fotosEnviadas: fotos.enviadas,
      fotosAlteradas: fotos.alteradas,
      falhaFotos: fotos.falha,
      pull,
      naFila: await contarFila(db),
    };
  } catch (erro) {
    resultado = { ...vazio, falhaEnvio: falha(erro) as FalhaPull };
  }

  if (sessaoDoUsuario(usuarioId)) {
    const mudou =
      resultado.enviadas + resultado.paradas + resultado.fotosEnviadas + resultado.fotosAlteradas > 0 ||
      (resultado.pull?.ok === true && resultado.pull.alterados > 0);
    const fotosPendentes = await abrirBanco(usuarioId)
      .then(contarFotosPendentes)
      .catch(() => useSincronizacao.getState().fotosPendentes);
    useSincronizacao.setState((s) => ({
      sincronizando: false,
      naFila: resultado.naFila,
      fotosPendentes,
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
