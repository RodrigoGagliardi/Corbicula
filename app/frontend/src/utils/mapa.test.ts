import { describe, expect, it } from "vitest";
import type { Colonia } from "../types/api";
import { especiesPresentes, filtrarColonias, FILTROS_MAPA_PADRAO, piorStatus, separarPorCoordenadas, temCoordenadas } from "./mapa";

const JATAI = { codigo: "TETRANGU", nomePopular: "Jataí", nomeCientifico: "Tetragonisca angustula" };
const MANDACAIA = { codigo: "MELIQUAD", nomePopular: "Mandaçaia", nomeCientifico: "Melipona quadrifasciata" };

function colonia(parcial: Partial<Colonia>): Colonia {
  return {
    id: crypto.randomUUID(),
    codigo: "COL-001",
    dataEntrada: "2026-01-01T00:00:00.000Z",
    origem: "captura",
    tipoCaixa: "INPA",
    dimensoesCaixa: null,
    localizacao: null,
    latitude: -30.03,
    longitude: -51.22,
    observacoes: null,
    status: "ativa",
    frequenciaInspecaoDias: null,
    especieId: null,
    coloniaMaeId: null,
    coloniaDoadoraCampeirasId: null,
    especie: null,
    ultimaAvaliacao: null,
    _count: { avaliacoes: 0, producoes: 0 },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...parcial,
  };
}

const avaliacao = (scoreGeral: number, statusGeral: "excelente" | "boa" | "atencao" | "critica") => ({
  id: crypto.randomUUID(),
  dataAvaliacao: "2026-10-01T10:00:00.000Z",
  scoreGeral,
  statusGeral,
});

describe("temCoordenadas", () => {
  it("exige latitude e longitude válidas", () => {
    expect(temCoordenadas(colonia({}))).toBe(true);
    expect(temCoordenadas(colonia({ latitude: null }))).toBe(false);
    expect(temCoordenadas(colonia({ longitude: null }))).toBe(false);
    expect(temCoordenadas(colonia({ latitude: 91 }))).toBe(false);
    expect(temCoordenadas(colonia({ longitude: -181 }))).toBe(false);
    expect(temCoordenadas(colonia({ latitude: 0, longitude: 0 }))).toBe(true);
  });
});

describe("separarPorCoordenadas", () => {
  it("não inventa posição para colônia sem coordenadas", () => {
    const com = colonia({ codigo: "A" });
    const sem = colonia({ codigo: "B", latitude: null, longitude: null });
    const { noMapa, semCoordenadas } = separarPorCoordenadas([com, sem]);
    expect(noMapa.map((c) => c.codigo)).toEqual(["A"]);
    expect(semCoordenadas.map((c) => c.codigo)).toEqual(["B"]);
  });
});

describe("filtrarColonias", () => {
  const lista = [
    colonia({ codigo: "TETRANGU-001", especie: JATAI, ultimaAvaliacao: avaliacao(90, "excelente") }),
    colonia({ codigo: "TETRANGU-002", especie: JATAI, status: "morta" }),
    colonia({ codigo: "MELIQUAD-001", especie: MANDACAIA, ultimaAvaliacao: avaliacao(20, "critica") }),
    colonia({ codigo: "COL-001" }),
  ];
  const codigos = (f: Partial<typeof FILTROS_MAPA_PADRAO>) =>
    filtrarColonias(lista, { ...FILTROS_MAPA_PADRAO, ...f }).map((c) => c.codigo);

  it("mostra só as ativas por padrão, como a lista", () => {
    expect(codigos({})).toEqual(["TETRANGU-001", "MELIQUAD-001", "COL-001"]);
    expect(codigos({ status: "todas" })).toHaveLength(4);
  });

  it("filtra por espécie, inclusive colônias sem espécie", () => {
    expect(codigos({ especie: "TETRANGU", status: "todas" })).toEqual(["TETRANGU-001", "TETRANGU-002"]);
    expect(codigos({ especie: "sem" })).toEqual(["COL-001"]);
  });

  it("filtra pelo status da última avaliação, com 'sem avaliação' como opção", () => {
    expect(codigos({ score: "critica" })).toEqual(["MELIQUAD-001"]);
    expect(codigos({ score: "sem" })).toEqual(["COL-001"]);
  });

  it("combina com a busca de texto (sem acentos)", () => {
    expect(codigos({ busca: "mandacaia" })).toEqual(["MELIQUAD-001"]);
  });
});

describe("piorStatus", () => {
  it("um grupo recebe a cor do pior status que contém", () => {
    expect(piorStatus(["excelente", "boa"])).toBe("boa");
    expect(piorStatus(["excelente", "sem", "boa"])).toBe("sem");
    expect(piorStatus(["boa", "critica", "atencao"])).toBe("critica");
    expect(piorStatus(["excelente"])).toBe("excelente");
  });
});

describe("especiesPresentes", () => {
  it("lista cada espécie uma vez, por nome popular", () => {
    const lista = [colonia({ especie: MANDACAIA }), colonia({ especie: JATAI }), colonia({ especie: JATAI }), colonia({})];
    expect(especiesPresentes(lista).map((e) => e.codigo)).toEqual(["TETRANGU", "MELIQUAD"]);
  });
});
