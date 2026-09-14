import { prisma } from "../../config/database";
import type { CriarColoniaInput, AtualizarColoniaInput, DimensoesCaixa, FiltrosColonia } from "./colonias.types";

// ─── Includes reutilizáveis ───────────────────────────────────────────────────

const INCLUDE_BASICO = {
  especie: {
    select: { codigo: true, nomePopular: true, nomeCientifico: true },
  },
  _count: {
    select: { avaliacoes: true, producoes: true },
  },
} as const;

const INCLUDE_DETALHADO = {
  especie: {
    select: { codigo: true, nomePopular: true, nomeCientifico: true, caracteristicas: true },
  },
  coloniaMae: {
    select: { id: true, codigo: true },
  },
  coloniasFilhas: {
    select: { id: true, codigo: true, status: true },
    orderBy: { codigo: "asc" as const },
  },
  _count: {
    select: { avaliacoes: true, producoes: true },
  },
} as const;

// ─── Parser de dimensões ──────────────────────────────────────────────────────
// dimensoesCaixa é armazenado como JSON text no banco; o parse é feito aqui
// para não vazar a representação interna para o service/rotas.

export function parsearDimensoes(valor: string | null): DimensoesCaixa | null {
  if (!valor) return null;
  try {
    return JSON.parse(valor) as DimensoesCaixa;
  } catch {
    return null;
  }
}

// ─── Tipo da colônia retornada pelo repositório ───────────────────────────────

type ColoniaBasica = Awaited<ReturnType<typeof coloniasRepository.listar>>[number];
type ColoniaDetalhada = NonNullable<Awaited<ReturnType<typeof coloniasRepository.buscarPorId>>>;

export type { ColoniaBasica, ColoniaDetalhada };

// ─── Repositório ─────────────────────────────────────────────────────────────

export const coloniasRepository = {
  listar: (userId: string, filtros: FiltrosColonia) =>
    prisma.colonia.findMany({
      where: {
        userId,
        ...(filtros.status !== undefined && { status: filtros.status }),
        ...(filtros.especieId !== undefined && { especieId: filtros.especieId }),
      },
      include: INCLUDE_BASICO,
      orderBy: [{ status: "asc" }, { codigo: "asc" }],
    }),

  buscarPorId: (id: string, userId: string) =>
    prisma.colonia.findFirst({
      where: { id, userId },
      include: INCLUDE_DETALHADO,
    }),

  criar: (userId: string, codigo: string, data: CriarColoniaInput) =>
    prisma.colonia.create({
      data: {
        userId,
        codigo,
        dataEntrada: new Date(data.dataEntrada),
        origem: data.origem,
        tipoCaixa: data.tipoCaixa,
        dimensoesCaixa: data.dimensoesCaixa ? JSON.stringify(data.dimensoesCaixa) : null,
        localizacao: data.localizacao ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        observacoes: data.observacoes ?? null,
        especieId: data.especieId ?? null,
        coloniaMaeId: data.coloniaMaeId ?? null,
        status: data.status,
      },
      include: INCLUDE_DETALHADO,
    }),

  // Conditional spreads: undefined = não alterar o campo; null = zerar o campo.
  // A checagem de propriedade (userId) no where é segunda linha de defesa —
  // a primeira é a validação de propriedade feita no service antes de chamar aqui.
  atualizar: (id: string, userId: string, data: AtualizarColoniaInput) =>
    prisma.colonia.update({
      where: { id, userId },
      data: {
        ...(data.dataEntrada !== undefined && { dataEntrada: new Date(data.dataEntrada) }),
        ...(data.origem !== undefined && { origem: data.origem }),
        ...(data.tipoCaixa !== undefined && { tipoCaixa: data.tipoCaixa }),
        ...(data.dimensoesCaixa !== undefined && {
          dimensoesCaixa: data.dimensoesCaixa ? JSON.stringify(data.dimensoesCaixa) : null,
        }),
        ...(data.localizacao !== undefined && { localizacao: data.localizacao }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.observacoes !== undefined && { observacoes: data.observacoes }),
        ...(data.especieId !== undefined && { especieId: data.especieId }),
        ...(data.coloniaMaeId !== undefined && { coloniaMaeId: data.coloniaMaeId }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: INCLUDE_DETALHADO,
    }),

  excluir: (id: string, userId: string) =>
    prisma.colonia.delete({ where: { id, userId } }),

  contarAvaliacoes: (coloniaId: string) =>
    prisma.avaliacao.count({ where: { coloniaId } }),
};
