import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database";
import { enriquecerComClima } from "../../src/services/weather.service";
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

  it("na edição, aceita parâmetro que já estava na avaliação mesmo se desativado depois", async () => {
    // Usuário próprio: criarParametros repete os nomes, que são únicos por usuário.
    const { api: u } = await novoUsuario(app);
    const [p1, p2, p3] = await criarParametros(u, 3);
    const col = (await criarColonia(u)).id;
    const criada = await criarAvaliacao(u, col, [
      { parametroId: p1!, classificacao: bom },
      { parametroId: p2!, classificacao: bom },
    ]);
    expect((await u.patch(`/parametros/${p2}`, { ativo: false })).status).toBe(200);

    const res = await u.patch(`/colonias/${col}/avaliacoes/${criada.body.id}`, {
      parametros: [
        { parametroId: p1!, classificacao: bom },
        { parametroId: p2!, classificacao: ruim },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scoreGeral: 50, statusGeral: "atencao" });

    // Um parâmetro inativo que não estava na avaliação continua recusado.
    await u.patch(`/parametros/${p3}`, { ativo: false });
    const recusada = await u.patch(`/colonias/${col}/avaliacoes/${criada.body.id}`, {
      parametros: [{ parametroId: p3!, classificacao: bom }],
    });
    expect(recusada.status).toBe(409);
  });

  it("exclui a avaliação", async () => {
    const criada = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: bom }]);
    expect((await api.delete(`/colonias/${coloniaId}/avaliacoes/${criada.body.id}`)).status).toBe(204);
    expect((await api.get(`/colonias/${coloniaId}/avaliacoes/${criada.body.id}`)).status).toBe(404);
  });
});

describe("avaliações — histórico geral (GET /avaliacoes)", () => {
  // Usuário próprio para controlar exatamente o que aparece no histórico.
  let u: Cliente;
  let ps: string[];
  let colA: string;
  let colB: string;

  beforeAll(async () => {
    ({ api: u } = await novoUsuario(app));
    ps = await criarParametros(u, 2);
    colA = (await criarColonia(u)).id;
    colB = (await criarColonia(u)).id;
    // colA: jan (excelente), mar (crítica, p1 ruim); colB: fev (atenção, p1 médio)
    await criarAvaliacao(u, colA, [
      { parametroId: ps[0]!, classificacao: bom },
      { parametroId: ps[1]!, classificacao: bom },
    ], { dataAvaliacao: "2026-01-15T10:00:00.000Z" });
    await criarAvaliacao(u, colA, [
      { parametroId: ps[0]!, classificacao: ruim },
      { parametroId: ps[1]!, classificacao: ruim },
    ], { dataAvaliacao: "2026-03-15T10:00:00.000Z" });
    await criarAvaliacao(u, colB, [
      { parametroId: ps[0]!, classificacao: medio },
    ], { dataAvaliacao: "2026-02-15T10:00:00.000Z" });
  });

  const datas = (body: { dataAvaliacao: string }[]) => body.map((a) => a.dataAvaliacao.slice(0, 7));

  it("lista as avaliações de todas as colônias, da mais recente para a mais antiga, com a colônia", async () => {
    const res = await u.get("/avaliacoes");
    expect(res.status).toBe(200);
    expect(datas(res.body)).toEqual(["2026-03", "2026-02", "2026-01"]);
    expect(res.body[0]).toMatchObject({
      coloniaId: colA,
      colonia: { id: colA, codigo: expect.any(String) },
      _count: { parametros: 2 },
      acoesTomadas: [],
    });
  });

  it("filtra por colônia, status e período", async () => {
    expect(datas((await u.get(`/avaliacoes?coloniaId=${colB}`)).body)).toEqual(["2026-02"]);
    expect(datas((await u.get("/avaliacoes?status=excelente")).body)).toEqual(["2026-01"]);
    expect(datas((await u.get("/avaliacoes?desde=2026-02-01&ate=2026-02-28")).body)).toEqual(["2026-02"]);
  });

  it("filtra por parâmetro e classificação recebida", async () => {
    expect(datas((await u.get(`/avaliacoes?parametroId=${ps[1]}`)).body)).toEqual(["2026-03", "2026-01"]);
    expect(datas((await u.get(`/avaliacoes?parametroId=${ps[0]}&classificacao=medio`)).body)).toEqual(["2026-02"]);
  });

  it("não mostra avaliações de outros usuários e valida os filtros", async () => {
    expect((await api.get("/avaliacoes")).body.some((a: { coloniaId: string }) => a.coloniaId === colA)).toBe(false);
    expect((await u.get("/avaliacoes?status=otima")).status).toBe(400);
    expect((await u.get("/avaliacoes?coloniaId=nao-e-uuid")).status).toBe(400);
  });

  it("exige autenticação (401)", async () => {
    expect((await app.inject({ method: "GET", url: "/avaliacoes" })).statusCode).toBe(401);
  });
});

// ─── Dados de contexto (06/11/2026) ───────────────────────────────────────────

describe("avaliações — motivo da inspeção e das ações", () => {
  it("payload antigo: salva igual a hoje, com os campos novos nulos", async () => {
    const res = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: bom }], {
      acoesTomadas: ["alimentação"],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      acoesTomadas: ["alimentação"],
      motivoInspecao: null,
      motivoInspecaoDetalhe: null,
      motivosAcoes: null,
      climaFonte: null,
    });

    const editada = await api.patch(`/colonias/${coloniaId}/avaliacoes/${res.body.id}`, { observacoesGerais: "ok" });
    expect(editada.body).toMatchObject({ motivoInspecao: null, motivosAcoes: null, acoesTomadas: ["alimentação"] });
  });

  it("grava e devolve o motivo da inspeção e o motivo de cada ação como enviados", async () => {
    const res = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: medio }], {
      motivoInspecao: "problema_observado",
      motivoInspecaoDetalhe: "pouco voo na entrada",
      acoesTomadas: ["Alimentação artificial", "Limpeza realizada"],
      motivosAcoes: { "Alimentação artificial": "resposta_problema" },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      motivoInspecao: "problema_observado",
      motivoInspecaoDetalhe: "pouco voo na entrada",
      acoesTomadas: ["Alimentação artificial", "Limpeza realizada"],
      motivosAcoes: { "Alimentação artificial": "resposta_problema" },
    });
    const lida = await api.get(`/colonias/${coloniaId}/avaliacoes/${res.body.id}`);
    expect(lida.body.motivosAcoes).toEqual({ "Alimentação artificial": "resposta_problema" });
  });

  it("recusa (400) motivo de ação fora de acoesTomadas, código desconhecido ou motivo de inspeção inválido", async () => {
    const antes = await prisma.avaliacao.count({ where: { coloniaId } });
    const p = [{ parametroId: params[0]!, classificacao: bom }];

    expect((await criarAvaliacao(api, coloniaId, p, { acoesTomadas: ["A"], motivosAcoes: { B: "preventiva" } })).status).toBe(400);
    expect((await criarAvaliacao(api, coloniaId, p, { motivosAcoes: { A: "preventiva" } })).status).toBe(400);
    expect((await criarAvaliacao(api, coloniaId, p, { acoesTomadas: ["A"], motivosAcoes: { A: "urgente" } })).status).toBe(400);
    expect((await criarAvaliacao(api, coloniaId, p, { motivoInspecao: "curiosidade" })).status).toBe(400);

    expect(await prisma.avaliacao.count({ where: { coloniaId } })).toBe(antes);
  });

  it("na edição, confere os motivos contra as ações finais e descarta motivos de ações removidas", async () => {
    const criada = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: bom }], {
      acoesTomadas: ["A", "B"],
    });
    const url = `/colonias/${coloniaId}/avaliacoes/${criada.body.id}`;

    const comMotivo = await api.patch(url, {
      motivosAcoes: { A: "preventiva", B: "resposta_problema" },
      motivoInspecao: "rotina",
    });
    expect(comMotivo.status).toBe(200);
    expect(comMotivo.body).toMatchObject({
      motivosAcoes: { A: "preventiva", B: "resposta_problema" },
      motivoInspecao: "rotina",
    });

    expect((await api.patch(url, { motivosAcoes: { C: "preventiva" } })).status).toBe(400);

    const semB = await api.patch(url, { acoesTomadas: ["A"] });
    expect(semB.body).toMatchObject({ acoesTomadas: ["A"], motivosAcoes: { A: "preventiva" } });

    const semAcoes = await api.patch(url, { acoesTomadas: null });
    expect(semAcoes.body).toMatchObject({ acoesTomadas: [], motivosAcoes: null });
  });
});

describe("avaliações — procedência do clima", () => {
  // A Open-Meteo nunca é chamada de verdade: `fetch` é substituído. A colônia é
  // criada sem coordenadas (a criação não dispara o enriquecimento); as
  // coordenadas entram depois, direto no banco, e o enriquecimento é chamado
  // explicitamente, de forma determinística.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockOpenMeteo(quando: Date, temp: number, umid: number, code: number) {
    const hora = quando.toISOString().slice(0, 13);
    const fn = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({
        hourly: { time: [`${hora}:00`], temperature_2m: [temp], relative_humidity_2m: [umid], weather_code: [code] },
      }),
    }));
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  let coord = 0;
  async function avaliacaoComCoordenada(extra: Record<string, unknown> = {}) {
    const col = await criarColonia(api);
    const av = await criarAvaliacao(api, col.id, [{ parametroId: params[0]!, classificacao: bom }], extra);
    coord += 1;
    await prisma.colonia.update({
      where: { id: col.id },
      data: { latitude: -29 - coord / 100, longitude: -52 - coord / 100 },
    });
    return { coloniaId: col.id as string, id: av.body.id as string, body: av.body };
  }

  it("Forecast → api_previsao; Archive → api_historico", async () => {
    const recente = new Date(Date.now() - 60 * 60 * 1000);
    const a = await avaliacaoComCoordenada({ dataAvaliacao: recente.toISOString() });
    expect(a.body.climaFonte).toBeNull();
    const fetchPrevisao = mockOpenMeteo(recente, 21.3, 66, 0);
    await enriquecerComClima(a.id, a.coloniaId, recente);
    expect(String(fetchPrevisao.mock.calls[0]![0])).toContain("api.open-meteo.com/v1/forecast");
    expect((await api.get(`/colonias/${a.coloniaId}/avaliacoes/${a.id}`)).body).toMatchObject({
      temperatura: 21.3,
      umidade: 66,
      condicaoClimatica: "ensolarado",
      climaFonte: "api_previsao",
    });

    const antiga = new Date("2025-03-10T13:00:00.000Z");
    const b = await avaliacaoComCoordenada({ dataAvaliacao: antiga.toISOString() });
    const fetchArquivo = mockOpenMeteo(antiga, 18, 80, 61);
    await enriquecerComClima(b.id, b.coloniaId, antiga);
    expect(String(fetchArquivo.mock.calls[0]![0])).toContain("archive-api.open-meteo.com/v1/archive");
    expect((await api.get(`/colonias/${b.coloniaId}/avaliacoes/${b.id}`)).body).toMatchObject({
      condicaoClimatica: "chuvoso",
      climaFonte: "api_historico",
    });
  });

  it("clima informado na criação = digitado; a API não sobrescreve", async () => {
    const quando = new Date("2025-04-10T13:00:00.000Z");
    const a = await avaliacaoComCoordenada({ dataAvaliacao: quando.toISOString(), umidade: 70 });
    expect(a.body).toMatchObject({ umidade: 70, temperatura: null, climaFonte: "digitado" });

    mockOpenMeteo(quando, 10, 99, 61);
    await enriquecerComClima(a.id, a.coloniaId, quando);
    expect((await api.get(`/colonias/${a.coloniaId}/avaliacoes/${a.id}`)).body).toMatchObject({
      umidade: 70,
      temperatura: null,
      climaFonte: "digitado",
    });
  });

  it("valor da API editado vira digitado; reenviar o mesmo valor não muda; apagar tudo = nulo", async () => {
    const quando = new Date("2025-05-10T13:00:00.000Z");
    const a = await avaliacaoComCoordenada({ dataAvaliacao: quando.toISOString() });
    mockOpenMeteo(quando, 15, 75, 3);
    await enriquecerComClima(a.id, a.coloniaId, quando);
    const url = `/colonias/${a.coloniaId}/avaliacoes/${a.id}`;

    const mesmo = await api.patch(url, { temperatura: 15, condicaoClimatica: "nublado", observacoesGerais: "x" });
    expect(mesmo.body.climaFonte).toBe("api_historico");

    const editada = await api.patch(url, { temperatura: 17 });
    expect(editada.body).toMatchObject({ temperatura: 17, umidade: 75, climaFonte: "digitado" });

    const apagada = await api.patch(url, { temperatura: null, umidade: null, condicaoClimatica: null });
    expect(apagada.body.climaFonte).toBeNull();
  });

  it("sem clima (sem coordenadas), a procedência fica nula", async () => {
    const res = await criarAvaliacao(api, coloniaId, [{ parametroId: params[0]!, classificacao: bom }]);
    const lida = await api.get(`/colonias/${coloniaId}/avaliacoes/${res.body.id}`);
    expect(lida.body).toMatchObject({ temperatura: null, umidade: null, condicaoClimatica: null, climaFonte: null });
  });
});

describe("avaliações — protocolo", () => {
  const protocolo = (id: string) => prisma.protocolo.findUniqueOrThrow({ where: { id } });
  type Conteudo = { versao: number; itens: { nome: string; criterioBom: string }[] };
  const itens = (p: { conteudo: unknown }) => (p.conteudo as Conteudo).itens;

  it("mesmos parâmetros e critérios = mesmo protocolo; mudar só a classificação mantém", async () => {
    const { api: u } = await novoUsuario(app);
    const ps = await criarParametros(u, 2);
    const col = (await criarColonia(u)).id;
    const a1 = await criarAvaliacao(u, col, [
      { parametroId: ps[0]!, classificacao: bom },
      { parametroId: ps[1]!, classificacao: ruim },
    ]);
    const a2 = await criarAvaliacao(u, col, [
      { parametroId: ps[1]!, classificacao: medio },
      { parametroId: ps[0]!, classificacao: medio },
    ]);
    expect(a1.body.protocoloId).toEqual(expect.any(String));
    expect(a2.body.protocoloId).toBe(a1.body.protocoloId);

    const editada = await u.patch(`/colonias/${col}/avaliacoes/${a1.body.id}`, {
      parametros: [
        { parametroId: ps[0]!, classificacao: ruim },
        { parametroId: ps[1]!, classificacao: ruim },
      ],
    });
    expect(editada.body.protocoloId).toBe(a1.body.protocoloId);

    const p = await protocolo(a1.body.protocoloId);
    expect(p.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(p.conteudo).toEqual({ versao: 1, itens: [
      { nome: "Parâmetro 1", criterioBom: "bom", criterioMedio: "médio", criterioRuim: "ruim", especieCodigo: null },
      { nome: "Parâmetro 2", criterioBom: "bom", criterioMedio: "médio", criterioRuim: "ruim", especieCodigo: null },
    ] });
    expect(p.templateCodigo).toBeNull();
  });

  it("editar um critério não muda o protocolo gravado; a próxima avaliação recebe outro", async () => {
    const { api: u } = await novoUsuario(app);
    const ps = await criarParametros(u, 2);
    const col = (await criarColonia(u)).id;
    const classif = [
      { parametroId: ps[0]!, classificacao: bom },
      { parametroId: ps[1]!, classificacao: bom },
    ];
    const a1 = await criarAvaliacao(u, col, classif);

    expect((await u.patch(`/parametros/${ps[0]}`, { criterioBom: "20+ abelhas/min" })).status).toBe(200);
    const a2 = await criarAvaliacao(u, col, classif);

    expect(a2.body.protocoloId).not.toBe(a1.body.protocoloId);
    const p1 = await protocolo(a1.body.protocoloId);
    const p2 = await protocolo(a2.body.protocoloId);
    expect(itens(p1)[0]!.criterioBom).toBe("bom");
    expect(itens(p2)[0]!.criterioBom).toBe("20+ abelhas/min");
    expect((await u.get(`/colonias/${col}/avaliacoes/${a1.body.id}`)).body.protocoloId).toBe(a1.body.protocoloId);
  });

  it("mudar o conjunto avaliado na edição resolve outro protocolo; avaliação antiga sem protocolo continua sem", async () => {
    const { api: u } = await novoUsuario(app);
    const ps = await criarParametros(u, 3);
    const col = (await criarColonia(u)).id;
    const a = await criarAvaliacao(u, col, [{ parametroId: ps[0]!, classificacao: bom }]);
    const url = `/colonias/${col}/avaliacoes/${a.body.id}`;

    const outro = await u.patch(url, {
      parametros: [
        { parametroId: ps[0]!, classificacao: bom },
        { parametroId: ps[1]!, classificacao: bom },
      ],
    });
    expect(outro.body.protocoloId).not.toBe(a.body.protocoloId);
    expect(itens(await protocolo(outro.body.protocoloId))).toHaveLength(2);

    // Registro anterior à mudança: o protocolo nulo não é reconstituído.
    await prisma.avaliacao.update({ where: { id: a.body.id }, data: { protocoloId: null } });
    const mesmoConjunto = await u.patch(url, {
      parametros: [
        { parametroId: ps[0]!, classificacao: ruim },
        { parametroId: ps[1]!, classificacao: ruim },
      ],
    });
    expect(mesmoConjunto.body.protocoloId).toBeNull();
  });

  it("o hash não depende de ids nem da ordem: dois meliponários com os mesmos critérios", async () => {
    const criarNaOrdem = async (nomes: string[]) => {
      const { api: u } = await novoUsuario(app);
      const ids: Record<string, string> = {};
      for (const nome of nomes) {
        const res = await u.post("/parametros", {
          nome,
          criterioBom: `${nome} b`,
          criterioMedio: `${nome} m`,
          criterioRuim: `${nome} r`,
        });
        ids[nome] = res.body.id;
      }
      const col = (await criarColonia(u)).id;
      const av = await criarAvaliacao(u, col, nomes.map((n) => ({ parametroId: ids[n]!, classificacao: bom })));
      return protocolo(av.body.protocoloId);
    };
    const p1 = await criarNaOrdem(["Óleo", "abelhas", "Zangões"]);
    const p2 = await criarNaOrdem(["Zangões", "Óleo", "abelhas"]);
    expect(p1.id).not.toBe(p2.id);
    expect(p1.hash).toBe(p2.hash);
    expect(itens(p1).map((i) => i.nome)).toEqual(["abelhas", "Óleo", "Zangões"]);
  });

  it("usa o critério específico da espécie da colônia", async () => {
    const { api: u } = await novoUsuario(app);
    const ps = await criarParametros(u, 2);
    const jatai = await idEspecie(u, "TETRANGU");
    const override = await u.put(`/parametros/${ps[1]}/especies/${jatai}`, {
      criterioBom: "j bom",
      criterioMedio: "j médio",
      criterioRuim: "j ruim",
    });
    expect(override.status).toBeLessThan(300);

    const colJatai = (await criarColonia(u, { especieId: jatai })).id;
    const colSem = (await criarColonia(u)).id;
    const classif = [
      { parametroId: ps[0]!, classificacao: bom },
      { parametroId: ps[1]!, classificacao: bom },
    ];
    const comEspecie = await protocolo((await criarAvaliacao(u, colJatai, classif)).body.protocoloId);
    const generico = await protocolo((await criarAvaliacao(u, colSem, classif)).body.protocoloId);

    expect(comEspecie.conteudo).toEqual({ versao: 1, itens: [
      { nome: "Parâmetro 1", criterioBom: "bom", criterioMedio: "médio", criterioRuim: "ruim", especieCodigo: null },
      { nome: "Parâmetro 2", criterioBom: "j bom", criterioMedio: "j médio", criterioRuim: "j ruim", especieCodigo: "TETRANGU" },
    ] });
    expect(generico.hash).not.toBe(comEspecie.hash);
  });

  it("template Iniciante intacto, todos os parâmetros avaliados: origem e versão do template", async () => {
    const { api: u } = await novoUsuario(app);
    expect((await u.post("/parametros/templates/iniciante/aplicar", { modo: "mesclar" })).status).toBeLessThan(300);
    const ps = (await u.get("/parametros")).body as { id: string }[];
    expect(ps).toHaveLength(5);
    const col = (await criarColonia(u)).id;

    const todos = await criarAvaliacao(u, col, ps.map((p) => ({ parametroId: p.id, classificacao: bom })));
    expect(await protocolo(todos.body.protocoloId)).toMatchObject({ templateCodigo: "iniciante", templateVersao: 1 });

    // Só parte do template avaliada: não é o protocolo do template.
    const parte = await criarAvaliacao(u, col, ps.slice(0, 3).map((p) => ({ parametroId: p.id, classificacao: bom })));
    expect(await protocolo(parte.body.protocoloId)).toMatchObject({ templateCodigo: null, templateVersao: null });
  });
});
