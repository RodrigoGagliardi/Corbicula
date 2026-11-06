import { describe, expect, it } from "vitest";
import type { Especie } from "../../types/api";
import { ErroApi } from "../api/client";
import {
  buscarAvaliacao,
  buscarColonia,
  buscarProducao,
  historicoAvaliacoes,
  listarAvaliacoesDaColonia,
  listarColonias,
  listarEspecies,
  listarParametros,
  listarProducoes,
  type DadosLocais,
} from "./leituras";
import type { AvaliacaoServidor, ColoniaServidor, CriterioEspecieServidor, ParametroServidor, ProducaoServidor } from "./tipos";

const DATA = "2026-10-01T12:00:00.000Z";

const especie = (id: string, codigo: string, nomePopular: string, nomeCientifico: string, extra: object = {}) =>
  ({ id, codigo, nomePopular, nomeCientifico, nomesAlternativos: [], statusConservacao: null, ...extra }) as Especie;

const JATAI = especie("e-jatai", "TETRANGU", "Jataí", "Tetragonisca angustula", { caracteristicas: { tamanho: "pequena" } });
const MANDACAIA = especie("e-mand", "MELIQUAD", "Mandaçaia", "Melipona quadrifasciata");
const ESPECIES = [MANDACAIA, JATAI];

function colonia(id: string, codigo: string, parcial: Partial<ColoniaServidor> = {}): ColoniaServidor {
  return {
    id,
    userId: "u1",
    codigo,
    dataEntrada: DATA,
    origem: "captura",
    tipoCaixa: "INPA",
    dimensoesCaixa: null,
    localizacao: null,
    latitude: null,
    longitude: null,
    observacoes: null,
    status: "ativa",
    frequenciaInspecaoDias: null,
    especieId: null,
    coloniaMaeId: null,
    coloniaDoadoraCampeirasId: null,
    createdAt: DATA,
    updatedAt: DATA,
    ...parcial,
  };
}

function avaliacao(
  id: string,
  coloniaId: string,
  dataAvaliacao: string,
  parametros: [string, "bom" | "medio" | "ruim"][] = [],
  parcial: Partial<AvaliacaoServidor> = {}
): AvaliacaoServidor {
  return {
    id,
    coloniaId,
    dataAvaliacao,
    duracaoMinutos: null,
    temperatura: null,
    umidade: null,
    condicaoClimatica: null,
    observacoesGerais: null,
    acoesTomadas: [],
    scoreGeral: 100,
    statusGeral: "excelente",
    parametros: parametros.map(([parametroId, classificacao]) => ({
      id: `${id}-${parametroId}`,
      avaliacaoId: id,
      parametroId,
      classificacao,
      valorNumerico: null,
      observacoes: null,
      createdAt: dataAvaliacao,
    })),
    createdAt: dataAvaliacao,
    updatedAt: dataAvaliacao,
    ...parcial,
  };
}

function producao(id: string, coloniaId: string, dataColheita: string, parcial: Partial<ProducaoServidor> = {}): ProducaoServidor {
  return {
    id,
    coloniaId,
    dataColheita,
    tipoProduto: "mel",
    quantidade: 100,
    unidade: "ml",
    caracteristicas: null,
    observacoes: null,
    createdAt: dataColheita,
    updatedAt: dataColheita,
    ...parcial,
  };
}

const criterio = (parametroId: string, especieId: string): CriterioEspecieServidor => ({
  id: `${parametroId}-${especieId}`,
  parametroId,
  especieId,
  criterioBom: "b",
  criterioMedio: "m",
  criterioRuim: "r",
  createdAt: DATA,
  updatedAt: DATA,
});

function parametro(id: string, nome: string, ordem: number, parcial: Partial<ParametroServidor> = {}): ParametroServidor {
  return {
    id,
    userId: "u1",
    nome,
    ordem,
    criterioBom: "bom",
    criterioMedio: "médio",
    criterioRuim: "ruim",
    ativo: true,
    criteriosEspecie: [],
    createdAt: DATA,
    updatedAt: DATA,
    ...parcial,
  };
}

function dados(parcial: Partial<DadosLocais> = {}): DadosLocais {
  return { colonias: [], avaliacoes: [], producoes: [], parametros: [], especies: ESPECIES, ...parcial };
}

// Espera um ErroApi com status e mensagem da API.
function esperarErro(fn: () => unknown, status: number, mensagem: string) {
  try {
    fn();
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(status);
    expect((erro as ErroApi).message).toBe(mensagem);
    return;
  }
  throw new Error("esperava um erro");
}

const ids = (lista: { id: string }[]) => lista.map((x) => x.id);

// ─── Colônias ─────────────────────────────────────────────────────────────────

describe("listarColonias (GET /colonias)", () => {
  it("ordena por status e depois por código", () => {
    const r = listarColonias(
      dados({
        colonias: [
          colonia("c1", "TETRANGU-002"),
          colonia("c2", "MELIQUAD-001", { status: "morta" }),
          colonia("c3", "TETRANGU-001"),
          colonia("c4", "COL-001", { status: "inativa" }),
          colonia("c5", "COL-002"),
        ],
      })
    );
    expect(r.map((c) => c.codigo)).toEqual(["COL-002", "TETRANGU-001", "TETRANGU-002", "COL-001", "MELIQUAD-001"]);
  });

  it("deriva espécie, última avaliação (pela data, não pela ordem) e contagens", () => {
    const [c] = listarColonias(
      dados({
        colonias: [colonia("c1", "TETRANGU-001", { especieId: JATAI.id })],
        avaliacoes: [
          avaliacao("a-velha", "c1", "2026-09-01T10:00:00.000Z"),
          avaliacao("a-nova", "c1", "2026-10-20T10:00:00.000Z", [], { scoreGeral: 50, statusGeral: "atencao" }),
          avaliacao("a-meio", "c1", "2026-10-01T10:00:00.000Z"),
          avaliacao("a-outra", "c9", "2026-12-01T10:00:00.000Z"),
        ],
        producoes: [producao("p1", "c1", DATA), producao("p2", "c1", DATA), producao("p3", "c9", DATA)],
      })
    );
    expect(c!.especie).toEqual({ codigo: "TETRANGU", nomePopular: "Jataí", nomeCientifico: "Tetragonisca angustula" });
    expect(c!.ultimaAvaliacao).toEqual({ id: "a-nova", dataAvaliacao: "2026-10-20T10:00:00.000Z", scoreGeral: 50, statusGeral: "atencao" });
    expect(c!._count).toEqual({ avaliacoes: 3, producoes: 2 });
  });

  it("sem espécie e sem avaliações: especie e ultimaAvaliacao nulas, contagens zero", () => {
    const [c] = listarColonias(dados({ colonias: [colonia("c1", "COL-001")] }));
    expect(c!.especie).toBeNull();
    expect(c!.ultimaAvaliacao).toBeNull();
    expect(c!._count).toEqual({ avaliacoes: 0, producoes: 0 });
  });

  it("mãe ou doadora ausente do banco local vira sem vínculo; presente continua", () => {
    const r = listarColonias(
      dados({
        colonias: [
          colonia("mae", "COL-001"),
          colonia("filha", "COL-002", { origem: "divisao", coloniaMaeId: "mae", coloniaDoadoraCampeirasId: "sumiu" }),
          colonia("orfa", "COL-003", { origem: "divisao", coloniaMaeId: "excluida", coloniaDoadoraCampeirasId: "mae" }),
        ],
      })
    );
    const porId = new Map(r.map((c) => [c.id, c]));
    expect(porId.get("filha")).toMatchObject({ coloniaMaeId: "mae", coloniaDoadoraCampeirasId: null });
    expect(porId.get("orfa")).toMatchObject({ coloniaMaeId: null, coloniaDoadoraCampeirasId: "mae" });
  });

  it("mantém os demais campos da linha (ex.: dimensões já convertidas)", () => {
    const [c] = listarColonias(dados({ colonias: [colonia("c1", "COL-001", { dimensoesCaixa: { altura: 10 }, userId: "u1" })] }));
    expect(c).toMatchObject({ dimensoesCaixa: { altura: 10 }, userId: "u1", origem: "captura" });
  });
});

describe("buscarColonia (GET /colonias/:id)", () => {
  const base = () =>
    dados({
      colonias: [
        colonia("mae", "TETRANGU-001", { especieId: JATAI.id }),
        colonia("doadora", "TETRANGU-002", { especieId: JATAI.id }),
        colonia("alvo", "TETRANGU-003", { especieId: JATAI.id, origem: "divisao", coloniaMaeId: "mae", coloniaDoadoraCampeirasId: "doadora" }),
        colonia("f2", "TETRANGU-005", { origem: "divisao", coloniaMaeId: "alvo", status: "morta" }),
        colonia("f1", "TETRANGU-004", { origem: "divisao", coloniaMaeId: "alvo", coloniaDoadoraCampeirasId: "alvo" }),
      ],
      avaliacoes: [avaliacao("a1", "alvo", DATA)],
    });

  it("embute mãe, doadora, filhas e receptoras (por código) e a espécie com características", () => {
    const c = buscarColonia(base(), "alvo");
    expect(c.coloniaMae).toEqual({ id: "mae", codigo: "TETRANGU-001" });
    expect(c.coloniaDoadoraCampeiras).toEqual({ id: "doadora", codigo: "TETRANGU-002" });
    expect(c.coloniasFilhas).toEqual([
      { id: "f1", codigo: "TETRANGU-004", status: "ativa" },
      { id: "f2", codigo: "TETRANGU-005", status: "morta" },
    ]);
    expect(c.coloniasReceptorasCampeiras).toEqual([{ id: "f1", codigo: "TETRANGU-004", status: "ativa" }]);
    expect(c.especie).toEqual({
      codigo: "TETRANGU",
      nomePopular: "Jataí",
      nomeCientifico: "Tetragonisca angustula",
      caracteristicas: JSON.stringify({ tamanho: "pequena" }),
    });
    expect(c.ultimaAvaliacao?.id).toBe("a1");
    expect(c._count).toEqual({ avaliacoes: 1, producoes: 0 });
  });

  it("mãe e doadora ausentes: id null e objeto null", () => {
    const d = base();
    d.colonias = d.colonias.filter((c) => c.id !== "mae" && c.id !== "doadora");
    const c = buscarColonia(d, "alvo");
    expect(c).toMatchObject({ coloniaMaeId: null, coloniaMae: null, coloniaDoadoraCampeirasId: null, coloniaDoadoraCampeiras: null });
  });

  it("inexistente: ErroApi 404, como na API", () => {
    esperarErro(() => buscarColonia(base(), "nao-existe"), 404, "Colônia não encontrada");
  });
});

// ─── Avaliações ───────────────────────────────────────────────────────────────

describe("listarAvaliacoesDaColonia (GET /colonias/:id/avaliacoes)", () => {
  it("só as da colônia, data desc, com _count.parametros e sem a lista de parâmetros", () => {
    const r = listarAvaliacoesDaColonia(
      dados({
        colonias: [colonia("c1", "COL-001"), colonia("c2", "COL-002")],
        avaliacoes: [
          avaliacao("a1", "c1", "2026-09-01T10:00:00.000Z", [["p1", "bom"]]),
          avaliacao("a2", "c1", "2026-10-01T10:00:00.000Z", [["p1", "bom"], ["p2", "ruim"]]),
          avaliacao("a3", "c2", "2026-11-01T10:00:00.000Z"),
        ],
      }),
      "c1"
    );
    expect(ids(r)).toEqual(["a2", "a1"]);
    expect(r[0]!._count).toEqual({ parametros: 2 });
    expect(r[0]).not.toHaveProperty("parametros");
  });

  it("colônia inexistente: 404", () => {
    esperarErro(() => listarAvaliacoesDaColonia(dados(), "c1"), 404, "Colônia não encontrada");
  });
});

describe("historicoAvaliacoes (GET /avaliacoes)", () => {
  const base = () =>
    dados({
      colonias: [colonia("c1", "TETRANGU-001", { especieId: JATAI.id }), colonia("c2", "COL-001")],
      avaliacoes: [
        avaliacao("a1", "c1", "2026-10-31T23:59:59.999Z", [["p1", "bom"], ["p2", "ruim"]]),
        avaliacao("a2", "c1", "2026-11-01T00:00:00.000Z", [["p1", "ruim"]], { statusGeral: "critica", scoreGeral: 0 }),
        avaliacao("a3", "c2", "2026-11-01T12:00:00.000Z", [["p2", "medio"]], { statusGeral: "atencao", scoreGeral: 50 }),
        avaliacao("orfa", "sumiu", "2026-11-02T00:00:00.000Z"),
      ],
    });

  it("sem filtros: todas as avaliações de colônias existentes, data desc, com a colônia embutida", () => {
    const r = historicoAvaliacoes(base());
    expect(ids(r)).toEqual(["a3", "a2", "a1"]);
    expect(r[2]!.colonia).toEqual({ id: "c1", codigo: "TETRANGU-001", especie: { codigo: "TETRANGU", nomePopular: "Jataí" } });
    expect(r[0]!.colonia.especie).toBeNull();
    expect(r[2]!._count).toEqual({ parametros: 2 });
    expect(r[2]).not.toHaveProperty("parametros");
  });

  it("filtra por colônia e por status", () => {
    expect(ids(historicoAvaliacoes(base(), { coloniaId: "c1" }))).toEqual(["a2", "a1"]);
    expect(ids(historicoAvaliacoes(base(), { status: "critica" }))).toEqual(["a2"]);
    expect(ids(historicoAvaliacoes(base(), { coloniaId: "c2", status: "critica" }))).toEqual([]);
  });

  it("parâmetro e classificação valem para o mesmo parâmetro avaliado (um `some` só)", () => {
    // a1 tem p1 bom e p2 ruim: não entra em "p1 ruim".
    expect(ids(historicoAvaliacoes(base(), { parametroId: "p1", classificacao: "ruim" }))).toEqual(["a2"]);
    expect(ids(historicoAvaliacoes(base(), { parametroId: "p2" }))).toEqual(["a3", "a1"]);
    expect(ids(historicoAvaliacoes(base(), { classificacao: "ruim" }))).toEqual(["a2", "a1"]);
  });

  it("período inclusivo sobre o instante, com YYYY-MM-DD à meia-noite UTC", () => {
    expect(ids(historicoAvaliacoes(base(), { desde: "2026-11-01" }))).toEqual(["a3", "a2"]);
    // `ate` = 01/11 00:00 UTC: entra a avaliação exatamente à meia-noite, não a do meio-dia.
    expect(ids(historicoAvaliacoes(base(), { ate: "2026-11-01" }))).toEqual(["a2", "a1"]);
    expect(ids(historicoAvaliacoes(base(), { desde: "2026-11-01", ate: "2026-11-01" }))).toEqual(["a2"]);
    expect(ids(historicoAvaliacoes(base(), { desde: "2026-11-01T06:00:00.000Z", ate: "2026-11-02" }))).toEqual(["a3"]);
  });

  it("filtros vazios são ignorados, como na query string", () => {
    expect(ids(historicoAvaliacoes(base(), { coloniaId: "", desde: "" }))).toEqual(["a3", "a2", "a1"]);
  });
});

describe("buscarAvaliacao (GET /colonias/:id/avaliacoes/:id)", () => {
  const base = () =>
    dados({
      colonias: [colonia("c1", "COL-001"), colonia("c2", "COL-002")],
      avaliacoes: [avaliacao("a1", "c1", DATA, [["p-b", "bom"], ["p-a", "ruim"], ["p-c", "medio"]], { acoesTomadas: ["alimentação"] })],
      parametros: [parametro("p-a", "Sanidade", 2), parametro("p-b", "Fluxo", 1), parametro("p-c", "Rainha", 3, { ativo: false })],
    });

  it("parâmetros por ordem, com o parâmetro embutido; demais campos preservados", () => {
    const a = buscarAvaliacao(base(), "c1", "a1");
    expect(a.parametros.map((p) => [p.parametro, p.classificacao])).toEqual([
      [{ id: "p-b", nome: "Fluxo", ordem: 1 }, "bom"],
      [{ id: "p-a", nome: "Sanidade", ordem: 2 }, "ruim"],
      [{ id: "p-c", nome: "Rainha", ordem: 3 }, "medio"],
    ]);
    expect(a.acoesTomadas).toEqual(["alimentação"]);
    expect(a.parametros[0]).toMatchObject({ id: "a1-p-b", parametroId: "p-b", avaliacaoId: "a1" });
  });

  it("404: colônia inexistente, avaliação inexistente ou de outra colônia", () => {
    esperarErro(() => buscarAvaliacao(base(), "c9", "a1"), 404, "Colônia não encontrada");
    esperarErro(() => buscarAvaliacao(base(), "c1", "a9"), 404, "Avaliação não encontrada");
    esperarErro(() => buscarAvaliacao(base(), "c2", "a1"), 404, "Avaliação não encontrada");
  });
});

// ─── Produções ────────────────────────────────────────────────────────────────

describe("listarProducoes (GET /producoes)", () => {
  const base = () =>
    dados({
      colonias: [colonia("c1", "MELIQUAD-001", { especieId: MANDACAIA.id }), colonia("c2", "COL-001")],
      producoes: [
        producao("p1", "c1", "2026-09-30T23:59:59.999Z", { caracteristicas: { cor: "âmbar" } }),
        producao("p2", "c2", "2026-10-15T10:00:00.000Z", { tipoProduto: "polen", unidade: "g" }),
        producao("p3", "c1", "2026-10-01T00:00:00.000Z"),
        producao("orfa", "sumiu", "2026-10-20T00:00:00.000Z"),
      ],
    });

  it("data de colheita desc, colônia com espécie embutida e _count.fotos 0", () => {
    const r = listarProducoes(base());
    expect(ids(r)).toEqual(["p2", "p3", "p1"]);
    expect(r[2]).toMatchObject({
      caracteristicas: { cor: "âmbar" },
      colonia: { id: "c1", codigo: "MELIQUAD-001", especie: { codigo: "MELIQUAD", nomePopular: "Mandaçaia", nomeCientifico: "Melipona quadrifasciata" } },
      _count: { fotos: 0 },
    });
    expect(r[0]!.colonia.especie).toBeNull();
  });

  it("filtra por colônia, produto e período (inclusivo, meia-noite UTC)", () => {
    expect(ids(listarProducoes(base(), { coloniaId: "c1" }))).toEqual(["p3", "p1"]);
    expect(ids(listarProducoes(base(), { tipoProduto: "polen" }))).toEqual(["p2"]);
    expect(ids(listarProducoes(base(), { desde: "2026-10-01" }))).toEqual(["p2", "p3"]);
    expect(ids(listarProducoes(base(), { ate: "2026-10-01" }))).toEqual(["p3", "p1"]);
    expect(ids(listarProducoes(base(), { coloniaId: "c1", desde: "2026-10-01", ate: "2026-10-31" }))).toEqual(["p3"]);
  });

  it("buscarProducao: mesmo formato; inexistente ou sem colônia local → 404", () => {
    expect(buscarProducao(base(), "p1")).toEqual(listarProducoes(base()).find((p) => p.id === "p1"));
    esperarErro(() => buscarProducao(base(), "p9"), 404, "Colheita não encontrada");
    esperarErro(() => buscarProducao(base(), "orfa"), 404, "Colheita não encontrada");
  });
});

// ─── Parâmetros e espécies ────────────────────────────────────────────────────

describe("listarParametros (GET /parametros)", () => {
  it("ordem e nome, inclui inativos, critérios por nome popular da espécie e contagem de usos", () => {
    const r = listarParametros(
      dados({
        parametros: [
          parametro("p3", "Sanidade", 2),
          parametro("p2", "Ácaros", 1, { ativo: false }),
          parametro("p1", "Fluxo", 1, { criteriosEspecie: [criterio("p1", JATAI.id), criterio("p1", MANDACAIA.id)] }),
        ],
        avaliacoes: [avaliacao("a1", "c1", DATA, [["p1", "bom"], ["p3", "ruim"]]), avaliacao("a2", "c1", DATA, [["p1", "medio"]])],
      })
    );
    expect(r.map((p) => p.nome)).toEqual(["Ácaros", "Fluxo", "Sanidade"]);
    expect(r[0]!.ativo).toBe(false);
    const fluxo = r[1]!;
    expect(fluxo.criteriosEspecie.map((c) => c.especie)).toEqual([
      { id: JATAI.id, codigo: "TETRANGU", nomePopular: "Jataí" },
      { id: MANDACAIA.id, codigo: "MELIQUAD", nomePopular: "Mandaçaia" },
    ]);
    expect(fluxo.criteriosEspecie[0]).toMatchObject({ especieId: JATAI.id, criterioBom: "b" });
    expect(r.map((p) => p._count.avaliacoesParametros)).toEqual([0, 2, 1]);
  });

  it("sem o catálogo local, o critério continua casando pelo especieId", () => {
    const [p] = listarParametros(dados({ especies: [], parametros: [parametro("p1", "Fluxo", 1, { criteriosEspecie: [criterio("p1", "e-x")] })] }));
    expect(p!.criteriosEspecie[0]).toMatchObject({ especieId: "e-x", especie: { id: "e-x" } });
  });
});

describe("listarEspecies (GET /especies)", () => {
  it("ordena pelo nome popular", () => {
    expect(listarEspecies(ESPECIES).map((e) => e.nomePopular)).toEqual(["Jataí", "Mandaçaia"]);
  });
});
