import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database";
import {
  COLUNAS_AVALIACOES,
  COLUNAS_COLONIAS,
  COLUNAS_HISTORICO_STATUS,
  COLUNAS_PRODUCOES,
} from "../../src/modules/exportacao/exportacao.service";
import {
  criarApp,
  criarAvaliacao,
  criarColonia,
  criarParametros,
  formFoto,
  idEspecie,
  novoUsuario,
  type Cliente,
} from "../helpers";

// Parser CSV mínimo (RFC 4180) só para os testes: lê de volta o que o app exporta,
// como R/pandas fariam, e devolve objetos {coluna: valor}.
function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]!;
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === ",") {
      linha.push(campo);
      campo = "";
    } else if (ch === "\r" && texto[i + 1] === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
      i++;
    } else campo += ch;
  }
  const [cabecalho, ...dados] = linhas;
  return dados.map((l) => Object.fromEntries(cabecalho!.map((c, j) => [c, l[j]!])));
}

let app: FastifyInstance;
let api: Cliente;
let params: string[];
let colA: { id: string; codigo: string };
let colB: { id: string; codigo: string };
let avJan: string;

beforeAll(async () => {
  app = await criarApp();
  ({ api } = await novoUsuario(app));
  params = await criarParametros(api, 3);
  const jatai = await idEspecie(api, "TETRANGU");
  colA = await criarColonia(api, { especieId: jatai, latitude: -30.03, longitude: -51.22 });
  colB = await criarColonia(api, { status: "morta", origem: "divisao", coloniaMaeId: colA.id });

  avJan = (
    await criarAvaliacao(
      api,
      colA.id,
      [
        { parametroId: params[0]!, classificacao: "bom" },
        { parametroId: params[1]!, classificacao: "medio" },
        { parametroId: params[2]!, classificacao: "ruim" },
      ],
      {
        dataAvaliacao: "2026-01-10T09:00:00.000Z",
        temperatura: 24.5,
        umidade: 65,
        condicaoClimatica: "ensolarado",
        acoesTomadas: ["alimentação", "limpeza"],
        observacoesGerais: 'rainha vista, "postura boa"',
      }
    )
  ).body.id;
  await criarAvaliacao(api, colB.id, [{ parametroId: params[0]!, classificacao: "ruim" }], {
    dataAvaliacao: "2026-05-10T09:00:00.000Z",
    temperatura: 12,
    umidade: 90,
    condicaoClimatica: "chuvoso",
  });

  const prod = await api.post("/producoes", {
    coloniaId: colA.id,
    dataColheita: "2026-03-01T12:00:00.000Z",
    tipoProduto: "mel",
    quantidade: 350.5,
    unidade: "ml",
    caracteristicas: { cor: "âmbar, claro", aroma: "floral" },
  });
  await api.post("/fotos", formFoto({ producaoId: prod.body.id }));
});
afterAll(async () => {
  await app.close();
});

describe("exportação — avaliações (formato longo)", () => {
  it("uma linha por avaliação × parâmetro, com as colunas documentadas", async () => {
    const res = await api.get("/exportacao/avaliacoes");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="corbicula_avaliacoes_\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.texto.split("\r\n")[0]).toBe(COLUNAS_AVALIACOES.join(","));

    const linhas = lerCsv(res.texto);
    expect(linhas).toHaveLength(4); // 3 parâmetros + 1 parâmetro
    const jan = linhas.filter((l) => l["avaliacao_id"] === avJan);
    expect(jan).toHaveLength(3);
    expect(jan.map((l) => [l["classificacao"], l["classificacao_pontos"]])).toEqual([
      ["bom", "100"],
      ["medio", "50"],
      ["ruim", "0"],
    ]);
    expect(jan[0]).toMatchObject({
      colonia_codigo: "TETRANGU-001",
      especie_codigo: "TETRANGU",
      data_avaliacao: "2026-01-10T09:00:00.000Z",
      temperatura_c: "24.5",
      umidade_pct: "65",
      score_geral: "50",
      status_geral: "atencao",
      n_parametros: "3",
      acoes_tomadas: "alimentação | limpeza",
      observacoes_gerais: 'rainha vista, "postura boa"',
      duracao_minutos: "",
    });
  });

  it("filtra por período e colônia", async () => {
    const periodo = lerCsv((await api.get("/exportacao/avaliacoes?desde=2026-04-01")).texto);
    expect(periodo).toHaveLength(1);
    expect(periodo[0]!["colonia_id"]).toBe(colB.id);

    const porColonia = lerCsv((await api.get(`/exportacao/avaliacoes?coloniaId=${colA.id}`)).texto);
    expect(new Set(porColonia.map((l) => l["colonia_id"]))).toEqual(new Set([colA.id]));

    const criticas = lerCsv((await api.get("/exportacao/avaliacoes?status=critica")).texto);
    expect(criticas).toHaveLength(1);
    expect(criticas[0]).toMatchObject({ colonia_id: colB.id, status_geral: "critica" });
  });

  it("JSON traz metadados, filtros e a metodologia do score", async () => {
    const res = await api.get("/exportacao/avaliacoes?formato=json&desde=2026-01-01");
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body.metadados).toMatchObject({
      fonte: "Corbicula",
      recurso: "avaliacoes",
      totalRegistros: 4,
      metodologia: { classificacaoPontos: { bom: 100, medio: 50, ruim: 0 } },
    });
    expect(res.body.metadados.metodologia.score).toContain("n_bom × 100");
    expect(res.body.metadados.metodologia.clima).toContain("CC BY 4.0");
    expect(res.body.dados).toHaveLength(4);
  });

  it("recusa formato desconhecido (400)", async () => {
    expect((await api.get("/exportacao/avaliacoes?formato=xlsx")).status).toBe(400);
  });
});

describe("exportação — colônias e produções", () => {
  it("colônias: colunas documentadas, genealogia e filtro por status", async () => {
    const res = await api.get("/exportacao/colonias");
    expect(res.texto.split("\r\n")[0]).toBe(COLUNAS_COLONIAS.join(","));
    const linhas = lerCsv(res.texto);
    const filha = linhas.find((l) => l["colonia_id"] === colB.id)!;
    expect(filha).toMatchObject({ colonia_mae_codigo: "TETRANGU-001", status: "morta", n_avaliacoes: "1" });
    expect(linhas.find((l) => l["colonia_id"] === colA.id)).toMatchObject({ latitude: "-30.03", n_producoes: "1" });

    expect(lerCsv((await api.get("/exportacao/colonias?status=morta")).texto)).toHaveLength(1);
  });

  it("produções: escapa vírgulas e decompõe características em colunas", async () => {
    const res = await api.get("/exportacao/producoes");
    expect(res.texto.split("\r\n")[0]).toBe(COLUNAS_PRODUCOES.join(","));
    expect(res.texto).toContain('"âmbar, claro"');
    expect(lerCsv(res.texto)[0]).toMatchObject({
      quantidade: "350.5",
      unidade: "ml",
      cor: "âmbar, claro",
      aroma: "floral",
      sabor: "",
      n_fotos: "1",
    });
  });
});

describe("exportação — backup completo", () => {
  it("contém todos os dados do usuário, com JSON parseado e sem senha", async () => {
    const res = await api.get("/exportacao/backup");
    expect(res.headers["content-disposition"]).toMatch(/corbicula_backup_.*\.json/);
    const b = res.body;
    expect(b.metadados.recurso).toBe("backup");
    expect(b.colonias).toHaveLength(2);
    expect(b.avaliacoes).toHaveLength(2);
    expect(b.avaliacoes.find((a: { id: string }) => a.id === avJan).acoesTomadas).toEqual(["alimentação", "limpeza"]);
    expect(b.producoes[0].caracteristicas).toEqual({ cor: "âmbar, claro", aroma: "floral" });
    expect(b.parametros).toHaveLength(3);
    expect(b.fotos).toHaveLength(1);
    expect(res.texto).not.toMatch(/password|senha123|\$2[aby]\$/);
  });

  it("não inclui dados de outros usuários", async () => {
    const outro = await novoUsuario(app);
    const b = (await outro.api.get("/exportacao/backup")).body;
    expect(b.colonias).toEqual([]);
    expect(b.avaliacoes).toEqual([]);
    expect(b.producoes).toEqual([]);
    expect(b.fotos).toEqual([]);
    expect(lerCsv((await outro.api.get("/exportacao/avaliacoes")).texto)).toEqual([]);
  });
});

describe("exportação — dados de desfecho e contexto", () => {
  let u: Cliente;
  let ps: string[];
  let morta: { id: string; codigo: string };
  let viva: { id: string; codigo: string };
  let avContexto: string;
  let avAntiga: string;
  let avDepois: string;

  beforeAll(async () => {
    ({ api: u } = await novoUsuario(app));
    ps = await criarParametros(u, 2);
    morta = await criarColonia(u);
    viva = await criarColonia(u);

    // 1. Perda com data percebida e motivo.
    await u.patch(`/colonias/${morta.id}`, {
      status: "morta",
      statusDesde: "2026-06-15T12:00:00.000Z",
      motivoStatus: "fome_escassez",
    });
    // Saída do manejo (censura) e volta.
    await u.patch(`/colonias/${viva.id}`, { status: "inativa", motivoStatus: "venda_doacao", statusDesde: "2026-07-01T12:00:00.000Z" });
    await u.patch(`/colonias/${viva.id}`, { status: "ativa", motivoStatus: "correcao_registro", statusDesde: "2026-07-02T12:00:00.000Z" });

    const classif = [
      { parametroId: ps[0]!, classificacao: "bom" as const },
      { parametroId: ps[1]!, classificacao: "ruim" as const },
    ];
    // Registro "antigo": sem nenhum dos campos novos (protocolo apagado como antes da migration).
    avAntiga = (await criarAvaliacao(u, viva.id, classif, { dataAvaliacao: "2026-05-01T10:00:00.000Z" })).body.id;
    await prisma.avaliacao.update({ where: { id: avAntiga }, data: { protocoloId: null } });

    // 2. Inspeção porque algo chamou atenção, com alimentação como resposta.
    avContexto = (
      await criarAvaliacao(u, viva.id, classif, {
        dataAvaliacao: "2026-07-10T10:00:00.000Z",
        motivoInspecao: "problema_observado",
        temperatura: 19,
        acoesTomadas: ["Alimentação artificial", "Limpeza realizada"],
        motivosAcoes: { "Alimentação artificial": "resposta_problema" },
      })
    ).body.id;

    // 3. Critério editado: a próxima inspeção tem outro protocolo.
    await u.patch(`/parametros/${ps[0]}`, { criterioBom: "critério novo" });
    avDepois = (await criarAvaliacao(u, viva.id, classif, { dataAvaliacao: "2026-07-20T10:00:00.000Z" })).body.id;
  });

  it("colônias: status_desde, motivo e classe; colônias sem mudança ficam vazias", async () => {
    const res = await u.get("/exportacao/colonias");
    expect(res.texto.split("\r\n")[0]).toBe(COLUNAS_COLONIAS.join(","));
    const linhas = lerCsv(res.texto);
    expect(linhas.find((l) => l["colonia_id"] === morta.id)).toMatchObject({
      status: "morta",
      status_desde: "2026-06-15T12:00:00.000Z",
      motivo_status: "fome_escassez",
      classe_motivo_status: "evento",
    });
    expect(linhas.find((l) => l["colonia_id"] === viva.id)).toMatchObject({
      status: "ativa",
      motivo_status: "correcao_registro",
      classe_motivo_status: "",
    });

    // Colônia de outro arquivo/usuário sem mudança: campos vazios.
    const sem = lerCsv((await api.get("/exportacao/colonias")).texto).find((l) => l["colonia_id"] === colA.id)!;
    expect(sem).toMatchObject({ status_desde: "", motivo_status: "", motivo_status_detalhe: "", classe_motivo_status: "" });
  });

  it("avaliações: motivo da inspeção, motivos das ações, procedência do clima e protocolo", async () => {
    const res = await u.get("/exportacao/avaliacoes");
    expect(res.texto.split("\r\n")[0]).toBe(COLUNAS_AVALIACOES.join(","));
    const linhas = lerCsv(res.texto);
    const porAvaliacao = (id: string) => linhas.find((l) => l["avaliacao_id"] === id)!;

    const ctx = porAvaliacao(avContexto);
    expect(ctx).toMatchObject({
      motivo_inspecao: "problema_observado",
      clima_fonte: "digitado",
      acoes_tomadas: "Alimentação artificial | Limpeza realizada",
      motivos_acoes: "resposta_problema | ",
    });
    expect(ctx["protocolo_hash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(porAvaliacao(avDepois)["protocolo_hash"]).toMatch(/^[0-9a-f]{64}$/);
    expect(porAvaliacao(avDepois)["protocolo_hash"]).not.toBe(ctx["protocolo_hash"]);
    expect(porAvaliacao(avDepois)["motivos_acoes"]).toBe("");

    expect(porAvaliacao(avAntiga)).toMatchObject({
      motivo_inspecao: "",
      motivo_inspecao_detalhe: "",
      clima_fonte: "",
      protocolo_hash: "",
      motivos_acoes: "",
    });
  });

  it("histórico de status em CSV e JSON, com classe evento/censura", async () => {
    const res = await u.get("/exportacao/historico-status");
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/corbicula_historico-status_.*\.csv/);
    expect(res.texto.split("\r\n")[0]).toBe(COLUNAS_HISTORICO_STATUS.join(","));
    const linhas = lerCsv(res.texto);
    expect(linhas.map((l) => [l["colonia_codigo"], l["status_anterior"], l["status_novo"], l["motivo"], l["classe_motivo"]])).toEqual([
      [morta.codigo, "ativa", "morta", "fome_escassez", "evento"],
      [viva.codigo, "ativa", "inativa", "venda_doacao", "censura"],
      [viva.codigo, "inativa", "ativa", "correcao_registro", ""],
    ]);
    expect(linhas[0]!["data_percebida"]).toBe("2026-06-15T12:00:00.000Z");

    const json = await u.get(`/exportacao/historico-status?formato=json&coloniaId=${viva.id}`);
    expect(json.body.metadados).toMatchObject({ recurso: "historico-status", totalRegistros: 2 });
    expect(json.body.dados).toHaveLength(2);

    expect(lerCsv((await u.get("/exportacao/historico-status?desde=2026-07-02")).texto)).toHaveLength(1);
    expect((await u.get("/exportacao/historico-status?formato=xml")).status).toBe(400);
  });

  it("protocolos em JSON, com conteúdo e número de avaliações", async () => {
    const res = await u.get("/exportacao/protocolos");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body.metadados.recurso).toBe("protocolos");
    expect(res.body.metadados.metodologia.protocolo).toContain("SHA-256");
    const dados = res.body.dados as { hash: string; nAvaliacoes: number; conteudo: { versao: number; itens: { criterioBom: string }[] } }[];
    expect(dados).toHaveLength(2);
    expect(dados.map((p) => p.conteudo.itens[0]!.criterioBom)).toEqual(["bom", "critério novo"]);
    expect(dados.map((p) => p.nAvaliacoes)).toEqual([1, 1]);
  });

  it("backup inclui o histórico de status, os protocolos e os campos novos", async () => {
    const b = (await u.get("/exportacao/backup")).body;
    expect(b.historicoStatus).toHaveLength(3);
    expect(b.protocolos).toHaveLength(2);
    expect(b.colonias.find((c: { id: string }) => c.id === morta.id)).toMatchObject({ motivoStatus: "fome_escassez" });
    expect(b.avaliacoes.find((a: { id: string }) => a.id === avContexto)).toMatchObject({
      motivoInspecao: "problema_observado",
      motivosAcoes: { "Alimentação artificial": "resposta_problema" },
      climaFonte: "digitado",
      protocoloId: expect.any(String),
    });

    const outro = (await (await novoUsuario(app)).api.get("/exportacao/backup")).body;
    expect(outro.historicoStatus).toEqual([]);
    expect(outro.protocolos).toEqual([]);
  });
});

describe("exportação — dados de desfecho: formato JSON e isolamento", () => {
  it("motivos_acoes: objeto no JSON, lista no CSV; ação chamada 'constructor' não lê o Object.prototype", async () => {
    const { api: v } = await novoUsuario(app);
    const [pid] = await criarParametros(v, 1);
    const col = await criarColonia(v);
    const av = await criarAvaliacao(v, col.id, [{ parametroId: pid!, classificacao: "bom" }], {
      acoesTomadas: ["constructor", "Alimentação artificial"],
      motivosAcoes: { "Alimentação artificial": "preventiva" },
    });
    expect(av.status).toBe(201);

    const csv = lerCsv((await v.get("/exportacao/avaliacoes")).texto);
    expect(csv[0]!["motivos_acoes"]).toBe(" | preventiva");

    const json = (await v.get("/exportacao/avaliacoes?formato=json")).body;
    expect(json.dados[0].motivos_acoes).toEqual({ "Alimentação artificial": "preventiva" });

    const semMotivo = await criarAvaliacao(v, col.id, [{ parametroId: pid!, classificacao: "bom" }], {
      acoesTomadas: ["constructor"],
    });
    const linhas = lerCsv((await v.get("/exportacao/avaliacoes")).texto);
    expect(linhas.find((l) => l["avaliacao_id"] === semMotivo.body.id)!["motivos_acoes"]).toBe("");
  });

  it("historico-status traz atualizado_em, diferente de registrado_em quando a entrada foi corrigida", async () => {
    const { api: v } = await novoUsuario(app);
    const col = await criarColonia(v);
    await v.patch(`/colonias/${col.id}`, { status: "morta" });
    let [linha] = lerCsv((await v.get("/exportacao/historico-status")).texto);
    expect(linha!["atualizado_em"]).toBe(linha!["registrado_em"]);

    await v.patch(`/colonias/${col.id}`, { motivoStatus: "orfandade" });
    [linha] = lerCsv((await v.get("/exportacao/historico-status")).texto);
    expect(linha!["motivo"]).toBe("orfandade");
    expect(linha!["atualizado_em"]! > linha!["registrado_em"]!).toBe(true);
  });

  it("historico-status e protocolos nunca trazem dados de outro usuário", async () => {
    const dono = await novoUsuario(app);
    const [pid] = await criarParametros(dono.api, 1);
    const col = await criarColonia(dono.api);
    await dono.api.patch(`/colonias/${col.id}`, { status: "inativa", motivoStatus: "venda_doacao" });
    await criarAvaliacao(dono.api, col.id, [{ parametroId: pid!, classificacao: "bom" }]);
    expect(lerCsv((await dono.api.get("/exportacao/historico-status")).texto)).toHaveLength(1);
    expect((await dono.api.get("/exportacao/protocolos")).body.dados).toHaveLength(1);

    const outro = await novoUsuario(app);
    expect(lerCsv((await outro.api.get("/exportacao/historico-status")).texto)).toEqual([]);
    expect(lerCsv((await outro.api.get(`/exportacao/historico-status?coloniaId=${col.id}`)).texto)).toEqual([]);
    expect((await outro.api.get(`/exportacao/historico-status?formato=json&coloniaId=${col.id}`)).body.dados).toEqual([]);
    expect((await outro.api.get("/exportacao/protocolos")).body.dados).toEqual([]);
  });
});
