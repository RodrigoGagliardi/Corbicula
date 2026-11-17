import { describe, expect, it } from "vitest";
import type { Colonia } from "../types/api";
import { chaveDia, gradeDoMes, lerMes, proximaInspecao, somarMeses, sugestoesInspecao } from "./calendario";

function colonia(parcial: Partial<Colonia>): Colonia {
  return {
    id: crypto.randomUUID(),
    codigo: "COL-001",
    dataEntrada: new Date(2026, 0, 10, 12).toISOString(),
    origem: "captura",
    tipoCaixa: "INPA",
    dimensoesCaixa: null,
    localizacao: null,
    latitude: null,
    longitude: null,
    observacoes: null,
    status: "ativa",
    frequenciaInspecaoDias: null,
    statusDesde: null,
    motivoStatus: null,
    motivoStatusDetalhe: null,
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

const inspecionadaEm = (data: Date) => ({ id: "a", dataAvaliacao: data.toISOString(), scoreGeral: 90, statusGeral: "excelente" as const });

describe("grade do mês", () => {
  it("começa no domingo e cobre o mês inteiro em semanas completas", () => {
    const grade = gradeDoMes(2026, 10); // novembro/2026 começa num domingo
    expect(chaveDia(grade[0]![0]!)).toBe("2026-11-01");
    expect(grade.every((s) => s.length === 7)).toBe(true);
    expect(chaveDia(grade.at(-1)!.at(-1)!)).toBe("2026-12-05");

    const dez = gradeDoMes(2026, 11); // 01/12/2026 é terça
    expect(chaveDia(dez[0]![0]!)).toBe("2026-11-29");
  });

  it("lê e navega meses", () => {
    expect(lerMes("2026-02")).toEqual({ ano: 2026, mes: 1 });
    expect(lerMes("2026-13", new Date(2026, 4, 3))).toEqual({ ano: 2026, mes: 4 });
    expect(somarMeses(2026, 11, 1)).toEqual({ ano: 2027, mes: 0 });
    expect(somarMeses(2026, 0, -1)).toEqual({ ano: 2025, mes: 11 });
  });

  it("agrupa pelo dia local", () => {
    expect(chaveDia(new Date(2026, 10, 30, 23, 30))).toBe("2026-11-30");
  });
});

describe("sugestões de inspeção", () => {
  const hoje = new Date(2026, 10, 4, 9); // 04/11/2026

  it("última inspeção + frequência geral, repetindo até o fim do período", () => {
    const c = colonia({ ultimaAvaliacao: inspecionadaEm(new Date(2026, 9, 20, 10)) }); // 20/10
    const s = sugestoesInspecao([c], 15, "2026-11-01", "2026-11-30", hoje);
    expect(s.map((x) => x.dia)).toEqual(["2026-11-04", "2026-11-19"]);
    expect(s[0]).toMatchObject({ atrasadaDesde: null, frequencia: 15, frequenciaDaColonia: false });
  });

  it("a frequência da colônia tem prioridade", () => {
    const c = colonia({ frequenciaInspecaoDias: 10, ultimaAvaliacao: inspecionadaEm(new Date(2026, 10, 1, 10)) });
    const s = sugestoesInspecao([c], 30, "2026-11-01", "2026-11-30", hoje);
    expect(s.map((x) => x.dia)).toEqual(["2026-11-11", "2026-11-21"]);
    expect(s[0]!.frequenciaDaColonia).toBe(true);
  });

  it("vencida aparece hoje como atrasada e as seguintes contam a partir de hoje", () => {
    const c = colonia({ ultimaAvaliacao: inspecionadaEm(new Date(2026, 8, 1, 10)) }); // 01/09 + 30 = 01/10
    const s = sugestoesInspecao([c], 30, "2026-11-01", "2026-12-31", hoje);
    expect(s[0]).toMatchObject({ dia: "2026-11-04", atrasadaDesde: "2026-10-01", diasAtraso: 34 });
    expect(s.slice(1).map((x) => x.dia)).toEqual(["2026-12-04"]);
  });

  it("nunca avaliada conta a partir da entrada; inativas e mortas não entram", () => {
    const nova = colonia({ dataEntrada: new Date(2026, 10, 2, 12).toISOString() });
    const inativa = colonia({ status: "inativa" });
    const s = sugestoesInspecao([nova, inativa], 7, "2026-11-01", "2026-11-30", hoje);
    expect(s.map((x) => [x.colonia.id, x.dia])).toEqual([
      [nova.id, "2026-11-09"],
      [nova.id, "2026-11-16"],
      [nova.id, "2026-11-23"],
      [nova.id, "2026-11-30"],
    ]);
  });

  it("atrasada fora do período visível não aparece em hoje", () => {
    const c = colonia({ ultimaAvaliacao: inspecionadaEm(new Date(2026, 8, 1, 10)) });
    expect(sugestoesInspecao([c], 30, "2027-01-01", "2027-01-31", hoje).map((x) => x.dia)).toEqual(["2027-01-03"]);
  });
});

describe("próxima inspeção", () => {
  it("é a primeira sugestão a partir de hoje; vencida fica em hoje como atrasada", () => {
    const hoje = new Date(2026, 10, 4, 9);
    const emDia = colonia({ frequenciaInspecaoDias: 15, ultimaAvaliacao: inspecionadaEm(new Date(2026, 10, 1, 10)) });
    expect(proximaInspecao(emDia, 30, hoje)).toMatchObject({ dia: "2026-11-16", atrasadaDesde: null });
    const atrasada = colonia({ ultimaAvaliacao: inspecionadaEm(new Date(2026, 8, 1, 10)) });
    expect(proximaInspecao(atrasada, 30, hoje)).toMatchObject({ dia: "2026-11-04", atrasadaDesde: "2026-10-01" });
    expect(proximaInspecao(colonia({ status: "morta" }), 30, hoje)).toBeNull();
  });
});
