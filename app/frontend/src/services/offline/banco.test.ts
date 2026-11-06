import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { Especie } from "../../types/api";
import { abrirBanco, aplicarPull, atualizarMeta, lerMeta, nomeBanco, type BancoOffline } from "./banco";
import type { AvaliacaoServidor, ColoniaServidor, CriterioEspecieServidor, ParametroServidor, ProducaoServidor, RespostaAlteracoes } from "./tipos";

// IndexedDB real em memória (fake-indexeddb) no lugar do que o jsdom não tem.
// Cada teste usa um usuário próprio, portanto um banco próprio.

const SEM_PENDENCIAS = new Set<string>();

const colonia = (id: string, observacoes: string | null = null) => ({ id, codigo: id, observacoes }) as ColoniaServidor;
const avaliacao = (id: string, coloniaId: string) => ({ id, coloniaId, parametros: [] }) as unknown as AvaliacaoServidor;
const producao = (id: string, coloniaId: string) => ({ id, coloniaId }) as ProducaoServidor;
const criterio = (especieId: string, criterioBom: string) => ({ id: `crit-${especieId}`, especieId, criterioBom }) as CriterioEspecieServidor;
const parametro = (id: string, criteriosEspecie: CriterioEspecieServidor[] = []) => ({ id, nome: id, criteriosEspecie }) as ParametroServidor;
const especie = (id: string, nomePopular = id) => ({ id, codigo: id.toUpperCase(), nomePopular }) as Especie;

function resposta(parcial: Partial<RespostaAlteracoes> = {}): RespostaAlteracoes {
  return {
    servidorEm: "2026-11-05T10:00:00.000Z",
    desde: null,
    colonias: [],
    avaliacoes: [],
    producoes: [],
    parametros: [],
    idsAtuais: { colonias: [], avaliacoes: [], producoes: [], parametros: [] },
    ...parcial,
  };
}

const chaves = async (db: BancoOffline, store: "colonias" | "avaliacoes" | "producoes" | "parametros" | "especies") =>
  (await db.getAllKeys(store)).sort();

// Carga inicial comum: 3 colônias, 2 avaliações, 1 produção.
async function bancoCarregado(usuarioId: string) {
  const db = await abrirBanco(usuarioId);
  await aplicarPull(
    db,
    resposta({
      colonias: [colonia("c1"), colonia("c2"), colonia("c3")],
      avaliacoes: [avaliacao("a1", "c1"), avaliacao("a2", "c2")],
      producoes: [producao("p1", "c1")],
      idsAtuais: { colonias: ["c1", "c2", "c3"], avaliacoes: ["a1", "a2"], producoes: ["p1"], parametros: [] },
    }),
    SEM_PENDENCIAS,
    [especie("e1")]
  );
  return db;
}

describe("nomeBanco", () => {
  it("um banco por usuário: o nome carrega o id e não colide entre contas", () => {
    expect(nomeBanco("u1")).toBe("corbicula-offline-u1");
    expect(nomeBanco("u1")).not.toBe(nomeBanco("u2"));
  });
});

describe("banco local (IndexedDB)", () => {
  it("cria os stores e o índice coloniaId; meta começa vazia", async () => {
    const db = await abrirBanco("estrutura");
    expect(db.name).toBe("corbicula-offline-estrutura");
    expect([...db.objectStoreNames].sort()).toEqual(["avaliacoes", "colonias", "especies", "meta", "parametros", "producoes"]);

    const tx = db.transaction(["avaliacoes", "producoes"]);
    expect([...tx.objectStore("avaliacoes").indexNames]).toEqual(["coloniaId"]);
    expect([...tx.objectStore("producoes").indexNames]).toEqual(["coloniaId"]);
    await tx.done;

    expect(await lerMeta(db)).toEqual({ desde: null, ultimoPull: null, armazenamentoPersistente: null });
    expect(await abrirBanco("estrutura")).toBe(db);
  });

  it("carga inicial: grava todos os stores, as espécies e o desde = servidorEm", async () => {
    const db = await bancoCarregado("carga");

    expect(await chaves(db, "colonias")).toEqual(["c1", "c2", "c3"]);
    expect(await chaves(db, "avaliacoes")).toEqual(["a1", "a2"]);
    expect(await chaves(db, "producoes")).toEqual(["p1"]);
    expect(await chaves(db, "especies")).toEqual(["e1"]);
    expect((await db.getAllFromIndex("avaliacoes", "coloniaId", "c1")).map((a) => a.id)).toEqual(["a1"]);
    expect((await db.getAllFromIndex("producoes", "coloniaId", "c1")).map((p) => p.id)).toEqual(["p1"]);

    const meta = await lerMeta(db);
    expect(meta.desde).toBe("2026-11-05T10:00:00.000Z");
    expect(meta.ultimoPull).toEqual(expect.any(String));
  });

  it("incremental: grava o que mudou e remove o que saiu de idsAtuais, por tipo", async () => {
    const db = await bancoCarregado("incremental");

    await aplicarPull(
      db,
      resposta({
        servidorEm: "2026-11-06T00:00:00.000Z",
        desde: "2026-11-05T10:00:00.000Z",
        colonias: [colonia("c1", "editada em outro dispositivo")],
        idsAtuais: { colonias: ["c1", "c3"], avaliacoes: ["a1"], producoes: [], parametros: [] },
      }),
      SEM_PENDENCIAS,
      null
    );

    expect(await chaves(db, "colonias")).toEqual(["c1", "c3"]);
    expect((await db.get("colonias", "c1"))?.observacoes).toBe("editada em outro dispositivo");
    expect(await chaves(db, "avaliacoes")).toEqual(["a1"]);
    expect(await chaves(db, "producoes")).toEqual([]);
    // Sem espécies na chamada, o catálogo local fica como estava.
    expect(await chaves(db, "especies")).toEqual(["e1"]);
    expect((await lerMeta(db)).desde).toBe("2026-11-06T00:00:00.000Z");
  });

  it("pendência protegida: registro pendente não é sobrescrito nem removido", async () => {
    const db = await bancoCarregado("pendencia");

    await aplicarPull(
      db,
      resposta({
        servidorEm: "2026-11-06T00:00:00.000Z",
        colonias: [colonia("c1", "versão do servidor"), colonia("c2", "versão do servidor")],
        // c3 e a2 excluídas no servidor; a2 tem pendência local
        idsAtuais: { colonias: ["c1", "c2"], avaliacoes: ["a1"], producoes: ["p1"], parametros: [] },
      }),
      new Set(["c1", "c3", "a2"]),
      null
    );

    expect((await db.get("colonias", "c1"))?.observacoes).toBeNull();
    expect((await db.get("colonias", "c2"))?.observacoes).toBe("versão do servidor");
    expect(await chaves(db, "colonias")).toEqual(["c1", "c2", "c3"]);
    expect(await chaves(db, "avaliacoes")).toEqual(["a1", "a2"]);
  });

  it("parâmetros: a lista aninhada de critérios por espécie é substituída e o parâmetro excluído sai", async () => {
    const db = await abrirBanco("parametros");
    await aplicarPull(
      db,
      resposta({
        parametros: [parametro("par1", [criterio("e1", "jataí"), criterio("e2", "mandaçaia")]), parametro("par2")],
        idsAtuais: { colonias: [], avaliacoes: [], producoes: [], parametros: ["par1", "par2"] },
      }),
      SEM_PENDENCIAS,
      null
    );
    expect((await db.get("parametros", "par1"))?.criteriosEspecie.map((c) => c.especieId)).toEqual(["e1", "e2"]);

    await aplicarPull(
      db,
      resposta({
        servidorEm: "2026-11-06T00:00:00.000Z",
        parametros: [parametro("par1", [criterio("e1", "jataí v2")])],
        idsAtuais: { colonias: [], avaliacoes: [], producoes: [], parametros: ["par1"] },
      }),
      SEM_PENDENCIAS,
      null
    );

    expect(await chaves(db, "parametros")).toEqual(["par1"]);
    expect((await db.get("parametros", "par1"))?.criteriosEspecie).toEqual([criterio("e1", "jataí v2")]);
  });

  it("espécies recebidas substituem o catálogo local por inteiro", async () => {
    const db = await bancoCarregado("especies");

    await aplicarPull(db, resposta({ idsAtuais: { colonias: ["c1", "c2", "c3"], avaliacoes: ["a1", "a2"], producoes: ["p1"], parametros: [] } }), SEM_PENDENCIAS, [
      especie("e2", "Jataí"),
      especie("e3"),
    ]);

    expect(await chaves(db, "especies")).toEqual(["e2", "e3"]);
    expect((await db.get("especies", "e2"))?.nomePopular).toBe("Jataí");
  });

  it("um pull preserva meta.armazenamentoPersistente", async () => {
    const db = await abrirBanco("persistencia");
    await atualizarMeta(db, { armazenamentoPersistente: true });

    await aplicarPull(db, resposta(), SEM_PENDENCIAS, null);

    expect(await lerMeta(db)).toMatchObject({ armazenamentoPersistente: true, desde: "2026-11-05T10:00:00.000Z" });
  });

  it("rollback: se uma escrita falha, nada muda (nem o desde)", async () => {
    const db = await bancoCarregado("rollback");
    const antes = await lerMeta(db);

    const invalida = { codigo: "sem-id" } as ColoniaServidor; // sem a chave `id`: o IndexedDB recusa
    await expect(
      aplicarPull(
        db,
        resposta({
          servidorEm: "2027-01-01T00:00:00.000Z",
          colonias: [colonia("c9"), colonia("c1", "não deveria gravar"), invalida],
          idsAtuais: { colonias: ["c1", "c9"], avaliacoes: [], producoes: [], parametros: [] },
        }),
        SEM_PENDENCIAS,
        [especie("e9")]
      )
    ).rejects.toBeTruthy();

    expect(await chaves(db, "colonias")).toEqual(["c1", "c2", "c3"]);
    expect((await db.get("colonias", "c1"))?.observacoes).toBeNull();
    expect(await chaves(db, "avaliacoes")).toEqual(["a1", "a2"]);
    expect(await chaves(db, "producoes")).toEqual(["p1"]);
    expect(await chaves(db, "especies")).toEqual(["e1"]);
    expect(await lerMeta(db)).toEqual(antes);
  });

  it("dois usuários ficam em bancos separados", async () => {
    const db1 = await bancoCarregado("usuario-a");
    const db2 = await abrirBanco("usuario-b");

    expect(db1).not.toBe(db2);
    expect(db2.name).toBe("corbicula-offline-usuario-b");
    expect(await db2.count("colonias")).toBe(0);
    expect(await lerMeta(db2)).toEqual({ desde: null, ultimoPull: null, armazenamentoPersistente: null });

    await aplicarPull(db2, resposta({ colonias: [colonia("b1")], idsAtuais: { colonias: ["b1"], avaliacoes: [], producoes: [], parametros: [] } }), SEM_PENDENCIAS, null);

    expect(await chaves(db1, "colonias")).toEqual(["c1", "c2", "c3"]);
    expect(await chaves(db2, "colonias")).toEqual(["b1"]);
  });
});
