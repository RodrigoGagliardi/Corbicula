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
    const filha = await criarColonia(api, { origem: "divisao", coloniaMaeId: mae.id });
    const res = await api.patch(`/colonias/${filha.id}`, { coloniaMaeId: null });
    expect(res.status).toBe(200);
    expect(res.body.coloniaMae).toBeNull();
  });

  it("filha sem espécie informada herda a espécie (e o código) da mãe", async () => {
    const jatai = await idEspecie(api, "TETRANGU");
    const mae = await criarColonia(api, { especieId: jatai });
    const filha = await criarColonia(api, { origem: "divisao", coloniaMaeId: mae.id });
    expect(filha.especieId).toBe(jatai);
    expect(filha.codigo).toMatch(/^TETRANGU-/);
  });

  it("divisão não muda de espécie: recusa filha de espécie diferente da mãe (409)", async () => {
    const jatai = await idEspecie(api, "TETRANGU");
    const mandacaia = await idEspecie(api, "MELIQUAD");
    const mae = await criarColonia(api, { especieId: jatai });

    const res = await api.post("/colonias", {
      dataEntrada: "2026-01-10T12:00:00.000Z",
      origem: "divisao",
      tipoCaixa: "INPA",
      especieId: mandacaia,
      coloniaMaeId: mae.id,
    });
    expect(res.status).toBe(409);

    const filha = await criarColonia(api, { origem: "divisao", coloniaMaeId: mae.id });
    expect((await api.patch(`/colonias/${filha.id}`, { especieId: mandacaia })).status).toBe(409);
    expect((await api.patch(`/colonias/${mae.id}`, { especieId: mandacaia })).status).toBe(409);

    const outra = await criarColonia(api, { especieId: mandacaia });
    expect((await api.patch(`/colonias/${outra.id}`, { origem: "divisao", coloniaMaeId: mae.id })).status).toBe(409);
  });

  it("colônia sem espécie identificada não restringe a da mãe/filha", async () => {
    const jatai = await idEspecie(api, "TETRANGU");
    const mae = await criarColonia(api);
    const filha = await criarColonia(api, { origem: "divisao", especieId: jatai, coloniaMaeId: mae.id });
    expect(filha.especieId).toBe(jatai);
    // identificar a mãe com a mesma espécie da filha é permitido
    expect((await api.patch(`/colonias/${mae.id}`, { especieId: jatai })).status).toBe(200);
  });

  it("recusa ciclos na genealogia (409)", async () => {
    const avo = await criarColonia(api);
    const mae = await criarColonia(api, { origem: "divisao", coloniaMaeId: avo.id });
    const filha = await criarColonia(api, { origem: "divisao", coloniaMaeId: mae.id });
    expect((await api.patch(`/colonias/${avo.id}`, { origem: "divisao", coloniaMaeId: filha.id })).status).toBe(409);
    expect((await api.patch(`/colonias/${mae.id}`, { coloniaMaeId: filha.id })).status).toBe(409);
  });

  it("só colônia de origem divisão tem mãe (409)", async () => {
    const mae = await criarColonia(api);
    const comprada = await api.post("/colonias", {
      dataEntrada: "2026-01-10T12:00:00.000Z",
      origem: "compra",
      tipoCaixa: "INPA",
      coloniaMaeId: mae.id,
    });
    expect(comprada.status).toBe(409);

    const filha = await criarColonia(api, { origem: "divisao", coloniaMaeId: mae.id });
    // trocar a origem exige desfazer o vínculo na mesma edição
    expect((await api.patch(`/colonias/${filha.id}`, { origem: "captura" })).status).toBe(409);
    const res = await api.patch(`/colonias/${filha.id}`, { origem: "captura", coloniaMaeId: null });
    expect(res.status).toBe(200);
    expect(res.body.coloniaMae).toBeNull();
  });

  it("filha não pode ter entrado antes da mãe (409); mesmo dia vale", async () => {
    const mae = await criarColonia(api, { dataEntrada: "2026-03-10T12:00:00.000Z" });
    const antes = await api.post("/colonias", {
      dataEntrada: "2026-03-09T12:00:00.000Z",
      origem: "divisao",
      tipoCaixa: "INPA",
      coloniaMaeId: mae.id,
    });
    expect(antes.status).toBe(409);

    const filha = await criarColonia(api, {
      dataEntrada: "2026-03-10T08:00:00.000Z",
      origem: "divisao",
      coloniaMaeId: mae.id,
    });
    // nem recuando a filha, nem adiantando a mãe
    expect((await api.patch(`/colonias/${filha.id}`, { dataEntrada: "2026-03-01T12:00:00.000Z" })).status).toBe(409);
    expect((await api.patch(`/colonias/${mae.id}`, { dataEntrada: "2026-03-20T12:00:00.000Z" })).status).toBe(409);
    expect((await api.patch(`/colonias/${mae.id}`, { dataEntrada: "2026-02-01T12:00:00.000Z" })).status).toBe(200);
  });
});

describe("colônias — espécie imutável", () => {
  let api: Cliente;
  beforeAll(async () => {
    ({ api } = await novoUsuario(app));
  });

  it("não permite trocar nem apagar a espécie depois de definida (409)", async () => {
    const jatai = await idEspecie(api, "TETRANGU");
    const mandacaia = await idEspecie(api, "MELIQUAD");
    const c = await criarColonia(api, { especieId: jatai });
    expect((await api.patch(`/colonias/${c.id}`, { especieId: mandacaia })).status).toBe(409);
    expect((await api.patch(`/colonias/${c.id}`, { especieId: null })).status).toBe(409);
    // reenviar a mesma espécie (formulário completo) não é troca
    expect((await api.patch(`/colonias/${c.id}`, { especieId: jatai, status: "inativa" })).status).toBe(200);
  });

  it("colônia sem espécie pode ser identificada uma vez e ganha o código da espécie", async () => {
    const jatai = await idEspecie(api, "TETRANGU");
    const mandacaia = await idEspecie(api, "MELIQUAD");
    const c = await criarColonia(api);
    expect(c.codigo).toMatch(/^COL-/);

    const res = await api.patch(`/colonias/${c.id}`, { especieId: jatai });
    expect(res.status).toBe(200);
    expect(res.body.codigo).toMatch(/^TETRANGU-\d{3}$/);
    expect((await api.patch(`/colonias/${c.id}`, { especieId: mandacaia })).status).toBe(409);
  });
});

describe("colônias — doadora de campeiras", () => {
  let api: Cliente;
  let jatai: string;
  beforeAll(async () => {
    ({ api } = await novoUsuario(app));
    jatai = await idEspecie(api, "TETRANGU");
  });

  const divisao = (dados: Record<string, unknown>) =>
    api.post("/colonias", { dataEntrada: "2026-05-10T12:00:00.000Z", origem: "divisao", tipoCaixa: "INPA", ...dados });

  it("registra a doadora e mostra os dois lados da relação", async () => {
    const mae = await criarColonia(api, { especieId: jatai });
    const doadora = await criarColonia(api, { especieId: jatai });
    const res = await divisao({ coloniaMaeId: mae.id, coloniaDoadoraCampeirasId: doadora.id });
    expect(res.status).toBe(201);
    expect(res.body.coloniaDoadoraCampeiras).toMatchObject({ id: doadora.id, codigo: doadora.codigo });

    const detalhe = await api.get(`/colonias/${doadora.id}`);
    expect(detalhe.body.coloniasReceptorasCampeiras.map((c: { id: string }) => c.id)).toEqual([res.body.id]);
  });

  it("é opcional e só vale para divisão, com outra colônia que não a mãe (409)", async () => {
    const mae = await criarColonia(api, { especieId: jatai });
    const doadora = await criarColonia(api, { especieId: jatai });
    expect((await divisao({ coloniaMaeId: mae.id })).status).toBe(201);
    expect((await divisao({ coloniaMaeId: mae.id, coloniaDoadoraCampeirasId: mae.id })).status).toBe(409);
    expect((await divisao({ origem: "captura", coloniaDoadoraCampeirasId: doadora.id })).status).toBe(409);
  });

  it("segue as regras da mãe: mesma espécie, já presente na data e do mesmo usuário", async () => {
    const mae = await criarColonia(api, { especieId: jatai });
    const mandacaia = await criarColonia(api, { especieId: await idEspecie(api, "MELIQUAD") });
    const posterior = await criarColonia(api, { especieId: jatai, dataEntrada: "2026-06-01T12:00:00.000Z" });
    const alheia = await criarColonia((await novoUsuario(app)).api);

    expect((await divisao({ coloniaMaeId: mae.id, coloniaDoadoraCampeirasId: mandacaia.id })).status).toBe(409);
    expect((await divisao({ coloniaMaeId: mae.id, coloniaDoadoraCampeirasId: posterior.id })).status).toBe(409);
    expect((await divisao({ coloniaMaeId: mae.id, coloniaDoadoraCampeirasId: alheia.id })).status).toBe(404);
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

  it("traz a avaliação mais recente (por data da inspeção) como ultimaAvaliacao", async () => {
    const { api } = await novoUsuario(app);
    const [p] = await criarParametros(api, 1);
    const c = await criarColonia(api);
    expect(c.ultimaAvaliacao).toBeNull();

    await criarAvaliacao(api, c.id, [{ parametroId: p!, classificacao: "ruim" }], {
      dataAvaliacao: "2026-03-01T10:00:00.000Z",
    });
    // registrada depois, mas com data de inspeção anterior
    await criarAvaliacao(api, c.id, [{ parametroId: p!, classificacao: "bom" }], {
      dataAvaliacao: "2026-02-01T10:00:00.000Z",
    });

    const esperado = { dataAvaliacao: "2026-03-01T10:00:00.000Z", scoreGeral: 0, statusGeral: "critica" };
    expect((await api.get(`/colonias/${c.id}`)).body.ultimaAvaliacao).toMatchObject(esperado);
    expect((await api.get("/colonias")).body[0].ultimaAvaliacao).toMatchObject(esperado);
    expect((await api.get("/colonias")).body[0]).not.toHaveProperty("avaliacoes");
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

describe("colônias — frequência de inspeção", () => {
  it("é opcional, aceita 1–365 dias e pode ser zerada com null", async () => {
    const { api } = await novoUsuario(app);
    const semFrequencia = await criarColonia(api);
    expect(semFrequencia.frequenciaInspecaoDias).toBeNull();

    const c = await criarColonia(api, { frequenciaInspecaoDias: 15 });
    expect(c.frequenciaInspecaoDias).toBe(15);
    expect((await api.patch(`/colonias/${c.id}`, { frequenciaInspecaoDias: 30 })).body.frequenciaInspecaoDias).toBe(30);
    expect((await api.patch(`/colonias/${c.id}`, { frequenciaInspecaoDias: null })).body.frequenciaInspecaoDias).toBeNull();

    for (const invalido of [0, 366, 7.5, "15"]) {
      expect((await api.patch(`/colonias/${c.id}`, { frequenciaInspecaoDias: invalido })).status).toBe(400);
    }
  });
});

describe("colônias — histórico de status (data e motivo)", () => {
  const historico = async (api: Cliente, id: string) => (await api.get(`/colonias/${id}`)).body.historicoStatus;

  it("criar uma colônia não gera entrada; os campos de status começam nulos", async () => {
    const { api } = await novoUsuario(app);
    const morta = await criarColonia(api, { status: "morta" });
    expect(morta).toMatchObject({ statusDesde: null, motivoStatus: null, motivoStatusDetalhe: null, historicoStatus: [] });
  });

  it("morte com motivo e data, depois de volta a ativa: duas entradas", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);

    const morta = await api.patch(`/colonias/${c.id}`, {
      status: "morta",
      motivoStatus: "fome_escassez",
      statusDesde: "2026-07-20T12:00:00.000Z",
    });
    expect(morta.status).toBe(200);
    expect(morta.body).toMatchObject({
      status: "morta",
      statusDesde: "2026-07-20T12:00:00.000Z",
      motivoStatus: "fome_escassez",
      motivoStatusDetalhe: null,
    });
    expect(morta.body.historicoStatus).toHaveLength(1);
    expect(morta.body.historicoStatus[0]).toMatchObject({
      statusAnterior: "ativa",
      statusNovo: "morta",
      dataPercebida: "2026-07-20T12:00:00.000Z",
      motivo: "fome_escassez",
    });

    const viva = await api.patch(`/colonias/${c.id}`, { status: "ativa", motivoStatus: "correcao_registro" });
    expect(viva.body).toMatchObject({ status: "ativa", motivoStatus: "correcao_registro" });
    expect(viva.body.historicoStatus.map((h: { statusAnterior: string; statusNovo: string }) => [h.statusAnterior, h.statusNovo]))
      .toEqual([["ativa", "morta"], ["morta", "ativa"]]);
  });

  it("status sem detalhes: data = agora, motivo nulo, uma entrada", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);
    const antes = Date.now();

    const res = await api.patch(`/colonias/${c.id}`, { status: "inativa" });

    expect(res.status).toBe(200);
    expect(res.body.motivoStatus).toBeNull();
    const desde = new Date(res.body.statusDesde).getTime();
    expect(desde).toBeGreaterThanOrEqual(antes - 1000);
    expect(desde).toBeLessThanOrEqual(Date.now() + 1000);
    expect(res.body.historicoStatus).toHaveLength(1);
    expect(res.body.historicoStatus[0]).toMatchObject({ statusNovo: "inativa", motivo: null, motivoDetalhe: null });
  });

  it("reenviar o mesmo status não cria entrada", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);
    await api.patch(`/colonias/${c.id}`, { status: "inativa" });
    await api.patch(`/colonias/${c.id}`, { status: "inativa", observacoes: "sem mudança" });
    expect(await historico(api, c.id)).toHaveLength(1);
  });

  it("corrigir motivo ou data sem mudar o status corrige a última entrada, sem criar outra", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);
    await api.patch(`/colonias/${c.id}`, { status: "morta", motivoStatus: "desconhecida" });

    const res = await api.patch(`/colonias/${c.id}`, {
      motivoStatus: "outro",
      motivoStatusDetalhe: "tempestade derrubou a caixa",
      statusDesde: "2026-08-01T12:00:00.000Z",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "morta",
      motivoStatus: "outro",
      motivoStatusDetalhe: "tempestade derrubou a caixa",
      statusDesde: "2026-08-01T12:00:00.000Z",
    });
    expect(res.body.historicoStatus).toHaveLength(1);
    expect(res.body.historicoStatus[0]).toMatchObject({
      statusNovo: "morta",
      motivo: "outro",
      motivoDetalhe: "tempestade derrubou a caixa",
      dataPercebida: "2026-08-01T12:00:00.000Z",
    });
  });

  it("motivo incompatível com o status ou desconhecido: 400 e nada gravado", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);

    expect((await api.patch(`/colonias/${c.id}`, { status: "inativa", motivoStatus: "frio" })).status).toBe(400);
    expect((await api.patch(`/colonias/${c.id}`, { status: "morta", motivoStatus: "venda_doacao" })).status).toBe(400);
    expect((await api.patch(`/colonias/${c.id}`, { status: "morta", motivoStatus: "raio" })).status).toBe(400);
    expect((await api.patch(`/colonias/${c.id}`, { status: "morta", statusDesde: "ontem" })).status).toBe(400);
    // Sem `status`, o motivo é conferido contra o status atual (ativa).
    expect((await api.patch(`/colonias/${c.id}`, { motivoStatus: "frio" })).status).toBe(400);

    const atual = (await api.get(`/colonias/${c.id}`)).body;
    expect(atual).toMatchObject({ status: "ativa", motivoStatus: null, statusDesde: null, historicoStatus: [] });

    // `outro` vale para qualquer status; os da lista valem para o status deles.
    expect((await api.patch(`/colonias/${c.id}`, { status: "inativa", motivoStatus: "outro" })).status).toBe(200);
    expect((await api.patch(`/colonias/${c.id}`, { status: "inativa", motivoStatus: "uniao" })).status).toBe(200);
    expect((await api.patch(`/colonias/${c.id}`, { status: "ativa", motivoStatus: "recuperada" })).status).toBe(200);
  });

  it("status ativa com motivo de morte: 400", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);
    await api.patch(`/colonias/${c.id}`, { status: "morta" });
    expect((await api.patch(`/colonias/${c.id}`, { status: "ativa", motivoStatus: "frio" })).status).toBe(400);
    expect((await api.get(`/colonias/${c.id}`)).body.status).toBe("morta");
  });
});

describe("colônias — correção sem histórico e validação da data", () => {
  it("colônia criada como morta: a correção cria a primeira entrada, com status anterior nulo", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api, { status: "morta" });

    const res = await api.patch(`/colonias/${c.id}`, {
      motivoStatus: "frio",
      statusDesde: "2026-06-10T12:00:00.000Z",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "morta", motivoStatus: "frio", statusDesde: "2026-06-10T12:00:00.000Z" });
    expect(res.body.historicoStatus).toHaveLength(1);
    expect(res.body.historicoStatus[0]).toMatchObject({
      statusAnterior: null,
      statusNovo: "morta",
      motivo: "frio",
      dataPercebida: "2026-06-10T12:00:00.000Z",
    });

    // A próxima correção corrige essa entrada (não cria outra) e o updatedAt registra a correção.
    const corrigida = await api.patch(`/colonias/${c.id}`, { motivoStatus: "fome_escassez" });
    expect(corrigida.body.historicoStatus).toHaveLength(1);
    const [entrada] = corrigida.body.historicoStatus;
    expect(entrada).toMatchObject({ motivo: "fome_escassez", dataPercebida: "2026-06-10T12:00:00.000Z" });
    expect(new Date(entrada.updatedAt).getTime()).toBeGreaterThan(new Date(entrada.createdAt).getTime());
  });

  it("recusa (400) statusDesde no futuro ou antes da entrada da colônia; aceita pequena diferença de relógio", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api); // entrada em 2026-01-10
    const futuro = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    expect((await api.patch(`/colonias/${c.id}`, { status: "morta", statusDesde: futuro })).status).toBe(400);
    expect((await api.patch(`/colonias/${c.id}`, { status: "morta", statusDesde: "2026-01-09T12:00:00.000Z" })).status).toBe(400);
    expect((await api.get(`/colonias/${c.id}`)).body).toMatchObject({ status: "ativa", historicoStatus: [] });

    const quaseAgora = new Date(Date.now() + 60 * 1000).toISOString();
    expect((await api.patch(`/colonias/${c.id}`, { status: "morta", statusDesde: quaseAgora })).status).toBe(200);
    // Mesmo dia da entrada vale.
    expect((await api.patch(`/colonias/${c.id}`, { statusDesde: "2026-01-10T08:00:00.000Z" })).status).toBe(200);
  });
});
