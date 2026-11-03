import { describe, expect, it } from "vitest";
import { calcularScore } from "../../src/modules/avaliacoes/avaliacoes.service";

const av = (...cls: string[]) => cls.map((classificacao) => ({ classificacao }));

describe("calcularScore", () => {
  it("aplica a fórmula (bom×100 + medio×50 + ruim×0) / n", () => {
    expect(calcularScore(av("bom", "medio", "ruim")).scoreGeral).toBe(50);
    expect(calcularScore(av("bom", "bom", "medio")).scoreGeral).toBe(83);
    expect(calcularScore(av("bom")).scoreGeral).toBe(100);
    expect(calcularScore(av("ruim", "ruim")).scoreGeral).toBe(0);
  });

  it("arredonda para o inteiro mais próximo", () => {
    // (100 + 50 + 50) / 3 = 66,67 → 67
    expect(calcularScore(av("bom", "medio", "medio")).scoreGeral).toBe(67);
    // (100 + 0 + 0) / 3 = 33,33 → 33
    expect(calcularScore(av("bom", "ruim", "ruim")).scoreGeral).toBe(33);
  });

  it.each([
    [100, "excelente"],
    [80, "excelente"],
    [79, "boa"],
    [60, "boa"],
    [59, "atencao"],
    [40, "atencao"],
    [39, "critica"],
    [0, "critica"],
  ])("score %i → status %s (limites das faixas)", (score, status) => {
    // Constrói um conjunto de 100 parâmetros com exatamente `score` "bom" e o resto "ruim".
    const params = av(...Array.from({ length: 100 }, (_, i) => (i < score ? "bom" : "ruim")));
    const r = calcularScore(params);
    expect(r.scoreGeral).toBe(score);
    expect(r.statusGeral).toBe(status);
  });
});
