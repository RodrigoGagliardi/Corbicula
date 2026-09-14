import type { FastifyPluginAsync } from "fastify/types/plugin";
import { z } from "zod";
import { prisma } from "../../config/database";
import { authenticate } from "../../shared/middleware/authenticate";

// Converte os campos JSON armazenados como string para objetos antes de retornar.
function parsearEspecie<
  T extends {
    nomesAlternativos: string | null;
    caracteristicas: string | null;
    ocorrenciaBiomas: string | null;
  },
>(e: T) {
  return {
    ...e,
    nomesAlternativos: e.nomesAlternativos ? (JSON.parse(e.nomesAlternativos) as string[]) : [],
    caracteristicas: e.caracteristicas ? (JSON.parse(e.caracteristicas) as Record<string, string>) : null,
    ocorrenciaBiomas: e.ocorrenciaBiomas ? (JSON.parse(e.ocorrenciaBiomas) as string[]) : [],
  };
}

const filtrosSchema = z.object({
  q: z.string().optional(), // busca por nome popular, científico ou código Kew
});

export const especiesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  // Lista todas as espécies. Aceita ?q= para filtrar por nome (autocomplete).
  // O catálogo tem ~22 registros — retornar todos de uma vez é intencional.
  app.get("/", {
    schema: {
      tags: ["especies"],
      summary: "Lista o catálogo de espécies de meliponíneos do RS",
      description:
        "Catálogo fixo populado por seed. Use ?q= para filtrar por nome popular, " +
        "nome científico ou código Kew (autocomplete no cadastro de colônias).",
    },
  }, async (request) => {
    const { q } = filtrosSchema.parse(request.query);

    const especies = await prisma.especie.findMany({
      // exactOptionalPropertyTypes: onde não pode ser undefined — omite a propriedade quando não há filtro
      ...(q && {
        where: {
          OR: [
            { nomePopular: { contains: q, mode: "insensitive" } },
            { nomeCientifico: { contains: q, mode: "insensitive" } },
            { codigo: { contains: q, mode: "insensitive" } },
          ],
        },
      }),
      orderBy: { nomePopular: "asc" },
    });

    return especies.map(parsearEspecie);
  });

  // Retorna uma espécie pelo código Kew (ex.: /especies/TETRANGU).
  app.get("/:codigo", {
    schema: {
      tags: ["especies"],
      summary: "Retorna uma espécie pelo código Kew",
    },
  }, async (request) => {
    const { codigo } = request.params as { codigo: string };

    const especie = await prisma.especie.findUnique({ where: { codigo } });
    if (!especie) {
      const err = new Error("Espécie não encontrada");
      (err as NodeJS.ErrnoException).code = "NOT_FOUND";
      throw err;
    }

    return parsearEspecie(especie);
  });
};
