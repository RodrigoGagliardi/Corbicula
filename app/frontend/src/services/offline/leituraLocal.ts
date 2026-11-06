import type { FiltrosAvaliacoes, FiltrosProducao } from "../../types/api";
import { useAuth } from "../../store/auth";
import { ErroApi } from "../api/client";
import { abrirBanco, indexedDbDisponivel, lerMeta, type BancoOffline } from "./banco";
import {
  buscarAvaliacao,
  buscarColonia,
  buscarProducao,
  historicoAvaliacoes,
  listarAvaliacoesDaColonia,
  listarColonias,
  listarEspecies,
  listarParametros,
  listarProducoes,
} from "./leituras";

// Ponto único da decisão online/local das leituras.
//  - Online, a fonte é a API; o banco local nem é aberto.
//  - Sem rede (`navigator.onLine` falso) ou com falha de rede na chamada
//    (`ErroApi` status 0), lê o banco local do usuário da sessão.
//  - Sem usuário, sem IndexedDB ou com o banco nunca carregado (`meta.desde`
//    nulo), relança o erro de conexão: não há cópia local para mostrar.
// Erros HTTP (404, 500...) passam direto, como hoje.

const MENSAGEM_SEM_CONEXAO = "Sem conexão com o servidor.";
// O registro pode existir no servidor e ainda não ter chegado à cópia local.
export const MENSAGEM_FORA_DA_COPIA = "Este registro ainda não está na cópia offline. Ele aparece quando a conexão voltar.";

export const ehErroDeConexao = (erro: unknown): erro is ErroApi => erro instanceof ErroApi && erro.status === 0;

export const semRede = () => typeof navigator !== "undefined" && navigator.onLine === false;

// Base do fallback: `alternativa` recebe o erro de conexão (o original, ou um
// equivalente quando nem houve chamada por falta de rede).
export async function comFallback<T>(remoto: () => Promise<T>, alternativa: (erro: ErroApi) => Promise<T>): Promise<T> {
  if (semRede()) return alternativa(new ErroApi(0, MENSAGEM_SEM_CONEXAO));
  try {
    return await remoto();
  } catch (erro) {
    if (ehErroDeConexao(erro)) return alternativa(erro);
    throw erro;
  }
}

async function lerBancoLocal<T>(local: (db: BancoOffline) => Promise<T>, erroConexao: ErroApi): Promise<T> {
  const usuarioId = useAuth.getState().usuario?.id;
  if (!usuarioId || !indexedDbDisponivel()) throw erroConexao;
  let db: BancoOffline;
  try {
    db = await abrirBanco(usuarioId);
    if (!(await lerMeta(db)).desde) throw erroConexao;
  } catch {
    throw erroConexao;
  }
  try {
    return await local(db);
  } catch (erro) {
    // Um 404 local é a resposta (registro fora da cópia); outra falha vira o erro
    // de conexão, mas fica no console para um erro de leitura não passar calado.
    if (erro instanceof ErroApi) throw erro.status === 404 ? new ErroApi(404, MENSAGEM_FORA_DA_COPIA) : erro;
    console.error("Falha na leitura do banco local:", erro);
    throw erroConexao;
  }
}

export function comFallbackLocal<T>(remoto: () => Promise<T>, local: (db: BancoOffline) => Promise<T>): Promise<T> {
  return comFallback(remoto, (erro) => lerBancoLocal(local, erro));
}

// ─── Leituras do banco local, no formato de cada rota REST ────────────────────

const doColonia = (db: BancoOffline, coloniaId: string) => db.getAllFromIndex("avaliacoes", "coloniaId", coloniaId);

export const leiturasLocais = {
  colonias: async (db: BancoOffline) => {
    const [colonias, avaliacoes, producoes, especies] = await Promise.all([
      db.getAll("colonias"),
      db.getAll("avaliacoes"),
      db.getAll("producoes"),
      db.getAll("especies"),
    ]);
    return listarColonias({ colonias, avaliacoes, producoes, especies });
  },

  colonia: async (db: BancoOffline, id: string) => {
    const [colonias, avaliacoes, producoes, especies] = await Promise.all([
      db.getAll("colonias"),
      doColonia(db, id),
      db.getAllFromIndex("producoes", "coloniaId", id),
      db.getAll("especies"),
    ]);
    return buscarColonia({ colonias, avaliacoes, producoes, especies }, id);
  },

  avaliacoes: async (db: BancoOffline, coloniaId: string) => {
    const [colonia, avaliacoes] = await Promise.all([db.get("colonias", coloniaId), doColonia(db, coloniaId)]);
    return listarAvaliacoesDaColonia({ colonias: colonia ? [colonia] : [], avaliacoes }, coloniaId);
  },

  historicoAvaliacoes: async (db: BancoOffline, filtros: FiltrosAvaliacoes) => {
    const [colonias, avaliacoes, especies] = await Promise.all([db.getAll("colonias"), db.getAll("avaliacoes"), db.getAll("especies")]);
    return historicoAvaliacoes({ colonias, avaliacoes, especies }, filtros);
  },

  avaliacao: async (db: BancoOffline, coloniaId: string, id: string) => {
    const [colonia, avaliacao, parametros] = await Promise.all([
      db.get("colonias", coloniaId),
      db.get("avaliacoes", id),
      db.getAll("parametros"),
    ]);
    return buscarAvaliacao({ colonias: colonia ? [colonia] : [], avaliacoes: avaliacao ? [avaliacao] : [], parametros }, coloniaId, id);
  },

  parametros: async (db: BancoOffline) => {
    const [parametros, avaliacoes, especies] = await Promise.all([db.getAll("parametros"), db.getAll("avaliacoes"), db.getAll("especies")]);
    return listarParametros({ parametros, avaliacoes, especies });
  },

  especies: async (db: BancoOffline) => {
    const especies = await db.getAll("especies");
    // Catálogo ainda não baixado: sem cópia local, vale o erro de conexão (lista vazia enganaria).
    if (especies.length === 0) throw new Error("Catálogo de espécies não carregado");
    return listarEspecies(especies);
  },

  producoes: async (db: BancoOffline, filtros: FiltrosProducao) => {
    const [colonias, producoes, especies] = await Promise.all([db.getAll("colonias"), db.getAll("producoes"), db.getAll("especies")]);
    return listarProducoes({ colonias, producoes, especies }, filtros);
  },

  producao: async (db: BancoOffline, id: string) => {
    const producao = await db.get("producoes", id);
    const [colonia, especies] = await Promise.all([
      producao ? db.get("colonias", producao.coloniaId) : Promise.resolve(undefined),
      db.getAll("especies"),
    ]);
    return buscarProducao({ colonias: colonia ? [colonia] : [], producoes: producao ? [producao] : [], especies }, id);
  },
};
