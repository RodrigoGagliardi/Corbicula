import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  criarApp,
  criarAvaliacao,
  criarColonia,
  criarParametros,
  idEspecie,
  novoUsuario,
  type Cliente,
} from "../helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});
afterAll(async () => {
  await app.close();
});

describe("colônias — código automático (padrão Kew)", () => {
  it("gera [KEW]-[NNN] sequencial por espécie e COL-NNN sem espécie", async () => {
    const { api } = await novoUsuario(app);
    const jatai = await idEspecie(api, "TETRANGU");
    const mandacaia = await idEspecie(api, "MELIQUAD");

    expect((await criarColonia(api, { especieId: jatai })).codigo).toBe("TETRANGU-001");
    expect((await criarColonia(api, { especieId: jatai })).codigo).toBe("TETRANGU-002");
    expect((await criarColonia(api, { especieId: mandacaia })).codigo).toBe("MELIQUAD-001");
    expect((await criarColonia(api)).codigo).toBe("COL-001");
  });

  it("a sequência é por usuário", async () => {
    const a = await novoUsuario(app);
    const b = await novoUsuario(app);
    const jatai = await idEspecie(a.api, "TETRANGU");
    await criarColonia(a.api, { especieId: jatai });
    expect((await criarColonia(b.api, { especieId: jatai })).codigo).toBe("TETRANGU-001");
  });

  it("usa o maior sufixo existente (exclusões não causam colisão)", async () => {
    const { api } = await novoUsuario(app);
    const jatai = await idEspecie(api, "TETRANGU");
    await criarColonia(api, { especieId: jatai });
    const segunda = await criarColonia(api, { especieId: jatai });
    await criarColonia(api, { especieId: jatai });
    expect((await api.delete(`/colonias/${segunda.id}`)).status).toBe(204);
    expect((await criarColonia(api, { especieId: jatai })).codigo).toBe("TETRANGU-004");
  });

  it("recusa espécie inexistente (404)", async () => {
    const { api } = await novoUsuario(app);
    const res = await api.post("/colonias", {
      dataEntrada: "2026-01-10T12:00:00.000Z",
      origem: "compra",
      tipoCaixa: "INPA",
      especieId: randomUUID(),
    });
    expect(res.status).toBe(404);
  });
});

describe("colônias — genealogia", () => {
  let api: Cliente;
  beforeAll(async () => {
    ({ api } = await novoUsuario(app));
  });

  it("registra mãe/filha e mostra os dois lados da relação", async () => {
    const mae = await criarColonia(api);
    const filha = await criarColonia(api, { origem: "divisao", coloniaMaeId: mae.id });

    expect(filha.coloniaMae).toMatchObject({ id: mae.id, codigo: mae.codigo });
    const maeDetalhe = await api.get(`/colonias/${mae.id}`);
    expect(maeDetalhe.body.coloniasFilhas.map((f: { id: string }) => f.id)).toEqual([filha.id]);
  });

  it("uma colônia não pode ser mãe de si mesma (409)", async () => {
    const c = await criarColonia(api);
    expect((await api.patch(`/colonias/${c.id}`, { coloniaMaeId: c.id })).status).toBe(409);
  });

  it("não aceita mãe de outro usuário (404)", async () => {
    const outro = await novoUsuario(app);
    const maeAlheia = await criarColonia(outro.api);
    const res = await api.post("/colonias", {
      dataEntrada: "2026-01-10T12:00:00.000Z",
      origem: "divisao",
      tipoCaixa: "INPA",
      coloniaMaeId: maeAlheia.id,
    });
    expect(res.status).toBe(404);
  });

  it("remover a mãe com null desfaz o vínculo", async () => {
    const mae = await criarColonia(api);
    const filha = await criarColonia(api, { coloniaMaeId: mae.id });
    const res = await api.patch(`/colonias/${filha.id}`, { coloniaMaeId: null });
    expect(res.status).toBe(200);
    expect(res.body.coloniaMae).toBeNull();
  });
});

describe("colônias — CRUD e regras", () => {
  it("valida o payload (400 com detalhes por campo)", async () => {
    const { api } = await novoUsuario(app);
    const res = await api.post("/colonias", { dataEntrada: "ontem", origem: "roubo", tipoCaixa: "INPA" });
    expect(res.status).toBe(400);
    expect(res.body.detalhes.map((d: { campo: string }) => d.campo)).toEqual(
      expect.arrayContaining(["dataEntrada", "origem"])
    );
  });

  it("filtra por status", async () => {
    const { api } = await novoUsuario(app);
    await criarColonia(api);
    await criarColonia(api, { status: "morta" });
    const res = await api.get("/colonias?status=morta");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe("morta");
  });

  it("guarda dimensões da caixa como objeto", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api, { dimensoesCaixa: { altura: 10, largura: 20 } });
    expect(c.dimensoesCaixa).toEqual({ altura: 10, largura: 20 });
  });

  it("não permite excluir colônia com avaliações (preserva histórico científico)", async () => {
    const { api } = await novoUsuario(app);
    const [p1] = await criarParametros(api, 1);
    const c = await criarColonia(api);
    await criarAvaliacao(api, c.id, [{ parametroId: p1!, classificacao: "bom" }]);

    const res = await api.delete(`/colonias/${c.id}`);
    expect(res.status).toBe(409);
    expect((await api.get(`/colonias/${c.id}`)).status).toBe(200);
  });

  it("aceita id gerado no cliente e recusa id repetido (409)", async () => {
    const { api } = await novoUsuario(app);
    const id = randomUUID();
    const c = await criarColonia(api, { id });
    expect(c.id).toBe(id);

    const outro = await novoUsuario(app);
    const dup = await outro.api.post("/colonias", {
      id,
      dataEntrada: "2026-01-10T12:00:00.000Z",
      origem: "compra",
      tipoCaixa: "INPA",
    });
    expect(dup.status).toBe(409);
  });

  it("isola dados entre usuários", async () => {
    const dono = await novoUsuario(app);
    const intruso = await novoUsuario(app);
    const c = await criarColonia(dono.api);

    expect((await intruso.api.get(`/colonias/${c.id}`)).status).toBe(404);
    expect((await intruso.api.patch(`/colonias/${c.id}`, { status: "morta" })).status).toBe(404);
    expect((await intruso.api.delete(`/colonias/${c.id}`)).status).toBe(404);
    expect((await intruso.api.get("/colonias")).body).toEqual([]);
    expect((await dono.api.get(`/colonias/${c.id}`)).body.status).toBe("ativa");
  });
});
