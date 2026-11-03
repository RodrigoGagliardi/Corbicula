import { describe, expect, it } from "vitest";
import { gerarCsv } from "../../src/modules/exportacao/csv";

describe("gerarCsv (RFC 4180)", () => {
  it("gera cabeçalho e linhas separados por CRLF, terminando com CRLF", () => {
    const csv = gerarCsv(["a", "b"], [{ a: 1, b: "x" }, { a: 2, b: "y" }]);
    expect(csv).toBe("a,b\r\n1,x\r\n2,y\r\n");
  });

  it("respeita a ordem das colunas e ignora campos extras", () => {
    const csv = gerarCsv(["b", "a"], [{ a: 1, b: 2, c: 3 }]);
    expect(csv).toBe("b,a\r\n2,1\r\n");
  });

  it("coloca entre aspas campos com vírgula, aspas ou quebra de linha", () => {
    const csv = gerarCsv(["t"], [{ t: "âmbar, claro" }, { t: 'diz "oi"' }, { t: "linha1\nlinha2" }, { t: "a\r\nb" }]);
    const linhas = csv.split("\r\n");
    expect(linhas[1]).toBe('"âmbar, claro"');
    expect(linhas[2]).toBe('"diz ""oi"""');
    expect(csv).toContain('"linha1\nlinha2"');
    expect(csv).toContain('"a\r\nb"');
  });

  it("valor ausente (null/undefined) vira campo vazio", () => {
    const csv = gerarCsv(["a", "b", "c"], [{ a: null, b: undefined, c: 0 }]);
    expect(csv).toBe("a,b,c\r\n,,0\r\n");
  });

  it("datas saem em ISO 8601 UTC e decimais com ponto", () => {
    const csv = gerarCsv(["d", "n"], [{ d: new Date("2026-03-10T12:00:00.000Z"), n: 17.5 }]);
    expect(csv).toBe("d,n\r\n2026-03-10T12:00:00.000Z,17.5\r\n");
  });

  it("booleanos saem como true/false", () => {
    expect(gerarCsv(["x"], [{ x: true }, { x: false }])).toBe("x\r\ntrue\r\nfalse\r\n");
  });

  it("sem linhas, retorna só o cabeçalho", () => {
    expect(gerarCsv(["a", "b"], [])).toBe("a,b\r\n");
  });
});
