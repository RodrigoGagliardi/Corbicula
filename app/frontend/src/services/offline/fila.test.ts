import { describe, expect, it } from "vitest";
import {
  aplicarResultados,
  baseParaUpdate,
  MAX_LOTE,
  montarOperacao,
  paraEnvio,
  proximoLote,
  relacionadasDe,
  temPendenciaRelacionada,
} from "./fila";
import type { ColoniaServidor, OperacaoFila } from "./tipos";

let seq = 0;
function op(parcial: Partial<OperacaoFila> & Pick<OperacaoFila, "entidadeId">): OperacaoFila {
  seq += 1;
  return {
    id: `op${seq}`,
    tipo: "colonia",
    operacao: "update",
    dados: {},
    criadoEm: "2026-11-09T10:00:00.000Z",
    ordem: seq,
    estado: "pendente",
    tentativas: 0,
    relacionadas: [],
    ...parcial,
  };
}

describe("relacionadasDe", () => {
  it("colônia: mãe e doadora; avaliação e colheita: a colônia", () => {
    expect(relacionadasDe("colonia", { coloniaMaeId: "m", coloniaDoadoraCampeirasId: "d" })).toEqual(["m", "d"]);
    expect(relacionadasDe("colonia", { coloniaMaeId: null })).toEqual([]);
    expect(relacionadasDe("avaliacao", {}, "c1")).toEqual(["c1"]);
    expect(relacionadasDe("producao", { coloniaId: "c2" })).toEqual(["c2"]);
  });
});

describe("temPendenciaRelacionada", () => {
  it("só conta operações da própria entidade ou das referenciadas", () => {
    const fila = [op({ entidadeId: "c1" })];
    expect(temPendenciaRelacionada(fila, ["a1", "c1"])).toBe(true);
    expect(temPendenciaRelacionada(fila, ["a1", "c2"])).toBe(false);
    expect(temPendenciaRelacionada([], ["c1"])).toBe(false);
  });

  it("também no sentido inverso: operação que referencia a entidade (excluir colônia com avaliação na fila)", () => {
    const fila = [op({ tipo: "avaliacao", operacao: "create", entidadeId: "a1", coloniaId: "c1", relacionadas: ["c1"] })];
    expect(temPendenciaRelacionada(fila, ["c1"])).toBe(true);
  });
});

describe("baseUpdatedAt", () => {
  it("só a primeira operação de uma entidade leva a versão editada", () => {
    expect(baseParaUpdate([], "c1", "2026-11-01T00:00:00.000Z")).toBe("2026-11-01T00:00:00.000Z");
    expect(baseParaUpdate([op({ entidadeId: "c1" })], "c1", "2026-11-01T00:00:00.000Z")).toBeUndefined();
    expect(baseParaUpdate([op({ entidadeId: "c2" })], "c1", "2026-11-01T00:00:00.000Z")).toBe("2026-11-01T00:00:00.000Z");
  });

  it("montarOperacao: update guarda base e baseUpdatedAt; create e delete não", () => {
    const base = { id: "c1", codigo: "COL-001" } as ColoniaServidor;
    const comum = { id: "x", tipo: "colonia" as const, entidadeId: "c1", dados: { coloniaMaeId: "m1" }, criadoEm: "2026-11-09T10:00:00.000Z", base, updatedAtEditado: "2026-11-01T00:00:00.000Z" };

    const update = montarOperacao([], { ...comum, operacao: "update" });
    expect(update).toMatchObject({ baseUpdatedAt: "2026-11-01T00:00:00.000Z", base, estado: "pendente", tentativas: 0, relacionadas: ["m1"] });

    const create = montarOperacao([], { ...comum, operacao: "create" });
    expect(create).not.toHaveProperty("baseUpdatedAt");
    expect(create).not.toHaveProperty("base");
  });
});

describe("proximoLote", () => {
  it("ordem de criação e no máximo 500 por lote", () => {
    const fila = Array.from({ length: MAX_LOTE + 3 }, (_, i) => op({ entidadeId: `e${i}` })).reverse();
    const lote = proximoLote(fila);
    expect(lote).toHaveLength(MAX_LOTE);
    expect(lote[0]!.entidadeId).toBe("e0");
    expect(lote.map((o) => o.ordem)).toEqual([...lote.map((o) => o.ordem)].sort((a, b) => a - b));
  });

  it("recusa no create da colônia segura a avaliação dela; outras entidades seguem", () => {
    const colonia = op({ entidadeId: "c1", operacao: "create", estado: "erro" });
    const avaliacao = op({ tipo: "avaliacao", operacao: "create", entidadeId: "a1", coloniaId: "c1", relacionadas: ["c1"] });
    const outra = op({ entidadeId: "c2" });
    expect(proximoLote([colonia, avaliacao, outra]).map((o) => o.entidadeId)).toEqual(["c2"]);
  });

  it("conflito segura as operações seguintes da mesma entidade (e as que dependem delas)", () => {
    const parada = op({ entidadeId: "c1", estado: "conflito" });
    const seguinte = op({ entidadeId: "c1" });
    const filhaDaSeguinte = op({ entidadeId: "c9", relacionadas: ["c1"] });
    expect(proximoLote([parada, seguinte, filhaDaSeguinte])).toEqual([]);
  });

  it("dependente de uma entidade criada no próprio lote fica para o lote seguinte", () => {
    const colonia = op({ entidadeId: "c1", operacao: "create" });
    const outra = op({ entidadeId: "c2", operacao: "update" });
    const avaliacao = op({ tipo: "avaliacao", operacao: "create", entidadeId: "a1", coloniaId: "c1", relacionadas: ["c1"] });
    expect(proximoLote([colonia, outra, avaliacao])).toEqual([colonia, outra]);
    // Já enviada a colônia (fora da fila), a avaliação segue.
    expect(proximoLote([outra, avaliacao])).toEqual([outra, avaliacao]);
  });

  it("operação anterior à parada não é bloqueada", () => {
    const antes = op({ entidadeId: "c1" });
    const parada = op({ entidadeId: "c1", estado: "erro" });
    expect(proximoLote([antes, parada])).toEqual([antes]);
  });
});

describe("aplicarResultados", () => {
  it("aplicado e duplicado saem; conflito e erro ficam parados; sem resultado continua pendente", () => {
    const [a, b, , d, e] = ["c1", "c2", "c3", "c4", "c5"].map((entidadeId) => op({ entidadeId }));
    // Conflito no mesmo campo (base "antes", aparelho "local", servidor "do servidor").
    const c = op({ entidadeId: "c3", dados: { observacoes: "local" }, base: { id: "c3", observacoes: "antes" } as ColoniaServidor });
    const mudancas = aplicarResultados(
      [a!, b!, c!, d!, e!],
      [
        { id: a!.id, status: "aplicado", entidadeId: "c1" },
        { id: b!.id, status: "duplicado", entidadeId: "c2" },
        { id: c!.id, status: "conflito", entidadeId: "c3", erro: "alterado no servidor", servidor: { id: "c3", observacoes: "do servidor" } },
        { id: d!.id, status: "erro", entidadeId: "c4", erro: "A espécie deve ser a mesma" },
      ]
    );
    expect(mudancas.remover).toEqual([a!.id, b!.id]);
    expect(mudancas.atualizar).toEqual([
      {
        ...c,
        estado: "conflito",
        tentativas: 1,
        ultimoErro: "alterado no servidor",
        servidor: { id: "c3", observacoes: "do servidor" },
        conflitos: [{ campo: "observacoes", local: "local", servidor: "do servidor" }],
      },
      { ...d, estado: "erro", tentativas: 1, ultimoErro: "A espécie deve ser a mesma" },
    ]);
  });
});

describe("aplicarResultados: junção por campos no conflito", () => {
  const SERVIDOR = { id: "c1", observacoes: "antes", localizacao: "nova do servidor", updatedAt: "2026-11-09T10:00:00.000Z", especie: { id: "e" }, _count: {} };
  const base = { id: "c1", observacoes: "antes", localizacao: "antiga" } as ColoniaServidor;

  it("campos distintos: volta a pendente só com o que mudou no aparelho, sobre a versão do servidor", () => {
    const o = op({ entidadeId: "c1", dados: { observacoes: "do aparelho", localizacao: "antiga" }, base, baseUpdatedAt: "2026-11-01T00:00:00.000Z" });
    const { remover, atualizar } = aplicarResultados([o], [{ id: o.id, status: "conflito", entidadeId: "c1", servidor: SERVIDOR }]);
    expect(remover).toEqual([]);
    expect(atualizar).toEqual([
      expect.objectContaining({ estado: "pendente", dados: { observacoes: "do aparelho" }, baseUpdatedAt: "2026-11-09T10:00:00.000Z", tentativas: 1 }),
    ]);
    // A nova base é a versão do servidor em formato de linha (sem os campos embutidos pela rota).
    expect(atualizar[0]!.base).toEqual({ id: "c1", observacoes: "antes", localizacao: "nova do servidor", updatedAt: "2026-11-09T10:00:00.000Z" });
    expect(atualizar[0]).not.toHaveProperty("servidor");
  });

  it("o servidor já tem os valores (update que expirou depois de aplicado): sai da fila", () => {
    const o = op({ entidadeId: "c1", dados: { localizacao: "nova do servidor" }, base });
    const { remover, atualizar } = aplicarResultados([o], [{ id: o.id, status: "conflito", entidadeId: "c1", servidor: SERVIDOR }]);
    expect(remover).toEqual([o.id]);
    expect(atualizar).toEqual([]);
  });
});

describe("paraEnvio", () => {
  it("envia só os campos do contrato do /sync", () => {
    const o = op({ entidadeId: "a1", tipo: "avaliacao", coloniaId: "c1", baseUpdatedAt: "2026-11-01T00:00:00.000Z", relacionadas: ["c1"], ultimoErro: "x" });
    expect(Object.keys(paraEnvio(o)).sort()).toEqual(["baseUpdatedAt", "coloniaId", "criadoEm", "dados", "entidadeId", "id", "operacao", "tipo"]);
  });
});
