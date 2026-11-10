import { describe, expect, it } from "vitest";
import type { ColoniaInput } from "../../types/api";
import type { AvaliacaoServidor, ColoniaServidor } from "./tipos";
import {
  mensagemColoniaComAvaliacoes,
  validarEdicaoAvaliacao,
  validarEdicaoColonia,
  validarExclusaoColonia,
  validarJanelaEdicao,
  validarNovaAvaliacao,
  validarNovaColonia,
  validarParametros,
} from "./validacoes";

// Cada regra com o texto exato do servidor (colonias.service.ts / avaliacoes.service.ts).

const colonia = (id: string, codigo: string, extra: Partial<ColoniaServidor> = {}) =>
  ({
    id,
    codigo,
    especieId: "e-jatai",
    origem: "captura",
    dataEntrada: "2026-01-10T12:00:00.000Z",
    coloniaMaeId: null,
    coloniaDoadoraCampeirasId: null,
    ...extra,
  }) as ColoniaServidor;

const MAE = colonia("mae", "TETRANGU-001");
const DOADORA = colonia("doa", "TETRANGU-002");
const COLONIAS = [MAE, DOADORA];

const divisao = (extra: Partial<ColoniaInput> = {}) =>
  ({ dataEntrada: "2026-02-01T12:00:00.000Z", origem: "divisao", tipoCaixa: "inpa", coloniaMaeId: "mae", ...extra }) as ColoniaInput;

// Erro lançado (status e mensagem), ou null se passou.
function erro(fn: () => unknown) {
  try {
    fn();
    return null;
  } catch (e) {
    const { status, message } = e as { status: number; message: string };
    return { status, message };
  }
}

describe("nova colônia", () => {
  it("divisão válida passa; a filha sem espécie herda a da mãe", () => {
    expect(validarNovaColonia("f", divisao(), COLONIAS)).toBe("e-jatai");
    expect(validarNovaColonia("f", divisao({ especieId: "e-jatai", coloniaDoadoraCampeirasId: "doa" }), COLONIAS)).toBe("e-jatai");
  });

  it("divisão de outra espécie", () => {
    expect(erro(() => validarNovaColonia("f", divisao({ especieId: "e-mandacaia" }), COLONIAS))).toEqual({
      status: 409,
      message: "A espécie deve ser a mesma da colônia mãe (TETRANGU-001): uma divisão não muda de espécie.",
    });
  });

  it("filha antes da mãe (por dia UTC; mesmo dia vale)", () => {
    expect(erro(() => validarNovaColonia("f", divisao({ dataEntrada: "2026-01-09T23:00:00.000Z" }), COLONIAS))).toEqual({
      status: 409,
      message: "A data de entrada não pode ser anterior à da colônia mãe (TETRANGU-001, 2026-01-10).",
    });
    expect(erro(() => validarNovaColonia("f", divisao({ dataEntrada: "2026-01-10T00:00:00.000Z" }), COLONIAS))).toBeNull();
  });

  it("doadora: de outra espécie, igual à mãe", () => {
    const outra = colonia("outra", "MELIQUAD-001", { especieId: "e-mandacaia" });
    expect(erro(() => validarNovaColonia("f", divisao({ coloniaDoadoraCampeirasId: "outra" }), [...COLONIAS, outra]))?.message).toBe(
      "A espécie deve ser a mesma da colônia doadora de campeiras (MELIQUAD-001): uma divisão não muda de espécie."
    );
    expect(erro(() => validarNovaColonia("f", divisao({ coloniaDoadoraCampeirasId: "mae" }), COLONIAS))?.message).toBe(
      "A doadora de campeiras deve ser outra colônia, diferente da mãe"
    );
  });

  it("doadora: a própria colônia, ausente da cópia, ou filha antes dela", () => {
    expect(erro(() => validarNovaColonia("f", divisao({ coloniaDoadoraCampeirasId: "f" }), COLONIAS))?.message).toBe(
      "Uma colônia não pode doar campeiras para si mesma"
    );
    expect(erro(() => validarNovaColonia("f", divisao({ coloniaDoadoraCampeirasId: "sumiu" }), COLONIAS))).toEqual({
      status: 404,
      message: "Colônia doadora de campeiras não encontrada ou não pertence ao usuário",
    });
    const doadoraNova = colonia("dn", "TETRANGU-007", { dataEntrada: "2026-03-01T12:00:00.000Z" });
    expect(erro(() => validarNovaColonia("f", divisao({ coloniaDoadoraCampeirasId: "dn" }), [...COLONIAS, doadoraNova]))?.message).toBe(
      "A data de entrada não pode ser anterior à da colônia doadora de campeiras (TETRANGU-007, 2026-03-01)."
    );
  });

  it("mãe ou doadora fora de divisão", () => {
    expect(erro(() => validarNovaColonia("f", divisao({ origem: "captura" }), COLONIAS))).toEqual({
      status: 409,
      message: "Colônia mãe só se aplica a colônias de origem divisão",
    });
    expect(erro(() => validarNovaColonia("f", divisao({ origem: "compra", coloniaMaeId: null, coloniaDoadoraCampeirasId: "doa" }), COLONIAS))?.message).toBe(
      "Colônia doadora de campeiras só se aplica a colônias de origem divisão"
    );
  });

  it("mãe fora da cópia local: 404 do servidor", () => {
    expect(erro(() => validarNovaColonia("f", divisao({ coloniaMaeId: "sumiu" }), COLONIAS))).toEqual({
      status: 404,
      message: "Colônia mãe não encontrada ou não pertence ao usuário",
    });
  });
});

describe("edição de colônia", () => {
  const A = colonia("a", "TETRANGU-003");
  const B = colonia("b", "TETRANGU-004", { origem: "divisao", coloniaMaeId: "a", dataEntrada: "2026-03-01T12:00:00.000Z" });

  it("ciclo: A mãe de B; editar A com mãe B", () => {
    expect(erro(() => validarEdicaoColonia(A, { origem: "divisao", coloniaMaeId: "b", dataEntrada: "2026-03-02T12:00:00.000Z" }, [A, B]))).toEqual({
      status: 409,
      message: "Genealogia inválida: a colônia mãe é descendente desta colônia",
    });
  });

  it("linhagem com laço antigo não trava a checagem de ciclo", () => {
    const x = colonia("x", "TETRANGU-010", { origem: "divisao", coloniaMaeId: "y" });
    const y = colonia("y", "TETRANGU-011", { origem: "divisao", coloniaMaeId: "x" });
    expect(erro(() => validarEdicaoColonia(A, { origem: "divisao", coloniaMaeId: "x" }, [A, x, y]))).toBeNull();
  });

  it("tirar a mãe junto com a troca de origem passa", () => {
    expect(erro(() => validarEdicaoColonia(B, { origem: "captura", coloniaMaeId: null }, [A, B]))).toBeNull();
  });

  it("mãe de si mesma", () => {
    expect(erro(() => validarEdicaoColonia(A, { coloniaMaeId: "a" }, [A]))?.message).toBe("Uma colônia não pode ser mãe de si mesma");
  });

  it("troca de espécie definida; identificar uma COL passa", () => {
    expect(erro(() => validarEdicaoColonia(A, { especieId: "e-mandacaia" }, [A]))).toEqual({
      status: 409,
      message:
        "A espécie de uma colônia não pode ser alterada depois de definida. Se a identificação estava errada, registre uma nova colônia e marque esta como inativa.",
    });
    const semEspecie = colonia("c", "COL-001", { especieId: null });
    expect(erro(() => validarEdicaoColonia(semEspecie, { especieId: "e-jatai" }, [semEspecie]))).toBeNull();
  });

  it("derivadas: identificar a mãe com outra espécie que a da filha, ou mover a entrada para depois dela", () => {
    const maeSem = colonia("m", "COL-002", { especieId: null });
    const filha = colonia("f", "MELIQUAD-001", { especieId: "e-mandacaia", origem: "divisao", coloniaMaeId: "m", dataEntrada: "2026-03-01T12:00:00.000Z" });
    expect(erro(() => validarEdicaoColonia(maeSem, { especieId: "e-jatai" }, [maeSem, filha]))?.message).toBe(
      "A espécie deve ser a mesma das colônias formadas a partir desta (MELIQUAD-001): uma divisão não muda de espécie."
    );
    expect(erro(() => validarEdicaoColonia(A, { dataEntrada: "2026-04-01T12:00:00.000Z" }, [A, B]))?.message).toBe(
      "A data de entrada não pode ser posterior à das colônias formadas a partir desta (TETRANGU-004)."
    );
  });

  it("derivadas também pelas receptoras de campeiras", () => {
    const receptora = colonia("r", "TETRANGU-020", { origem: "divisao", coloniaDoadoraCampeirasId: "a", dataEntrada: "2026-03-01T12:00:00.000Z" });
    expect(erro(() => validarEdicaoColonia(A, { dataEntrada: "2026-05-01T12:00:00.000Z" }, [A, receptora]))?.message).toBe(
      "A data de entrada não pode ser posterior à das colônias formadas a partir desta (TETRANGU-020)."
    );
  });

  it("registro antigo inconsistente: editar só o status ou as observações passa", () => {
    const inconsistente = colonia("x", "TETRANGU-009", { origem: "captura", coloniaMaeId: "a" });
    expect(erro(() => validarEdicaoColonia(inconsistente, { status: "morta", observacoes: "fim" }, [A, inconsistente]))).toBeNull();
    expect(erro(() => validarEdicaoColonia(inconsistente, { origem: "compra" }, [A, inconsistente]))?.message).toBe(
      "Colônia mãe só se aplica a colônias de origem divisão"
    );
  });
});

describe("exclusão de colônia", () => {
  it("com avaliações: recusa com o texto do servidor", () => {
    expect(erro(() => validarExclusaoColonia(2))).toEqual({ status: 409, message: mensagemColoniaComAvaliacoes(2) });
    expect(erro(() => validarExclusaoColonia(0))).toBeNull();
  });
});

describe("avaliações", () => {
  const PARAMETROS = [
    { id: "p1", ativo: true },
    { id: "p2", ativo: false },
  ];

  it("janela de 7 dias contada do registro (7 dias exatos ainda vale)", () => {
    const criada = "2026-11-01T12:00:00.000Z";
    expect(erro(() => validarJanelaEdicao(criada, new Date("2026-11-08T12:00:00.000Z")))).toBeNull();
    expect(erro(() => validarJanelaEdicao(criada, new Date("2026-11-08T12:00:00.001Z")))).toEqual({
      status: 409,
      message: "Avaliações só podem ser editadas nos primeiros 7 dias após o registro.",
    });
  });

  it("parâmetro inativo recusado na nova; aceito na edição se já estava na avaliação", () => {
    const msg = "Um ou mais parâmetros não foram encontrados, não pertencem ao usuário ou estão inativos.";
    expect(erro(() => validarParametros(["p1", "p2"], PARAMETROS))).toEqual({ status: 409, message: msg });
    expect(erro(() => validarParametros(["p1", "p2"], PARAMETROS, ["p2"]))).toBeNull();
    expect(erro(() => validarParametros(["p1", "p1"], PARAMETROS))?.message).toBe(msg);
    expect(erro(() => validarParametros(["p9"], PARAMETROS))?.message).toBe(msg);
  });

  it("nova avaliação: colônia fora da cópia local é 404", () => {
    const dados = { dataAvaliacao: "2026-11-09T12:00:00.000Z", parametros: [{ parametroId: "p1", classificacao: "bom" as const }] };
    expect(erro(() => validarNovaAvaliacao("c1", dados, [{ id: "c1" }], PARAMETROS))).toBeNull();
    expect(erro(() => validarNovaAvaliacao("c9", dados, [{ id: "c1" }], PARAMETROS))).toEqual({ status: 404, message: "Colônia não encontrada" });
  });

  it("edição: janela e parâmetros (só quando enviados)", () => {
    const linha = { createdAt: "2026-11-01T12:00:00.000Z", parametros: [{ parametroId: "p2" }] } as AvaliacaoServidor;
    const dentro = new Date("2026-11-02T12:00:00.000Z");
    expect(erro(() => validarEdicaoAvaliacao(linha, { observacoesGerais: "x" }, PARAMETROS, dentro))).toBeNull();
    expect(erro(() => validarEdicaoAvaliacao(linha, { parametros: [{ parametroId: "p2", classificacao: "bom" }] }, PARAMETROS, dentro))).toBeNull();
    expect(erro(() => validarEdicaoAvaliacao(linha, {}, PARAMETROS, new Date("2026-11-20T00:00:00.000Z")))?.status).toBe(409);
  });
});
