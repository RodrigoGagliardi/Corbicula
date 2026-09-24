import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { FiltrosFoto } from "./fotos.types";

export interface VinculosFoto {
  coloniaId: string;
  avaliacaoId: string | null;
  avaliacaoParametroId: string | null;
  producaoId: string | null;
}

// Toda foto tem coloniaId derivado (ver fotos.service), então a propriedade
// é sempre verificável pela colônia.
const doUsuario = (userId: string): Prisma.FotoWhereInput => ({ colonia: { userId } });

export const fotosRepository = {
  listar: (userId: string, filtros: FiltrosFoto) =>
    prisma.foto.findMany({
      where: {
        ...doUsuario(userId),
        ...(filtros.coloniaId !== undefined && { coloniaId: filtros.coloniaId }),
        ...(filtros.avaliacaoId !== undefined && { avaliacaoId: filtros.avaliacaoId }),
        ...(filtros.avaliacaoParametroId !== undefined && {
          avaliacaoParametroId: filtros.avaliacaoParametroId,
        }),
        ...(filtros.producaoId !== undefined && { producaoId: filtros.producaoId }),
      },
      orderBy: { createdAt: "desc" },
    }),

  buscarPorId: (id: string, userId: string) =>
    prisma.foto.findFirst({ where: { id, ...doUsuario(userId) } }),

  criar: (url: string, tamanhoKb: number, legenda: string | null, vinculos: VinculosFoto) =>
    prisma.foto.create({ data: { url, tamanhoKb, legenda, ...vinculos } }),

  atualizarLegenda: (id: string, legenda: string | null) =>
    prisma.foto.update({ where: { id }, data: { legenda } }),

  excluir: (id: string) => prisma.foto.delete({ where: { id } }),

  listarUrls: async (where: Prisma.FotoWhereInput) =>
    (await prisma.foto.findMany({ where, select: { url: true } })).map((f) => f.url),
};
