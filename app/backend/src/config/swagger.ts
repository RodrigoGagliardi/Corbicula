import type { FastifyDynamicSwaggerOptions } from "@fastify/swagger";
import type { FastifySwaggerUiOptions } from "@fastify/swagger-ui";

export const swaggerOptions: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: "Corbicula API",
      description: "API para gestão de colônias de abelhas sem ferrão",
      version: "1.0.0",
    },
    tags: [
      { name: "auth", description: "Autenticação" },
      { name: "users", description: "Usuários e meliponário" },
      { name: "colonias", description: "Colônias" },
      { name: "avaliacoes", description: "Avaliações de colônias" },
      { name: "parametros", description: "Parâmetros de avaliação" },
      { name: "especies", description: "Espécies (catálogo somente leitura)" },
      { name: "producao", description: "Produção e colheitas" },
      { name: "fotos", description: "Fotos (sempre opcionais)" },
      { name: "exportacao", description: "Exportação de dados (CSV/JSON) e backup" },
      { name: "sync", description: "Sincronização offline" },
    ],
  },
};

export const swaggerUiOptions: FastifySwaggerUiOptions = {
  routePrefix: "/api-docs",
};
