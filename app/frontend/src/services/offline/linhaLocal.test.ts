import { describe, expect, it } from "vitest";
import type { Especie } from "../../types/api";
import {
  atualizarAvaliacao,
  atualizarColonia,
  atualizarProducao,
  codigoProvisorio,
  novaAvaliacao,
  novaColonia,
  novaProducao,
} from "./linhaLocal";
import type { ColoniaServidor } from "./tipos";

const AGORA = "2026-11-09T13:00:00.000Z";
const especies = [{ id: "e-jatai", codigo: "TETRANGU" }] as Especie[];
const colonia = (id: string, codigo: string, extra: Partial<ColoniaServidor> = {}) =>
  ({ id, codigo, especieId: null, status: "ativa", statusDesde: null, motivoStatus: null, motivoStatusDetalhe: null, updatedAt: "2026-11-01T00:00:00.000Z", ...extra }) as ColoniaServidor;
let n = 0;
const gerarId = () => `id${++n}`;

describe("codigoProvisorio", () => {
  it("próximo número do prefixo, marcado como provisório", () => {
    const colonias = [colonia("1", "TETRANGU-001"), colonia("2", "TETRANGU-007"), colonia("3", "COL-002"), colonia("4", "TETRANGU-008 (provisório)")];
    expect(codigoProvisorio("TETRANGU", colonias)).toBe("TETRANGU-009 (provisório)");
    expect(codigoProvisorio("MELIQUAD", colonias)).toBe("MELIQUAD-001 (provisório)");
    // Subespécie tem prefixo próprio.
    expect(codigoProvisorio("MELIBICO", [colonia("5", "MELIBICO_SCHE-004")])).toBe("MELIBICO-001 (provisório)");
  });
});

describe("colônia", () => {
  it("create: código provisório da espécie, sem entrada de status", () => {
    const linha = novaColonia(
      "c9",
      { dataEntrada: "2026-11-01T12:00:00.000Z", origem: "captura", tipoCaixa: "inpa", especieId: "e-jatai" } as never,
      { userId: "u1", especies, colonias: [colonia("1", "TETRANGU-002")], agora: AGORA }
    );
    expect(linha).toMatchObject({ id: "c9", userId: "u1", codigo: "TETRANGU-003 (provisório)", status: "ativa", statusDesde: null, coloniaMaeId: null, createdAt: AGORA, updatedAt: AGORA });
  });

  it("filha sem espécie herda a da mãe (código provisório da espécie)", () => {
    const mae = colonia("m", "TETRANGU-002", { especieId: "e-jatai" });
    const linha = novaColonia(
      "f",
      { dataEntrada: "2026-11-01T12:00:00.000Z", origem: "divisao", tipoCaixa: "inpa", coloniaMaeId: "m" } as never,
      { userId: "u1", especies, colonias: [mae], agora: AGORA }
    );
    expect(linha).toMatchObject({ especieId: "e-jatai", codigo: "TETRANGU-003 (provisório)", coloniaMaeId: "m" });
  });

  it("sem espécie: COL", () => {
    const linha = novaColonia("c9", { dataEntrada: "2026-11-01T12:00:00.000Z", origem: "captura", tipoCaixa: "inpa" } as never, { userId: "u1", especies, colonias: [], agora: AGORA });
    expect(linha.codigo).toBe("COL-001 (provisório)");
  });

  it("update: mudança de status grava data e motivo; preserva o updatedAt do servidor", () => {
    const linha = colonia("c1", "TETRANGU-001");
    const nova = atualizarColonia(linha, { status: "morta", motivoStatus: "fome_escassez", observacoes: "x" }, { userId: "u1", especies, colonias: [linha], agora: AGORA });
    expect(nova).toMatchObject({ status: "morta", statusDesde: AGORA, motivoStatus: "fome_escassez", motivoStatusDetalhe: null, observacoes: "x", updatedAt: linha.updatedAt });

    const comData = atualizarColonia(linha, { status: "inativa", statusDesde: "2026-11-05T12:00:00.000Z" }, { userId: "u1", especies, colonias: [linha], agora: AGORA });
    expect(comData.statusDesde).toBe("2026-11-05T12:00:00.000Z");
  });

  it("update sem mudar o status: corrige data e motivo atuais", () => {
    const linha = colonia("c1", "TETRANGU-001", { status: "morta", statusDesde: "2026-11-02T00:00:00.000Z", motivoStatus: "fome_escassez" });
    const nova = atualizarColonia(linha, { status: "morta", motivoStatus: "outro", motivoStatusDetalhe: "formigas" }, { userId: "u1", especies, colonias: [linha], agora: AGORA });
    expect(nova).toMatchObject({ statusDesde: "2026-11-02T00:00:00.000Z", motivoStatus: "outro", motivoStatusDetalhe: "formigas" });
  });

  it("update que identifica uma colônia COL ganha código provisório da espécie", () => {
    const linha = colonia("c1", "COL-001");
    const nova = atualizarColonia(linha, { especieId: "e-jatai" }, { userId: "u1", especies, colonias: [linha, colonia("c2", "TETRANGU-004")], agora: AGORA });
    expect(nova).toMatchObject({ especieId: "e-jatai", codigo: "TETRANGU-005 (provisório)" });
  });
});

describe("avaliação", () => {
  const dados = {
    dataAvaliacao: "2026-11-09T12:00:00.000Z",
    parametros: [
      { parametroId: "p1", classificacao: "bom" as const },
      { parametroId: "p2", classificacao: "medio" as const, observacoes: "pouca cria" },
    ],
    acoesTomadas: ["Limpeza realizada"],
  };

  it("create: prévia do score, parâmetros e clima vazio", () => {
    const linha = novaAvaliacao("a1", "c1", dados, AGORA, gerarId);
    expect(linha).toMatchObject({ id: "a1", coloniaId: "c1", scoreGeral: 75, statusGeral: "boa", climaFonte: null, temperatura: null, protocoloId: null, acoesTomadas: ["Limpeza realizada"], createdAt: AGORA });
    expect(linha.parametros).toEqual([
      expect.objectContaining({ avaliacaoId: "a1", parametroId: "p1", classificacao: "bom", observacoes: null }),
      expect.objectContaining({ avaliacaoId: "a1", parametroId: "p2", classificacao: "medio", observacoes: "pouca cria" }),
    ]);
  });

  it("update: recalcula a prévia com o novo conjunto; sem parâmetros, mantém", () => {
    const linha = novaAvaliacao("a1", "c1", dados, "2026-11-08T00:00:00.000Z", gerarId);
    const nova = atualizarAvaliacao(linha, { parametros: [{ parametroId: "p1", classificacao: "ruim" }] }, AGORA, gerarId);
    expect(nova).toMatchObject({ scoreGeral: 0, statusGeral: "critica", updatedAt: linha.updatedAt });
    expect(nova.parametros).toHaveLength(1);

    const soTexto = atualizarAvaliacao(linha, { observacoesGerais: "ok", acoesTomadas: null }, AGORA, gerarId);
    expect(soTexto).toMatchObject({ scoreGeral: 75, observacoesGerais: "ok", acoesTomadas: [] });
  });
});

describe("colheita", () => {
  it("create e update", () => {
    const linha = novaProducao("p1", { coloniaId: "c1", dataColheita: "2026-11-09T12:00:00.000Z", tipoProduto: "mel", quantidade: 120, unidade: "ml" }, AGORA);
    expect(linha).toMatchObject({ id: "p1", coloniaId: "c1", caracteristicas: null, observacoes: null, createdAt: AGORA });
    expect(atualizarProducao(linha, { quantidade: 150 })).toMatchObject({ quantidade: 150, unidade: "ml", updatedAt: AGORA });
  });
});
