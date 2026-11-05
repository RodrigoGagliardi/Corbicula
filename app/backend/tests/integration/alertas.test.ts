import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp, criarAvaliacao, criarColonia, criarParametros, novoUsuario, type Cliente } from "../helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});
afterAll(async () => {
  await app.close();
});

type C = "bom" | "medio" | "ruim";
const DIA = 24 * 60 * 60 * 1000;
const haDias = (n: number) => new Date(Date.now() - n * DIA).toISOString();

interface Alerta {
  chave: string;
  tipo: string;
  gravidade: string;
  titulo: string;
  detalhe: string;
  resolvido: boolean;
  colonia: { id: string };
  dados: Record<string, unknown>;
}

async function contexto(nParametros = 3) {
  const { api } = await novoUsuario(app);
  const parametros = await criarParametros(api, nParametros);
  const avaliar = async (coloniaId: string, classes: C[], diasAtras = 0) => {
    const res = await criarAvaliacao(
      api,
      coloniaId,
      classes.map((classificacao, i) => ({ parametroId: parametros[i]!, classificacao })),
      { dataAvaliacao: haDias(diasAtras) }
    );
    if (res.status !== 201) throw new Error(`avaliação falhou: ${res.status} ${res.texto}`);
    return res.body as { id: string; scoreGeral: number };
  };
  const alertas = async (query = "") => (await api.get(`/alertas${query}`)).body as { alertas: Alerta[]; totais: Record<string, number>; criterios: Record<string, unknown> };
  const daColonia = async (coloniaId: string, query = "") => (await alertas(query)).alertas.filter((a) => a.colonia.id === coloniaId);
  return { api, avaliar, alertas, daColonia };
}

describe("alertas — cálculo", () => {
  it("colônia ativa sem inspeção gera 'nunca avaliada'; inativa e morta não geram nada", async () => {
    const { api, alertas } = await contexto();
    const ativa = await criarColonia(api); // entrada em 10/01/2026: a primeira inspeção já está atrasada
    await criarColonia(api, { status: "inativa" });
    await criarColonia(api, { status: "morta" });
    const { alertas: lista, totais } = await alertas();
    expect(lista).toHaveLength(1);
    // Mais de 2 × 30 dias desde a entrada → gravidade alta.
    expect(lista[0]).toMatchObject({ tipo: "nunca_avaliada", gravidade: "alta", chave: `nunca_avaliada:${ativa.id}` });
    expect(totais).toMatchObject({ abertos: 1, alta: 1, media: 0, resolvidos: 0 });
  });

  it("colônia recém-chegada só vira 'nunca avaliada' quando a primeira inspeção atrasa", async () => {
    const { api, daColonia } = await contexto();
    const nova = await criarColonia(api, { dataEntrada: haDias(10) });
    expect(await daColonia(nova.id)).toEqual([]);
    expect(await daColonia(nova.id, "?diasSemInspecao=7")).toMatchObject([
      { tipo: "nunca_avaliada", gravidade: "media", dados: { diasDesdeEntrada: 10, limite: 7 } },
    ]);
    await api.patch(`/colonias/${nova.id}`, { frequenciaInspecaoDias: 15 });
    expect(await daColonia(nova.id, "?diasSemInspecao=7")).toEqual([]);
  });

  it("inspeção atrasada usa a frequência da colônia e, sem ela, a preferência geral", async () => {
    const { api, avaliar, daColonia } = await contexto();
    const c = await criarColonia(api);
    await avaliar(c.id, ["bom", "bom", "bom"], 40);

    const [atrasada] = await daColonia(c.id);
    expect(atrasada).toMatchObject({ tipo: "sem_inspecao", gravidade: "media", titulo: "Sem inspeção há 40 dias" });
    expect(atrasada!.dados).toMatchObject({ dias: 40, limite: 30, frequenciaDaColonia: false });

    expect(await daColonia(c.id, "?diasSemInspecao=60")).toEqual([]);
    expect((await daColonia(c.id, "?diasSemInspecao=15"))[0]!.gravidade).toBe("alta"); // 40 > 2 × 15

    await api.patch(`/colonias/${c.id}`, { frequenciaInspecaoDias: 45 });
    expect(await daColonia(c.id, "?diasSemInspecao=15")).toEqual([]); // a frequência da colônia vence
  });

  it("score crítico é alerta de gravidade alta e lista os parâmetros Ruim (sem alerta duplicado por parâmetro)", async () => {
    const { api, avaliar, daColonia } = await contexto();
    const c = await criarColonia(api);
    const av = await avaliar(c.id, ["ruim", "ruim", "medio"]);
    expect(av.scoreGeral).toBe(17);
    const lista = await daColonia(c.id);
    expect(lista.map((a) => a.tipo)).toEqual(["score_baixo"]);
    expect(lista[0]).toMatchObject({ gravidade: "alta", chave: `score_baixo:${av.id}`, detalhe: "Ruim em: Parâmetro 1, Parâmetro 2." });
  });

  it("score em atenção é gravidade média", async () => {
    const { api, avaliar, daColonia } = await contexto();
    const c = await criarColonia(api);
    await avaliar(c.id, ["bom", "ruim", "medio"]); // 50
    expect(await daColonia(c.id)).toMatchObject([{ tipo: "score_baixo", gravidade: "media" }]);
  });

  it("parâmetro Ruim escondido num score bom gera alerta próprio", async () => {
    const { api, avaliar, daColonia } = await contexto(5);
    const c = await criarColonia(api);
    const av = await avaliar(c.id, ["bom", "bom", "bom", "bom", "ruim"]);
    expect(av.scoreGeral).toBe(80);
    expect(await daColonia(c.id)).toMatchObject([
      { tipo: "parametro_ruim", chave: `parametro_ruim:${av.id}`, titulo: "Ruim em Parâmetro 5" },
    ]);
  });

  it("queda de 20 pontos ou mais em relação à inspeção anterior", async () => {
    const { api, avaliar, daColonia } = await contexto();
    const queda = await criarColonia(api);
    await avaliar(queda.id, ["bom", "bom", "bom"], 10); // 100
    await avaliar(queda.id, ["bom", "medio", "medio"]); // 67
    expect(await daColonia(queda.id)).toMatchObject([
      { tipo: "queda_score", titulo: "Score caiu 33 pontos", dados: { anterior: 100, atual: 67 } },
    ]);

    const leve = await criarColonia(api);
    await avaliar(leve.id, ["bom", "bom", "bom"], 10); // 100
    await avaliar(leve.id, ["bom", "bom", "medio"]); // 83: queda de 17
    expect(await daColonia(leve.id)).toEqual([]);
  });

  it("só a última inspeção conta: um problema superado não gera alerta", async () => {
    const { api, avaliar, daColonia } = await contexto();
    const c = await criarColonia(api);
    await avaliar(c.id, ["ruim", "ruim", "ruim"], 5);
    await avaliar(c.id, ["bom", "bom", "bom"]);
    expect(await daColonia(c.id)).toEqual([]);
  });

  it("devolve os critérios usados e valida a consulta", async () => {
    const { api, alertas } = await contexto();
    const res = await alertas("?diasSemInspecao=20");
    expect(res.criterios).toMatchObject({ diasSemInspecao: 20, diasSemInspecaoPadrao: 30, quedaScoreMinima: 20 });
    expect((await api.get("/alertas?diasSemInspecao=0")).status).toBe(400);
    expect((await api.get("/alertas?diasSemInspecao=abc")).status).toBe(400);
  });
});

describe("alertas — resolver e reabrir", () => {
  it("resolvido some da lista, aparece com incluirResolvidos e pode ser reaberto", async () => {
    const { api, avaliar, alertas, daColonia } = await contexto();
    const c = await criarColonia(api);
    await avaliar(c.id, ["ruim", "ruim", "ruim"]);
    const [alerta] = await daColonia(c.id);

    expect((await api.post("/alertas/resolvidos", { chave: alerta!.chave })).status).toBe(204);
    expect((await api.post("/alertas/resolvidos", { chave: alerta!.chave })).status).toBe(204); // idempotente
    const depois = await alertas();
    expect(depois.alertas).toEqual([]);
    expect(depois.totais).toMatchObject({ abertos: 0, resolvidos: 1 });
    expect((await alertas("?incluirResolvidos=true")).alertas).toMatchObject([{ chave: alerta!.chave, resolvido: true }]);

    expect((await api.delete("/alertas/resolvidos", { chave: alerta!.chave })).status).toBe(204);
    expect((await alertas()).alertas).toMatchObject([{ chave: alerta!.chave, resolvido: false }]);
  });

  it("o mesmo problema numa inspeção nova gera um alerta novo", async () => {
    const { api, avaliar, daColonia } = await contexto();
    const c = await criarColonia(api);
    await avaliar(c.id, ["ruim", "ruim", "ruim"], 3);
    const [antigo] = await daColonia(c.id);
    await api.post("/alertas/resolvidos", { chave: antigo!.chave });
    expect(await daColonia(c.id)).toEqual([]);

    await avaliar(c.id, ["ruim", "ruim", "medio"]);
    const [novo] = await daColonia(c.id);
    expect(novo).toMatchObject({ tipo: "score_baixo", resolvido: false });
    expect(novo!.chave).not.toBe(antigo!.chave);
  });

  it("valida a chave e isola os usuários", async () => {
    const a = await contexto();
    const c = await criarColonia(a.api);
    const [alerta] = await a.daColonia(c.id);
    expect((await a.api.post("/alertas/resolvidos", { chave: "qualquer coisa" })).status).toBe(400);
    expect((await a.api.post("/alertas/resolvidos", { chave: "outro_tipo:" + c.id })).status).toBe(400);
    expect((await a.api.post("/alertas/resolvidos", {})).status).toBe(400);

    const b = await contexto();
    expect((await b.alertas()).alertas).toEqual([]); // não vê os alertas de A
    await b.api.post("/alertas/resolvidos", { chave: alerta!.chave });
    expect((await a.alertas()).alertas).toMatchObject([{ chave: alerta!.chave, resolvido: false }]); // B não resolve por A
  });

  it("excluir a conta apaga os alertas resolvidos junto (LGPD)", async () => {
    const { api, daColonia } = await contexto();
    const c = await criarColonia(api);
    const [alerta] = await daColonia(c.id);
    await api.post("/alertas/resolvidos", { chave: alerta!.chave });
    expect((await api.delete("/users/me", { senha: "senha123" })).status).toBe(204);
  });
});
