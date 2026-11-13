import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { CriarColoniaInput, AtualizarColoniaInput, DimensoesCaixa, FiltrosColonia } from "./colonias.types";

// ─── Includes reutilizáveis ───────────────────────────────────────────────────

// Avaliação mais recente — alimenta score atual e "dias desde a última inspeção".
const ULTIMA_AVALIACAO = {
  select: { id: true, dataAvaliacao: true, scoreGeral: true, statusGeral: true },
  orderBy: { dataAvaliacao: "desc" as const },
  take: 1,
};

const INCLUDE_BASICO = {
  especie: {
    select: { codigo: true, nomePopular: true, nomeCientifico: true },
  },
  avaliacoes: ULTIMA_AVALIACAO,
  _count: {
    select: { avaliacoes: true, producoes: true },
  },
} as const;

const INCLUDE_DETALHADO = {
  especie: {
    select: { codigo: true, nomePopular: true, nomeCientifico: true, caracteristicas: true },
  },
  avaliacoes: ULTIMA_AVALIACAO,
  coloniaMae: {
    select: { id: true, codigo: true },
  },
  coloniasFilhas: {
    select: { id: true, codigo: true, status: true },
    orderBy: { codigo: "asc" as const },
  },
  coloniaDoadoraCampeiras: {
    select: { id: true, codigo: true },
  },
  coloniasReceptorasCampeiras: {
    select: { id: true, codigo: true, status: true },
    orderBy: { codigo: "asc" as const },
  },
  // Mudanças de status, da mais antiga para a mais recente.
  historicoStatus: {
    select: {
      id: true,
      statusAnterior: true,
      statusNovo: true,
      dataPercebida: true,
      motivo: true,
      motivoDetalhe: true,
      createdAt: true,
      updatedAt: true,
    },
    // id desempata entradas criadas no mesmo milissegundo (ex.: lote do /sync).
    orderBy: [{ createdAt: "asc" }, { id: "asc" }] as Prisma.ColoniaStatusHistoricoOrderByWithRelationInput[],
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

// ─── Mudança de status ────────────────────────────────────────────────────────
// Calculada no service: os campos de status da colônia e o que fazer com o
// histórico (nova entrada quando o status muda; corrigir a última quando só o
// motivo/data mudam; sem entrada, a correção cria a primeira com statusAnterior
// nulo).

interface EntradaHistorico {
  statusAnterior: string | null;
  statusNovo: string;
  dataPercebida: Date;
  motivo: string | null;
  motivoDetalhe: string | null;
}

export interface AlteracaoStatus {
  colonia: { statusDesde?: Date; motivoStatus?: string | null; motivoStatusDetalhe?: string | null };
  historico:
    | { tipo: "nova"; entrada: EntradaHistorico }
    | {
        tipo: "corrigir";
        campos: { dataPercebida?: Date; motivo?: string | null; motivoDetalhe?: string | null };
        primeira: EntradaHistorico; // usada quando a colônia ainda não tem entrada
      };
}

// createdAt e updatedAt iguais na criação: diferem só quando a entrada é corrigida.
const agora = () => {
  const d = new Date();
  return { createdAt: d, updatedAt: d };
};

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
        ...(data.id !== undefined && { id: data.id }),
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
        coloniaDoadoraCampeirasId: data.coloniaDoadoraCampeirasId ?? null,
        status: data.status,
        frequenciaInspecaoDias: data.frequenciaInspecaoDias ?? null,
      },
      include: INCLUDE_DETALHADO,
    }),

  // Conditional spreads: undefined = não alterar o campo; null = zerar o campo.
  // A checagem de propriedade (userId) no where é segunda linha de defesa —
  // a primeira é a validação de propriedade feita no service antes de chamar aqui.
  // O histórico de status é escrito na mesma transação do update.
  atualizar: (
    id: string,
    userId: string,
    data: AtualizarColoniaInput & { codigo?: string },
    status?: AlteracaoStatus
  ) =>
    prisma.$transaction(async (tx) => {
      if (status?.historico.tipo === "nova") {
        await tx.coloniaStatusHistorico.create({ data: { coloniaId: id, ...status.historico.entrada, ...agora() } });
      }
      if (status?.historico.tipo === "corrigir") {
        const ultima = await tx.coloniaStatusHistorico.findFirst({
          where: { coloniaId: id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true },
        });
        if (ultima) {
          await tx.coloniaStatusHistorico.update({ where: { id: ultima.id }, data: status.historico.campos });
        } else {
          await tx.coloniaStatusHistorico.create({ data: { coloniaId: id, ...status.historico.primeira, ...agora() } });
        }
      }
      return tx.colonia.update({
        where: { id, userId },
        data: {
          ...status?.colonia,
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
          ...(data.frequenciaInspecaoDias !== undefined && { frequenciaInspecaoDias: data.frequenciaInspecaoDias }),
          ...(data.especieId !== undefined && { especieId: data.especieId }),
          ...(data.coloniaMaeId !== undefined && { coloniaMaeId: data.coloniaMaeId }),
          ...(data.coloniaDoadoraCampeirasId !== undefined && {
            coloniaDoadoraCampeirasId: data.coloniaDoadoraCampeirasId,
          }),
          ...(data.codigo !== undefined && { codigo: data.codigo }),
          ...(data.status !== undefined && { status: data.status }),
        },
        include: INCLUDE_DETALHADO,
      });
    }),

  excluir: (id: string, userId: string) =>
    prisma.colonia.delete({ where: { id, userId } }),

  contarAvaliacoes: (coloniaId: string) =>
    prisma.avaliacao.count({ where: { coloniaId } }),

  existeId: async (id: string) => (await prisma.colonia.count({ where: { id } })) > 0,
};
