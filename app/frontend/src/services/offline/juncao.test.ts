import { describe, expect, it } from "vitest";
import { iguais, juntar, normalizar } from "./juncao";
import type { AvaliacaoServidor, ColoniaServidor } from "./tipos";

const base = { id: "c1", observacoes: "antes", localizacao: "antiga", status: "ativa", dimensoesCaixa: { altura: 10, largura: 20, profundidade: 30 } } as unknown as ColoniaServidor;
const servidor = (parcial: Record<string, unknown> = {}) => ({ ...base, updatedAt: "2026-11-09T10:00:00.000Z", ...parcial });

describe("normalizar / iguais", () => {
  it("datas pelo instante; nulo, vazio e ausente equivalem; objetos pela ordem das chaves", () => {
    expect(iguais("dataEntrada", "2026-01-01T12:00:00.000Z", "2026-01-01T09:00:00-03:00")).toBe(true);
    expect(iguais("observacoes", null, undefined)).toBe(true);
    expect(iguais("observacoes", "", null)).toBe(true);
    expect(iguais("motivosAcoes", {}, null)).toBe(true);
    expect(iguais("dimensoesCaixa", { altura: 1, largura: 2 }, { largura: 2, altura: 1 })).toBe(true);
    expect(iguais("acoesTomadas", ["a", "b"], ["b", "a"])).toBe(false);
    expect(iguais("acoesTomadas", [], null)).toBe(true);
    // Datas de dia: o mesmo dia em instantes diferentes é igual; data-hora não.
    expect(iguais("dataEntrada", "2026-01-01T12:00:00.000Z", "2026-01-01T03:00:00.000Z")).toBe(true);
    expect(iguais("dataAvaliacao", "2026-01-01T12:00:00.000Z", "2026-01-01T03:00:00.000Z")).toBe(false);
  });

  it("parâmetros: um campo só, pela classificação e observação de cada parâmetro, sem ordem", () => {
    const linha = [
      { id: "x", avaliacaoId: "a", parametroId: "p2", classificacao: "ruim", observacoes: null, valorNumerico: null, createdAt: "" },
      { id: "y", avaliacaoId: "a", parametroId: "p1", classificacao: "bom", observacoes: "ok", valorNumerico: null, createdAt: "" },
    ];
    const payload = [
      { parametroId: "p1", classificacao: "bom", observacoes: "ok" },
      { parametroId: "p2", classificacao: "ruim" },
    ];
    expect(normalizar("parametros", linha)).toBe(normalizar("parametros", payload));
    expect(iguais("parametros", payload, [{ parametroId: "p1", classificacao: "medio", observacoes: "ok" }, payload[1]])).toBe(false);
  });
});

describe("juntar", () => {
  it("campos distintos: leva só o que mudou no aparelho, com o updatedAt do servidor como base", () => {
    const r = juntar({ dados: { observacoes: "do aparelho", localizacao: "antiga" }, base, servidor: servidor({ localizacao: "do servidor" }) });
    expect(r).toEqual({ tipo: "juntada", dados: { observacoes: "do aparelho" }, baseUpdatedAt: "2026-11-09T10:00:00.000Z" });
  });

  it("mesmo campo, mesmo valor nos dois lados: resolvida", () => {
    expect(juntar({ dados: { observacoes: "igual" }, base, servidor: servidor({ observacoes: "igual" }) })).toEqual({ tipo: "resolvida" });
  });

  it("mesmo campo, valores diferentes: decisão com as duas versões", () => {
    const r = juntar({ dados: { observacoes: "A", localizacao: "nova" }, base, servidor: servidor({ observacoes: "B" }) });
    expect(r).toEqual({ tipo: "decisao", campos: [{ campo: "observacoes", local: "A", servidor: "B" }] });
  });

  it("objeto conta como um campo (dimensões da caixa)", () => {
    const r = juntar({
      dados: { dimensoesCaixa: { altura: 11, largura: 20, profundidade: 30 } },
      base,
      servidor: servidor({ dimensoesCaixa: { altura: 10, largura: 25, profundidade: 30 } }),
    });
    expect(r.tipo).toBe("decisao");
  });

  it("parâmetros da avaliação diferentes nos dois lados: um campo em conflito", () => {
    const baseAv = { id: "a1", parametros: [{ parametroId: "p1", classificacao: "medio", observacoes: null }] } as unknown as AvaliacaoServidor;
    const r = juntar({
      dados: { parametros: [{ parametroId: "p1", classificacao: "bom" }] },
      base: baseAv,
      servidor: { id: "a1", updatedAt: "2026-11-09T10:00:00.000Z", parametros: [{ parametroId: "p1", classificacao: "ruim", observacoes: null, parametro: { nome: "x" } }] },
    });
    expect(r).toMatchObject({ tipo: "decisao", campos: [{ campo: "parametros" }] });
  });

  it("sem base: toda diferença vai ao usuário", () => {
    const r = juntar({ dados: { observacoes: "A" }, servidor: servidor({ observacoes: "B" }) });
    expect(r).toMatchObject({ tipo: "decisao" });
  });
});
