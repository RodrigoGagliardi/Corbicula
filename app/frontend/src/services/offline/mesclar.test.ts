import { describe, expect, it } from "vitest";
import { mesclar } from "./mesclar";
import type {
  AvaliacaoServidor,
  ColoniaServidor,
  IdsPorTipo,
  ParametroServidor,
  ProducaoServidor,
  RespostaAlteracoes,
} from "./tipos";

const DATA = "2026-11-01T12:00:00.000Z";

function colonia(id: string, parcial: Partial<ColoniaServidor> = {}): ColoniaServidor {
  return {
    id,
    userId: "u1",
    codigo: `TETRANGU-${id}`,
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

function avaliacao(id: string, coloniaId: string): AvaliacaoServidor {
  return {
    id,
    coloniaId,
    dataAvaliacao: DATA,
    duracaoMinutos: null,
    temperatura: null,
    umidade: null,
    condicaoClimatica: null,
    observacoesGerais: null,
    acoesTomadas: [],
    scoreGeral: 100,
    statusGeral: "excelente",
    parametros: [
      { id: `${id}-p`, avaliacaoId: id, parametroId: "par1", classificacao: "bom", valorNumerico: null, observacoes: null, createdAt: DATA },
    ],
    createdAt: DATA,
    updatedAt: DATA,
  };
}

function producao(id: string, coloniaId: string): ProducaoServidor {
  return {
    id,
    coloniaId,
    dataColheita: DATA,
    tipoProduto: "mel",
    quantidade: 250,
    unidade: "ml",
    caracteristicas: null,
    observacoes: null,
    createdAt: DATA,
    updatedAt: DATA,
  };
}

function parametro(id: string): ParametroServidor {
  return {
    id,
    userId: "u1",
    nome: `Parâmetro ${id}`,
    ordem: 0,
    criterioBom: "bom",
    criterioMedio: "médio",
    criterioRuim: "ruim",
    ativo: true,
    criteriosEspecie: [],
    createdAt: DATA,
    updatedAt: DATA,
  };
}

function resposta(parcial: Partial<RespostaAlteracoes>): RespostaAlteracoes {
  return {
    servidorEm: "2026-11-05T10:00:00.000Z",
    desde: null,
    colonias: [],
    avaliacoes: [],
    producoes: [],
    parametros: [],
    idsAtuais: { colonias: [], avaliacoes: [], producoes: [], parametros: [] },
    ...parcial,
  };
}

const VAZIO: IdsPorTipo = { colonias: [], avaliacoes: [], producoes: [], parametros: [] };

describe("mesclar (aplicação do pull)", () => {
  it("carga inicial: grava tudo o que veio e não remove nada", () => {
    const r = resposta({
      colonias: [colonia("c1"), colonia("c2")],
      avaliacoes: [avaliacao("a1", "c1")],
      producoes: [producao("p1", "c1")],
      parametros: [parametro("par1")],
      idsAtuais: { colonias: ["c1", "c2"], avaliacoes: ["a1"], producoes: ["p1"], parametros: ["par1"] },
    });
    const plano = mesclar(r, VAZIO);

    expect(plano.gravar).toEqual({
      colonias: r.colonias,
      avaliacoes: r.avaliacoes,
      producoes: r.producoes,
      parametros: r.parametros,
    });
    expect(plano.remover).toEqual(VAZIO);
    expect(plano.desde).toBe("2026-11-05T10:00:00.000Z");
  });

  it("o próximo desde é sempre o servidorEm da resposta, mesmo sem alterações", () => {
    const plano = mesclar(resposta({ servidorEm: "2026-11-06T00:00:00.000Z", desde: "2026-11-05T10:00:00.000Z" }), VAZIO);
    expect(plano.desde).toBe("2026-11-06T00:00:00.000Z");
  });

  it("incremental: grava só o que mudou e mantém os ids locais que continuam no servidor", () => {
    const alterada = colonia("c2", { observacoes: "editada em outro dispositivo" });
    const r = resposta({
      desde: "2026-11-04T00:00:00.000Z",
      colonias: [alterada],
      idsAtuais: { colonias: ["c1", "c2"], avaliacoes: ["a1"], producoes: [], parametros: ["par1"] },
    });
    const plano = mesclar(r, { colonias: ["c1", "c2"], avaliacoes: ["a1"], producoes: [], parametros: ["par1"] });

    expect(plano.gravar.colonias).toEqual([alterada]);
    expect(plano.gravar.avaliacoes).toEqual([]);
    expect(plano.remover).toEqual(VAZIO);
  });

  it("exclusão: id local fora de idsAtuais é removido, por tipo", () => {
    const r = resposta({
      idsAtuais: { colonias: ["c1"], avaliacoes: ["a1"], producoes: [], parametros: [] },
    });
    const plano = mesclar(r, {
      colonias: ["c1", "c2"],
      avaliacoes: ["a1", "a2", "a3"],
      producoes: ["p1"],
      parametros: ["par1"],
    });

    expect(plano.remover).toEqual({ colonias: ["c2"], avaliacoes: ["a2", "a3"], producoes: ["p1"], parametros: ["par1"] });
  });

  it("um id presente em idsAtuais de outro tipo não impede a remoção", () => {
    const r = resposta({ idsAtuais: { colonias: ["x"], avaliacoes: [], producoes: [], parametros: [] } });
    const plano = mesclar(r, { ...VAZIO, avaliacoes: ["x"] });
    expect(plano.remover.avaliacoes).toEqual(["x"]);
  });

  it("pendência protegida: registro recebido com mudança local pendente não é sobrescrito", () => {
    const r = resposta({
      colonias: [colonia("c1"), colonia("c2")],
      avaliacoes: [avaliacao("a1", "c1")],
      idsAtuais: { colonias: ["c1", "c2"], avaliacoes: ["a1"], producoes: [], parametros: [] },
    });
    const plano = mesclar(r, { ...VAZIO, colonias: ["c1", "c2"], avaliacoes: ["a1"] }, new Set(["c1", "a1"]));

    expect(plano.gravar.colonias.map((c) => c.id)).toEqual(["c2"]);
    expect(plano.gravar.avaliacoes).toEqual([]);
  });

  it("pendência protegida: registro local fora de idsAtuais com pendência não é removido", () => {
    // Ex.: colônia criada offline (ainda não existe no servidor) e produção editada
    // offline que outro dispositivo excluiu — a fila decide, não o pull.
    const r = resposta({ idsAtuais: { colonias: ["c1"], avaliacoes: [], producoes: [], parametros: [] } });
    const plano = mesclar(
      r,
      { ...VAZIO, colonias: ["c1", "nova-offline", "c3"], producoes: ["p1", "p2"] },
      new Set(["nova-offline", "p1"])
    );

    expect(plano.remover.colonias).toEqual(["c3"]);
    expect(plano.remover.producoes).toEqual(["p2"]);
  });

  it("não altera a resposta nem os ids locais recebidos", () => {
    const r = resposta({ colonias: [colonia("c1")], idsAtuais: { ...VAZIO, colonias: ["c1"] } });
    const locais: IdsPorTipo = { ...VAZIO, colonias: ["c1", "c2"] };
    const copiaR = structuredClone(r);
    const copiaLocais = structuredClone(locais);
    mesclar(r, locais, new Set(["c1"]));
    expect(r).toEqual(copiaR);
    expect(locais).toEqual(copiaLocais);
  });
});
