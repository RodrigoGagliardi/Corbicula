import { prisma } from "../../config/database";
import type { CriarParametroInput, AtualizarParametroInput, CriterioEspecieInput } from "./parametros.types";

// Inclui os critérios por espécie em todas as queries de parâmetro.
// O dataset é pequeno (máx. ~22 espécies por parâmetro) — carregar junto é intencional.
const INCLUDE_COMPLETO = {
  criteriosEspecie: {
    include: {
      especie: { select: { id: true, codigo: true, nomePopular: true } },
    },
    orderBy: { especie: { nomePopular: "asc" as const } },
  },
  _count: { select: { avaliacoesParametros: true } },
} as const;

export const parametrosRepository = {
  listar: (userId: string, ativo?: boolean) =>
    prisma.parametro.findMany({
      where: {
        userId,
        ...(ativo !== undefined && { ativo }),
      },
      include: INCLUDE_COMPLETO,
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    }),

  buscarPorId: (id: string, userId: string) =>
    prisma.parametro.findFirst({
      where: { id, userId },
      include: INCLUDE_COMPLETO,
    }),

  criar: (userId: string, data: CriarParametroInput) =>
    prisma.parametro.create({
      data: {
        userId,
        nome: data.nome,
        ordem: data.ordem,
        criterioBom: data.criterioBom,
        criterioMedio: data.criterioMedio,
        criterioRuim: data.criterioRuim,
      },
      include: INCLUDE_COMPLETO,
    }),

  atualizar: (id: string, userId: string, data: AtualizarParametroInput) =>
    prisma.parametro.update({
      where: { id, userId },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.ordem !== undefined && { ordem: data.ordem }),
        ...(data.criterioBom !== undefined && { criterioBom: data.criterioBom }),
        ...(data.criterioMedio !== undefined && { criterioMedio: data.criterioMedio }),
        ...(data.criterioRuim !== undefined && { criterioRuim: data.criterioRuim }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
      include: INCLUDE_COMPLETO,
    }),

  excluir: (id: string, userId: string) =>
    prisma.parametro.delete({ where: { id, userId } }),

  contarUsos: (parametroId: string) =>
    prisma.avaliacaoParametro.count({ where: { parametroId } }),

  // PUT semântico: cria o critério de espécie se não existir, atualiza se já existir.
  upsertCriterioEspecie: (parametroId: string, especieId: string, data: CriterioEspecieInput) =>
    prisma.parametroEspecie.upsert({
      where: { parametroId_especieId: { parametroId, especieId } },
      create: { parametroId, especieId, ...data },
      update: { ...data },
      include: {
        especie: { select: { id: true, codigo: true, nomePopular: true } },
      },
    }),

  excluirCriterioEspecie: (parametroId: string, especieId: string) =>
    prisma.parametroEspecie.delete({
      where: { parametroId_especieId: { parametroId, especieId } },
    }),
};
