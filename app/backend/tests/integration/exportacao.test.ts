import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COLUNAS_AVALIACOES,
  COLUNAS_COLONIAS,
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
  colB = await criarColonia(api, { status: "morta", coloniaMaeId: colA.id });

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
