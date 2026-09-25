import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database";
import {
  criarApp,
  criarAvaliacao,
  criarColonia,
  criarParametros,
  novoUsuario,
  type Cliente,
} from "../helpers";

let app: FastifyInstance;
let api: Cliente;
let params: string[];
let coloniaId: string;

beforeAll(async () => {
  app = await criarApp();
  ({ api } = await novoUsuario(app));
  params = await criarParametros(api, 4);
  coloniaId = (await criarColonia(api)).id;
});
afterAll(async () => {
  await app.close();
});

const [bom, medio, ruim] = ["bom", "medio", "ruim"] as const;

describe("avaliações — score automático", () => {
  it("calcula score e status a partir das classificações", async () => {
    const res = await criarAvaliacao(api, coloniaId, [
      { parametroId: params[0]!, classificacao: bom },
      { parametroId: params[1]!, classificacao: bom },
      { parametroId: params[2]!, classificacao: medio },
      { parametroId: params[3]!, classificacao: ruim },
    ]);
    expect(res.status).toBe(201);
    // (2×100 + 1×50 + 0) / 4 = 62,5 → 63
    expect(res.body).toMatchObject({ scoreGeral: 63, statusGeral: "boa" });
    expect(res.body.parametros).toHaveLength(4);
  });

  it("ignora score/status enviados pelo cliente", async () => {
    const res = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: ruim }], {
      scoreGeral: 100,
      statusGeral: "excelente",
    });
    expect(res.body).toMatchObject({ scoreGeral: 0, statusGeral: "critica" });
  });

  it("preserva clima informado manualmente e ações tomadas", async () => {
    const res = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: bom }], {
      temperatura: 22.5,
      umidade: 70,
      condicaoClimatica: "nublado",
      acoesTomadas: ["alimentação", "troca de tampa"],
    });
    expect(res.body).toMatchObject({
      temperatura: 22.5,
      umidade: 70,
      condicaoClimatica: "nublado",
      acoesTomadas: ["alimentação", "troca de tampa"],
    });
  });
});

describe("avaliações — validações", () => {
  it("exige ao menos um parâmetro e não aceita parâmetro repetido (400)", async () => {
    expect((await criarAvaliacao(api, coloniaId, [])).status).toBe(400);
    const dup = await criarAvaliacao(api, coloniaId, [
      { parametroId: params[0]!, classificacao: bom },
      { parametroId: params[0]!, classificacao: ruim },
    ]);
    expect(dup.status).toBe(400);
  });

  it("recusa classificação fora de bom/medio/ruim (400)", async () => {
    const res = await api.post(`/colonias/${coloniaId}/avaliacoes`, {
      dataAvaliacao: "2026-02-01T10:00:00.000Z",
      parametros: [{ parametroId: params[0], classificacao: "otimo" }],
    });
    expect(res.status).toBe(400);
  });

  it("recusa parâmetro de outro usuário ou inativo (409)", async () => {
    const outro = await novoUsuario(app);
    const [alheio] = await criarParametros(outro.api, 1);
    expect((await criarAvaliacao(api, coloniaId, [{ parametroId: alheio!, classificacao: bom }])).status).toBe(409);

    const inativo = await api.post("/parametros", {
      nome: "Temporário",
      criterioBom: "b",
      criterioMedio: "m",
      criterioRuim: "r",
    });
    await api.patch(`/parametros/${inativo.body.id}`, { ativo: false });
    const res = await criarAvaliacao(api, coloniaId, [{ parametroId: inativo.body.id, classificacao: bom }]);
    expect(res.status).toBe(409);
  });

  it("não permite avaliar colônia de outro usuário (404)", async () => {
    const outro = await novoUsuario(app);
    const alheia = await criarColonia(outro.api);
    expect((await criarAvaliacao(api, alheia.id, [{ parametroId: params[0]!, classificacao: bom }])).status).toBe(404);
    expect((await api.get(`/colonias/${alheia.id}/avaliacoes`)).status).toBe(404);
  });
});

describe("avaliações — edição e exclusão", () => {
  it("recalcula o score ao substituir parâmetros e mantém o id dos parâmetros que ficaram", async () => {
    const criada = await criarAvaliacao(api, coloniaId, [
      { parametroId: params[0]!, classificacao: ruim },
      { parametroId: params[1]!, classificacao: ruim },
    ]);
    const idAntes = criada.body.parametros.find((p: { parametroId: string }) => p.parametroId === params[0]).id;

    const res = await api.patch(`/colonias/${coloniaId}/avaliacoes/${criada.body.id}`, {
      parametros: [
        { parametroId: params[0]!, classificacao: bom },
        { parametroId: params[2]!, classificacao: bom },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scoreGeral: 100, statusGeral: "excelente" });
    const ids = res.body.parametros.map((p: { parametroId: string }) => p.parametroId).sort();
    expect(ids).toEqual([params[0], params[2]].sort());
    expect(res.body.parametros.find((p: { parametroId: string }) => p.parametroId === params[0]).id).toBe(idAntes);
  });

  it("edição sem parâmetros não altera o score", async () => {
    const criada = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: medio }]);
    const res = await api.patch(`/colonias/${coloniaId}/avaliacoes/${criada.body.id}`, {
      observacoesGerais: "abelhas agitadas",
    });
    expect(res.body).toMatchObject({ scoreGeral: 50, observacoesGerais: "abelhas agitadas" });
  });

  it("bloqueia edição depois de 7 dias do registro (409)", async () => {
    const criada = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: bom }]);
    await prisma.avaliacao.update({
      where: { id: criada.body.id },
      data: { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });
    const res = await api.patch(`/colonias/${coloniaId}/avaliacoes/${criada.body.id}`, { observacoesGerais: "x" });
    expect(res.status).toBe(409);
  });

  it("lista em ordem da mais recente para a mais antiga", async () => {
    const c = await criarColonia(api);
    await criarAvaliacao(api, c.id, [{ parametroId: params[0]!, classificacao: bom }], {
      dataAvaliacao: "2026-01-01T10:00:00.000Z",
    });
    await criarAvaliacao(api, c.id, [{ parametroId: params[0]!, classificacao: bom }], {
      dataAvaliacao: "2026-03-01T10:00:00.000Z",
    });
    const res = await api.get(`/colonias/${c.id}/avaliacoes`);
    expect(res.body.map((a: { dataAvaliacao: string }) => a.dataAvaliacao)).toEqual([
      "2026-03-01T10:00:00.000Z",
      "2026-01-01T10:00:00.000Z",
    ]);
  });

  it("exclui a avaliação", async () => {
    const criada = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: bom }]);
    expect((await api.delete(`/colonias/${coloniaId}/avaliacoes/${criada.body.id}`)).status).toBe(204);
    expect((await api.get(`/colonias/${coloniaId}/avaliacoes/${criada.body.id}`)).status).toBe(404);
  });
});
