import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp, criarColonia, idEspecie, novoUsuario, type Cliente } from "../helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});
afterAll(async () => {
  await app.close();
});

function colheita(api: Cliente, coloniaId: string, dados: Record<string, unknown>) {
  return api.post("/producoes", {
    coloniaId,
    dataColheita: "2026-03-10T12:00:00.000Z",
    tipoProduto: "mel",
    unidade: "ml",
    ...dados,
  });
}

describe("produção — registro", () => {
  it("registra colheita com características como objeto", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);
    const res = await colheita(api, c.id, { quantidade: 350, caracteristicas: { cor: "âmbar", aroma: "floral" } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      quantidade: 350,
      unidade: "ml",
      caracteristicas: { cor: "âmbar", aroma: "floral" },
      colonia: { id: c.id, codigo: c.codigo },
    });
  });

  it("valida quantidade, unidade e tipo (400)", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);
    expect((await colheita(api, c.id, { quantidade: 0 })).status).toBe(400);
    expect((await colheita(api, c.id, { quantidade: 10, unidade: "kg" })).status).toBe(400);
    expect((await colheita(api, c.id, { quantidade: 10, tipoProduto: "geleia" })).status).toBe(400);
  });

  it("não registra colheita em colônia de outro usuário (404)", async () => {
    const { api } = await novoUsuario(app);
    const outro = await novoUsuario(app);
    const alheia = await criarColonia(outro.api);
    expect((await colheita(api, alheia.id, { quantidade: 10 })).status).toBe(404);
  });

  it("filtra por colônia, tipo e período", async () => {
    const { api } = await novoUsuario(app);
    const a = await criarColonia(api);
    const b = await criarColonia(api);
    await colheita(api, a.id, { quantidade: 100, dataColheita: "2026-01-15T12:00:00.000Z" });
    await colheita(api, a.id, { quantidade: 200, dataColheita: "2026-04-15T12:00:00.000Z" });
    await colheita(api, a.id, { quantidade: 30, tipoProduto: "polen", unidade: "g" });
    await colheita(api, b.id, { quantidade: 50 });

    expect((await api.get(`/producoes?coloniaId=${a.id}`)).body).toHaveLength(3);
    expect((await api.get("/producoes?tipoProduto=polen")).body).toHaveLength(1);
    const periodo = await api.get("/producoes?desde=2026-04-01&ate=2026-04-30T23:59:59Z");
    expect(periodo.body.map((p: { quantidade: number }) => p.quantidade)).toEqual([200]);
  });

  it("atualiza e exclui", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);
    const p = (await colheita(api, c.id, { quantidade: 100 })).body;
    expect((await api.patch(`/producoes/${p.id}`, { quantidade: 120 })).body.quantidade).toBe(120);
    expect((await api.delete(`/producoes/${p.id}`)).status).toBe(204);
    expect((await api.get(`/producoes/${p.id}`)).status).toBe(404);
  });
});

describe("produção — resumo (metodologia)", () => {
  let api: Cliente;
  let a: { id: string; codigo: string };
  let b: { id: string; codigo: string };

  beforeAll(async () => {
    ({ api } = await novoUsuario(app));
    const jatai = await idEspecie(api, "TETRANGU");
    a = await criarColonia(api, { especieId: jatai });
    b = await criarColonia(api, { especieId: jatai });
    const semEspecie = await criarColonia(api);

    await colheita(api, a.id, { quantidade: 300 });
    await colheita(api, a.id, { quantidade: 100 });
    await colheita(api, b.id, { quantidade: 150 });
    await colheita(api, semEspecie.id, { quantidade: 50 });
    await colheita(api, a.id, { quantidade: 40, tipoProduto: "polen", unidade: "g" });
    // mesmo produto em unidade diferente: nunca somado com ml
    await colheita(api, b.id, { quantidade: 25, unidade: "g" });
  });

  it("agrupa por (tipo, unidade) e nunca soma ml com g", async () => {
    const { body } = await api.get("/producoes/resumo");
    const grupo = (tipo: string, unidade: string) =>
      body.grupos.find((g: { tipoProduto: string; unidade: string }) => g.tipoProduto === tipo && g.unidade === unidade);

    expect(body.grupos).toHaveLength(3);
    expect(grupo("mel", "ml")).toMatchObject({
      total: 600,
      colheitas: 4,
      mediaPorColheita: 150,
      coloniasProdutoras: 3,
      mediaPorColonia: 200,
    });
    expect(grupo("mel", "g")).toMatchObject({ total: 25, colheitas: 1 });
    expect(grupo("polen", "g")).toMatchObject({ total: 40, colheitas: 1 });
    expect(body.metodologia).toContain("não são somadas");
  });

  it("ranqueia colônias e aponta melhor e pior produtora", async () => {
    const { body } = await api.get("/producoes/resumo?tipoProduto=mel");
    const mel = body.grupos.find((g: { unidade: string }) => g.unidade === "ml");
    expect(mel.rankingColonias.map((r: { total: number }) => r.total)).toEqual([400, 150, 50]);
    expect(mel.melhorProdutora).toMatchObject({ coloniaId: a.id, total: 400, colheitas: 2 });
    expect(mel.piorProdutora.total).toBe(50);
  });

  it("totaliza por espécie, com colônias sem espécie em grupo próprio", async () => {
    const { body } = await api.get("/producoes/resumo");
    const mel = body.grupos.find((g: { tipoProduto: string; unidade: string }) => g.tipoProduto === "mel" && g.unidade === "ml");
    expect(mel.porEspecie).toEqual([
      expect.objectContaining({ especieCodigo: "TETRANGU", total: 550, colonias: 2, mediaPorColonia: 275 }),
      expect.objectContaining({ especieCodigo: null, total: 50, colonias: 1 }),
    ]);
  });

  it("pior produtora é null quando há uma só colônia no grupo", async () => {
    const { body } = await api.get("/producoes/resumo?tipoProduto=polen");
    expect(body.grupos[0].piorProdutora).toBeNull();
  });

  it("resumo de usuário sem colheitas vem vazio", async () => {
    const vazio = await novoUsuario(app);
    expect((await vazio.api.get("/producoes/resumo")).body.grupos).toEqual([]);
  });
});
