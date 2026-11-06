import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Especie } from "../../types/api";
import { mesclar } from "./mesclar";
import {
  META_VAZIA,
  TIPOS_PULL,
  type AvaliacaoServidor,
  type ColoniaServidor,
  type IdsPorTipo,
  type MetaOffline,
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
}

export type BancoOffline = IDBPDatabase<EsquemaOffline>;

const VERSAO = 1;
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
    upgrade(db) {
      db.createObjectStore("colonias", { keyPath: "id" });
      db.createObjectStore("avaliacoes", { keyPath: "id" }).createIndex("coloniaId", "coloniaId");
      db.createObjectStore("producoes", { keyPath: "id" }).createIndex("coloniaId", "coloniaId");
      db.createObjectStore("parametros", { keyPath: "id" });
      db.createObjectStore("especies", { keyPath: "id" });
      db.createObjectStore("meta");
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

// Aplica uma resposta do pull numa transação só: lê os ids locais, monta o plano
// (`mesclar`) e grava dados, exclusões, espécies (quando vierem) e o novo `desde`.
// Se qualquer escrita falhar, a transação aborta e nada muda.
// Dentro da transação não há `await` fora do IndexedDB (senão ela fecharia sozinha).
export async function aplicarPull(
  db: BancoOffline,
  resposta: RespostaAlteracoes,
  pendentes: ReadonlySet<string>,
  especies: Especie[] | null
): Promise<void> {
  const tx = db.transaction([...TIPOS_PULL, "especies", "meta"], "readwrite");
  const escritas: Promise<unknown>[] = [];
  try {
    const [colonias, avaliacoes, producoes, parametros, metaAtual] = await Promise.all([
      tx.objectStore("colonias").getAllKeys(),
      tx.objectStore("avaliacoes").getAllKeys(),
      tx.objectStore("producoes").getAllKeys(),
      tx.objectStore("parametros").getAllKeys(),
      tx.objectStore("meta").get(CHAVE_META),
    ]);
    const idsLocais: IdsPorTipo = { colonias, avaliacoes, producoes, parametros };
    const plano = mesclar(resposta, idsLocais, pendentes);

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

    const meta: MetaOffline = { ...META_VAZIA, ...metaAtual, desde: plano.desde, ultimoPull: new Date().toISOString() };
    escritas.push(tx.objectStore("meta").put(meta, CHAVE_META));

    await Promise.all([...escritas, tx.done]);
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
