import { prisma } from "../../config/database";

export const alertasRepository = {
  // Colônias ativas com as 2 inspeções mais recentes (a anterior serve para
  // detectar queda de score) e os parâmetros classificados como Ruim.
  coloniasParaAlertas: (userId: string) =>
    prisma.colonia.findMany({
      where: { userId, status: "ativa" },
      select: {
        id: true,
        codigo: true,
        dataEntrada: true,
        frequenciaInspecaoDias: true,
        especie: { select: { codigo: true, nomePopular: true } },
        avaliacoes: {
          orderBy: [{ dataAvaliacao: "desc" }, { createdAt: "desc" }],
          take: 2,
          select: {
            id: true,
            dataAvaliacao: true,
            scoreGeral: true,
            statusGeral: true,
            parametros: {
              where: { classificacao: "ruim" },
              select: { parametro: { select: { id: true, nome: true, ordem: true } } },
            },
          },
        },
      },
      orderBy: { codigo: "asc" },
    }),

  resolvidos: (userId: string) =>
    prisma.alertaResolvido.findMany({ where: { userId }, select: { chave: true, resolvidoEm: true } }),

  resolver: (userId: string, chave: string) =>
    prisma.alertaResolvido.upsert({
      where: { userId_chave: { userId, chave } },
      create: { userId, chave },
      update: {},
    }),

  reabrir: (userId: string, chave: string) => prisma.alertaResolvido.deleteMany({ where: { userId, chave } }),
};
