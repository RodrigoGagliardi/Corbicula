import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type {
  AtualizarProducaoInput,
  Caracteristicas,
  CriarProducaoInput,
  FiltrosProducao,
} from "./producoes.types";

const INCLUDE_COLONIA = {
  colonia: {
    select: {
      id: true,
      codigo: true,
      especie: { select: { codigo: true, nomePopular: true, nomeCientifico: true } },
    },
  },
  _count: { select: { fotos: true } },
} as const;

export function parsearCaracteristicas(valor: string | null): Caracteristicas | null {
  if (!valor) return null;
  try {
    return JSON.parse(valor) as Caracteristicas;
  } catch {
    return null;
  }
}

export function filtrosParaWhere(userId: string, filtros: FiltrosProducao): Prisma.ProducaoWhereInput {
  return {
    colonia: { userId },
    ...(filtros.coloniaId !== undefined && { coloniaId: filtros.coloniaId }),
    ...(filtros.tipoProduto !== undefined && { tipoProduto: filtros.tipoProduto }),
    ...((filtros.desde !== undefined || filtros.ate !== undefined) && {
      dataColheita: {
        ...(filtros.desde !== undefined && { gte: filtros.desde }),
        ...(filtros.ate !== undefined && { lte: filtros.ate }),
      },
    }),
  };
}

export const producoesRepository = {
  listar: (userId: string, filtros: FiltrosProducao) =>
    prisma.producao.findMany({
      where: filtrosParaWhere(userId, filtros),
      include: INCLUDE_COLONIA,
      orderBy: { dataColheita: "desc" },
    }),

  buscarPorId: (id: string, userId: string) =>
    prisma.producao.findFirst({
      where: { id, colonia: { userId } },
      include: INCLUDE_COLONIA,
    }),

  existeId: async (id: string) => (await prisma.producao.count({ where: { id } })) > 0,

  criar: (data: CriarProducaoInput) =>
    prisma.producao.create({
      data: {
        ...(data.id !== undefined && { id: data.id }),
        coloniaId: data.coloniaId,
        dataColheita: new Date(data.dataColheita),
        tipoProduto: data.tipoProduto,
        quantidade: data.quantidade,
        unidade: data.unidade,
        caracteristicas: data.caracteristicas ? JSON.stringify(data.caracteristicas) : null,
        observacoes: data.observacoes ?? null,
      },
      include: INCLUDE_COLONIA,
    }),

  atualizar: (id: string, data: AtualizarProducaoInput) =>
    prisma.producao.update({
      where: { id },
      data: {
        ...(data.dataColheita !== undefined && { dataColheita: new Date(data.dataColheita) }),
        ...(data.tipoProduto !== undefined && { tipoProduto: data.tipoProduto }),
        ...(data.quantidade !== undefined && { quantidade: data.quantidade }),
        ...(data.unidade !== undefined && { unidade: data.unidade }),
        ...(data.caracteristicas !== undefined && {
          caracteristicas: data.caracteristicas ? JSON.stringify(data.caracteristicas) : null,
        }),
        ...(data.observacoes !== undefined && { observacoes: data.observacoes }),
      },
      include: INCLUDE_COLONIA,
    }),

  excluir: (id: string) => prisma.producao.delete({ where: { id } }),
};
