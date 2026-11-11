import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Especie } from "../../types/api";
import type { MudancasFila } from "./fila";
import { mesclar } from "./mesclar";
import {
  META_VAZIA,
  TIPOS_PULL,
  type AvaliacaoServidor,
  type ColoniaServidor,
  type IdsPorTipo,
  type FotoPendente,
  type LinhaLocal,
  type MetaOffline,
  type OperacaoFila,
  type ParametroServidor,
  type ProducaoServidor,
  type RespostaAlteracoes,
} from "./tipos";

// Banco local (IndexedDB), um por usuário: `corbicula-offline-<usuarioId>`.
// Guarda a cópia dos dados do servidor trazida pelo pull; nada de um usuário
// é lido ou gravado no banco de outro.

interface EsquemaOffline extends DBSchema {
  colonias: { key: string; value: ColoniaServidor };
  avaliacoes: { key: string; value: AvaliacaoServidor; indexes: { coloniaId: string } };
  producoes: { key: string; value: ProducaoServidor; indexes: { coloniaId: string } };
  parametros: { key: string; value: ParametroServidor };
  especies: { key: string; value: Especie };
  meta: { key: string; value: MetaOffline };
  // Fila de operações offline (versão 2), na ordem em que foram feitas.
  fila: { key: string; value: OperacaoFila; indexes: { ordem: number } };
  // Fotos guardadas offline (versão 3), esperando o POST /fotos.
  fotos: { key: string; value: FotoPendente; indexes: { entidadeId: string } };
}

export type BancoOffline = IDBPDatabase<EsquemaOffline>;

const VERSAO = 3;
const CHAVE_META = "meta";

export const nomeBanco = (usuarioId: string) => `corbicula-offline-${usuarioId}`;

// Navegadores antigos, alguns modos privados e o jsdom não têm IndexedDB.
export const indexedDbDisponivel = () => typeof indexedDB !== "undefined";

// Uma conexão por usuário, reaproveitada.
const conexoes = new Map<string, Promise<BancoOffline>>();

export function abrirBanco(usuarioId: string): Promise<BancoOffline> {
  const existente = conexoes.get(usuarioId);
  if (existente) return existente;

  const esquecer = () => conexoes.delete(usuarioId);
  const conexao = openDB<EsquemaOffline>(nomeBanco(usuarioId), VERSAO, {
    // Cada versão só acrescenta: um banco da versão 1 mantém os dados e ganha a fila.
    upgrade(db, versaoAntiga) {
      if (versaoAntiga < 1) {
        db.createObjectStore("colonias", { keyPath: "id" });
        db.createObjectStore("avaliacoes", { keyPath: "id" }).createIndex("coloniaId", "coloniaId");
        db.createObjectStore("producoes", { keyPath: "id" }).createIndex("coloniaId", "coloniaId");
        db.createObjectStore("parametros", { keyPath: "id" });
        db.createObjectStore("especies", { keyPath: "id" });
        db.createObjectStore("meta");
      }
      if (versaoAntiga < 2) db.createObjectStore("fila", { keyPath: "id" }).createIndex("ordem", "ordem");
      if (versaoAntiga < 3) db.createObjectStore("fotos", { keyPath: "id" }).createIndex("entidadeId", "entidadeId");
    },
    // Outra aba quer uma versão mais nova do banco: fecha esta conexão para não travá-la.
    blocking() {
      void conexao.then((db) => db.close());
      esquecer();
    },
    // O navegador fechou a conexão (ex.: dados do site apagados).
    terminated: esquecer,
  });
  conexao.catch(esquecer);
  conexoes.set(usuarioId, conexao);
  return conexao;
}

export async function lerMeta(db: BancoOffline): Promise<MetaOffline> {
  return { ...META_VAZIA, ...(await db.get("meta", CHAVE_META)) };
}

export async function atualizarMeta(db: BancoOffline, parcial: Partial<MetaOffline>): Promise<void> {
  const tx = db.transaction("meta", "readwrite");
  const atual = await tx.store.get(CHAVE_META);
  await Promise.all([tx.store.put({ ...META_VAZIA, ...atual, ...parcial }, CHAVE_META), tx.done]);
}

export const contarEspecies = (db: BancoOffline) => db.count("especies");

// Aplica uma resposta do pull numa transação só: lê os ids locais e os da fila,
// monta o plano (`mesclar`) e grava dados, exclusões, espécies (quando vierem) e
// o novo `desde`. As entidades da fila são lidas dentro da transação: uma escrita
// offline feita durante o pull nunca é sobrescrita por ele.
// Devolve quantos registros foram gravados ou removidos.
// Se qualquer escrita falhar, a transação aborta e nada muda.
// Dentro da transação não há `await` fora do IndexedDB (senão ela fecharia sozinha).
export async function aplicarPull(
  db: BancoOffline,
  resposta: RespostaAlteracoes,
  pendentes: ReadonlySet<string>,
  especies: Especie[] | null,
  // Carga completa (sem `desde`): só ela atende um pedido de recarga (`meta.recarregar`).
  cargaCompleta = false
): Promise<number> {
  const tx = db.transaction([...TIPOS_PULL, "especies", "meta", "fila"], "readwrite");
  const escritas: Promise<unknown>[] = [];
  try {
    const [colonias, avaliacoes, producoes, parametros, metaAtual, fila] = await Promise.all([
      tx.objectStore("colonias").getAllKeys(),
      tx.objectStore("avaliacoes").getAllKeys(),
      tx.objectStore("producoes").getAllKeys(),
      tx.objectStore("parametros").getAllKeys(),
      tx.objectStore("meta").get(CHAVE_META),
      tx.objectStore("fila").getAll(),
    ]);
    const idsLocais: IdsPorTipo = { colonias, avaliacoes, producoes, parametros };
    const todosPendentes = new Set([...pendentes, ...fila.map((op) => op.entidadeId)]);
    const plano = mesclar(resposta, idsLocais, todosPendentes);
    let alterados = 0;
    for (const tipo of TIPOS_PULL) alterados += plano.remover[tipo].length + plano.gravar[tipo].length;

    for (const tipo of TIPOS_PULL) {
      const store = tx.objectStore(tipo);
      for (const id of plano.remover[tipo]) escritas.push(store.delete(id));
    }
    for (const c of plano.gravar.colonias) escritas.push(tx.objectStore("colonias").put(c));
    for (const a of plano.gravar.avaliacoes) escritas.push(tx.objectStore("avaliacoes").put(a));
    for (const p of plano.gravar.producoes) escritas.push(tx.objectStore("producoes").put(p));
    for (const p of plano.gravar.parametros) escritas.push(tx.objectStore("parametros").put(p));

    // Catálogo fixo: quando vem, substitui o anterior por inteiro.
    if (especies) {
      const store = tx.objectStore("especies");
      escritas.push(store.clear());
      for (const e of especies) escritas.push(store.put(e));
    }

    const { recarregar, ...metaSemRecarga } = { ...META_VAZIA, ...metaAtual };
    // Um pull incremental não apaga o pedido de recarga (pode ter chegado durante ele).
    const meta: MetaOffline = {
      ...metaSemRecarga,
      ...(recarregar && !cargaCompleta && { recarregar }),
      desde: plano.desde,
      ultimoPull: new Date().toISOString(),
    };
    escritas.push(tx.objectStore("meta").put(meta, CHAVE_META));

    await Promise.all([...escritas, tx.done]);
    return alterados;
  } catch (erro) {
    // Garante o rollback mesmo se o erro veio de fora de uma requisição do IndexedDB.
    try {
      tx.abort();
    } catch {
      // A transação já tinha abortado sozinha.
    }
    // As requisições já enfileiradas rejeitam com AbortError; o erro relevante é o original.
    for (const p of [...escritas, tx.done]) p.catch(() => undefined);
    throw erro;
  }
}

// ─── Fila de operações ────────────────────────────────────────────────────────

export const lerFila = (db: BancoOffline): Promise<OperacaoFila[]> => db.getAllFromIndex("fila", "ordem");

export const contarFila = (db: BancoOffline) => db.count("fila");

// Mudança na cópia local que acompanha uma operação.
export interface MudancaLocal {
  store: "colonias" | "avaliacoes" | "producoes";
  gravar?: LinhaLocal;
  remover?: string[];
}

// Grava a operação no fim da fila e aplica a mudança na cópia local, numa
// transação só: ou as duas acontecem, ou nenhuma.
export async function enfileirar(
  db: BancoOffline,
  operacao: Omit<OperacaoFila, "ordem">,
  mudancas: readonly MudancaLocal[]
): Promise<void> {
  const tx = db.transaction(["fila", "colonias", "avaliacoes", "producoes"], "readwrite");
  const escritas: Promise<unknown>[] = [];
  try {
    const ultima = await tx.objectStore("fila").index("ordem").openCursor(null, "prev");
    const ordem = (ultima?.value.ordem ?? 0) + 1;
    escritas.push(tx.objectStore("fila").add({ ...operacao, ordem }));
    for (const m of mudancas) {
      const store = tx.objectStore(m.store);
      for (const id of m.remover ?? []) escritas.push(store.delete(id));
      // O tipo da linha corresponde ao store (garantido por quem monta a mudança).
      if (m.gravar) escritas.push(store.put(m.gravar as never));
    }
    await Promise.all([...escritas, tx.done]);
  } catch (erro) {
    try {
      tx.abort();
    } catch {
      // Já abortada.
    }
    for (const p of [...escritas, tx.done]) p.catch(() => undefined);
    throw erro;
  }
}

// Resultado de um envio: tira da fila o que o servidor confirmou e grava o
// novo estado das operações paradas.
export async function atualizarFila(db: BancoOffline, mudancas: MudancasFila): Promise<void> {
  const tx = db.transaction("fila", "readwrite");
  await Promise.all([
    ...mudancas.remover.map((id) => tx.store.delete(id)),
    ...mudancas.atualizar.map((op) => tx.store.put(op)),
    tx.done,
  ]);
}

// ─── Fotos guardadas offline ──────────────────────────────────────────────────

export const guardarFoto = (db: BancoOffline, foto: FotoPendente) => db.put("fotos", foto);
export const lerFotos = (db: BancoOffline): Promise<FotoPendente[]> => db.getAll("fotos");
export const fotosDoRegistro = (db: BancoOffline, entidadeId: string): Promise<FotoPendente[]> =>
  db.getAllFromIndex("fotos", "entidadeId", entidadeId);
export const removerFoto = (db: BancoOffline, id: string) => db.delete("fotos", id);
export const contarFotosPendentes = async (db: BancoOffline) =>
  (await db.getAll("fotos")).filter((f) => f.estado === "pendente").length;

// ─── Decisões sobre operações paradas (decisoes.ts) ──────────────────────────

export interface PlanoDecisao {
  removerOperacoes: string[];
  // Operações gravadas (substituem pela chave; trazem a própria `ordem`).
  gravarOperacoes: OperacaoFila[];
  mudancas: MudancaLocal[];
  removerFotos: string[];
  // Próximo pull completo (uma linha removida localmente precisa voltar).
  recarregarTudo: boolean;
}

// Aplica uma decisão numa transação só: fila, cópia local, fotos e meta.
export async function aplicarDecisao(db: BancoOffline, plano: PlanoDecisao): Promise<void> {
  const tx = db.transaction(["fila", "colonias", "avaliacoes", "producoes", "fotos", "meta"], "readwrite");
  const escritas: Promise<unknown>[] = [];
  try {
    for (const id of plano.removerOperacoes) escritas.push(tx.objectStore("fila").delete(id));
    for (const op of plano.gravarOperacoes) escritas.push(tx.objectStore("fila").put(op));
    for (const m of plano.mudancas) {
      const store = tx.objectStore(m.store);
      for (const id of m.remover ?? []) escritas.push(store.delete(id));
      if (m.gravar) escritas.push(store.put(m.gravar as never));
    }
    for (const id of plano.removerFotos) escritas.push(tx.objectStore("fotos").delete(id));
    if (plano.recarregarTudo) {
      const atual = await tx.objectStore("meta").get(CHAVE_META);
      escritas.push(tx.objectStore("meta").put({ ...META_VAZIA, ...atual, recarregar: true }, CHAVE_META));
    }
    await Promise.all([...escritas, tx.done]);
  } catch (erro) {
    try {
      tx.abort();
    } catch {
      // Já abortada.
    }
    for (const p of [...escritas, tx.done]) p.catch(() => undefined);
    throw erro;
  }
}
