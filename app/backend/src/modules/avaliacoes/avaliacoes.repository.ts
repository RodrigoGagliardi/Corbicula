import { prisma } from "../../config/database";
import type { CriarAvaliacaoInput, AtualizarAvaliacaoInput } from "./avaliacoes.types";

// ─── Includes ─────────────────────────────────────────────────────────────────

// Lista: leve — sem parametros detalhados, só contagem.
const INCLUDE_LISTA = {
  _count: { select: { parametros: true } },
} as const;

// Detalhe: completo — parametros com nome e ordem do parâmetro pai.
const INCLUDE_COMPLETO = {
  parametros: {
    include: {
      parametro: { select: { id: true, nome: true, ordem: true } },
    },
    orderBy: { parametro: { ordem: "asc" as const } },
  },
} as const;

// ─── Helpers de serialização ──────────────────────────────────────────────────

function serializarParametros(
  parametros: CriarAvaliacaoInput["parametros"]
): { parametroId: string; classificacao: string; valorNumerico: number | null; observacoes: string | null }[] {
  return parametros.map((p) => ({
    parametroId: p.parametroId,
    classificacao: p.classificacao,
    valorNumerico: p.valorNumerico ?? null,
    observacoes: p.observacoes ?? null,
  }));
}

// ─── Repositório ─────────────────────────────────────────────────────────────

export const avaliacoesRepository = {
  listar: (coloniaId: string) =>
    prisma.avaliacao.findMany({
      where: { coloniaId },
      include: INCLUDE_LISTA,
      orderBy: { dataAvaliacao: "desc" },
    }),

  buscarPorId: (id: string, coloniaId: string) =>
    prisma.avaliacao.findFirst({
      where: { id, coloniaId },
      include: INCLUDE_COMPLETO,
    }),

  criar: (
    coloniaId: string,
    scoreGeral: number,
    statusGeral: string,
    data: CriarAvaliacaoInput
  ) =>
    prisma.avaliacao.create({
      data: {
        ...(data.id !== undefined && { id: data.id }),
        coloniaId,
        dataAvaliacao: new Date(data.dataAvaliacao),
        duracaoMinutos: data.duracaoMinutos ?? null,
        temperatura: data.temperatura ?? null,
        umidade: data.umidade ?? null,
        condicaoClimatica: data.condicaoClimatica ?? null,
        observacoesGerais: data.observacoesGerais ?? null,
        acoesTomadas: data.acoesTomadas ? JSON.stringify(data.acoesTomadas) : null,
        scoreGeral,
        statusGeral,
        parametros: { create: serializarParametros(data.parametros) },
      },
      include: INCLUDE_COMPLETO,
    }),

  // Quando `data.parametros` está presente, substitui o conjunto de parâmetros
  // via transação: remove os que saíram e faz upsert dos enviados. O score
  // reflete exatamente o conjunto enviado, e parâmetros mantidos preservam o
  // id — e com ele as fotos vinculadas (fotos.avaliacaoParametroId).
  atualizar: async (
    id: string,
    scoreGeral: number,
    statusGeral: string,
    data: AtualizarAvaliacaoInput
  ) => {
    const camposBase = {
      ...(data.dataAvaliacao !== undefined && { dataAvaliacao: new Date(data.dataAvaliacao) }),
      ...(data.duracaoMinutos !== undefined && { duracaoMinutos: data.duracaoMinutos }),
      ...(data.temperatura !== undefined && { temperatura: data.temperatura }),
      ...(data.umidade !== undefined && { umidade: data.umidade }),
      ...(data.condicaoClimatica !== undefined && { condicaoClimatica: data.condicaoClimatica }),
      ...(data.observacoesGerais !== undefined && { observacoesGerais: data.observacoesGerais }),
      ...(data.acoesTomadas !== undefined && {
        acoesTomadas: data.acoesTomadas ? JSON.stringify(data.acoesTomadas) : null,
      }),
    };

    if (data.parametros) {
      const novos = serializarParametros(data.parametros);
      return prisma.$transaction(async (tx) => {
        await tx.avaliacaoParametro.deleteMany({
          where: { avaliacaoId: id, parametroId: { notIn: novos.map((p) => p.parametroId) } },
        });
        for (const { parametroId, ...campos } of novos) {
          await tx.avaliacaoParametro.upsert({
            where: { avaliacaoId_parametroId: { avaliacaoId: id, parametroId } },
            update: campos,
            create: { avaliacaoId: id, parametroId, ...campos },
          });
        }
        return tx.avaliacao.update({
          where: { id },
          data: { ...camposBase, scoreGeral, statusGeral },
          include: INCLUDE_COMPLETO,
        });
      });
    }

    return prisma.avaliacao.update({
      where: { id },
      data: camposBase,
      include: INCLUDE_COMPLETO,
    });
  },

  excluir: (id: string, coloniaId: string) =>
    prisma.avaliacao.delete({ where: { id, coloniaId } }),

  existeId: async (id: string) => (await prisma.avaliacao.count({ where: { id } })) > 0,
};
