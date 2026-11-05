import { describe, expect, it } from "vitest";
import type { Parametro } from "../types/api";
import { lerArquivoParametros, previaAplicacao } from "./conjuntoParametros";

const criterios = { criterioBom: "b", criterioMedio: "m", criterioRuim: "r" };

function parametro(nome: string, extra: Partial<Parametro> = {}): Parametro {
  return {
    id: nome,
    nome,
    ordem: 1,
    ativo: true,
    criteriosEspecie: [],
    _count: { avaliacoesParametros: 0 },
    ...criterios,
    ...extra,
  } as Parametro;
}

describe("previaAplicacao", () => {
  const itens = [
    { nome: "Sanidade", ...criterios },
    { nome: "Potes de mel", ...criterios },
  ];

  it("mesclar: novos são criados, existentes mantidos (nome sem diferenciar maiúsculas/acentos)", () => {
    const atuais = [parametro("SANIDADE", { criterioBom: "meu" }), parametro("Outro")];
    expect(previaAplicacao(atuais, itens, "mesclar")).toEqual({
      novos: ["Potes de mel"],
      reativar: [],
      desativar: [],
      existentes: ["SANIDADE"],
      criteriosDiferentes: ["SANIDADE"],
    });
  });

  it("reativa parâmetro desativado que está no conjunto", () => {
    const atuais = [parametro("Sanidade", { ativo: false })];
    expect(previaAplicacao(atuais, itens, "mesclar").reativar).toEqual(["Sanidade"]);
  });

  it("substituir: desativa só os ativos fora do conjunto", () => {
    const atuais = [parametro("Sanidade"), parametro("Outro"), parametro("Velho", { ativo: false })];
    const previa = previaAplicacao(atuais, itens, "substituir");
    expect(previa.desativar).toEqual(["Outro"]);
    expect(previa.novos).toEqual(["Potes de mel"]);
  });

  it("respeita ativo=false do arquivo: substituir desativa, mesclar não", () => {
    const atuais = [parametro("Sanidade")];
    const arquivo = [{ nome: "Sanidade", ativo: false, ...criterios }];
    expect(previaAplicacao(atuais, arquivo, "substituir").desativar).toEqual(["Sanidade"]);
    expect(previaAplicacao(atuais, arquivo, "mesclar").desativar).toEqual([]);
  });
});

describe("lerArquivoParametros", () => {
  const valido = { formato: "corbicula-parametros", versao: 1, parametros: [{ nome: "Sanidade", ...criterios }] };

  it("aceita uma exportação válida", () => {
    expect(lerArquivoParametros(JSON.stringify(valido))).toEqual({ dados: valido });
  });

  it("dá mensagens claras para arquivos inválidos", () => {
    expect(lerArquivoParametros("não é json")).toEqual({ erro: "O arquivo não é um JSON válido." });
    expect(lerArquivoParametros(JSON.stringify({ ...valido, formato: "x" }))).toHaveProperty("erro", expect.stringContaining("não é uma exportação"));
    expect(lerArquivoParametros(JSON.stringify({ ...valido, versao: 2 }))).toHaveProperty("erro", expect.stringContaining("Versão"));
    expect(lerArquivoParametros(JSON.stringify({ ...valido, parametros: [] }))).toHaveProperty("erro", "O arquivo não tem parâmetros.");
    expect(lerArquivoParametros(JSON.stringify({ ...valido, parametros: [{ nome: "X", criterioBom: "" }] }))).toHaveProperty(
      "erro",
      expect.stringContaining('"X"')
    );
  });
});
