import type { FastifyPluginAsync } from "fastify/types/plugin";
import { avaliacoesService } from "./avaliacoes.service";
import { criarAvaliacaoSchema, atualizarAvaliacaoSchema } from "./avaliacoes.types";

// Registrado com prefix "/:coloniaId/avaliacoes" dentro de coloniasRoutes.
// O hook de autenticação e o userId já estão disponíveis pelo escopo pai.
export const avaliacoesRoutes: FastifyPluginAsync = async (app) => {
  // ── Listagem ────────────────────────────────────────────────────────────────
  app.get("/", {
    schema: {
      tags: ["avaliacoes"],
      summary: "Lista o histórico de avaliações de uma colônia",
      description: "Retorna avaliações ordenadas da mais recente para a mais antiga.",
    },
  }, async (request) => {
    const { coloniaId } = request.params as { coloniaId: string };
    return avaliacoesService.listar(coloniaId, request.userId);
  });

  // ── Detalhes ────────────────────────────────────────────────────────────────
  app.get("/:avaliacaoId", {
    schema: {
      tags: ["avaliacoes"],
      summary: "Retorna os detalhes completos de uma avaliação",
      description: "Inclui todos os parâmetros avaliados com classificação e observações.",
    },
  }, async (request) => {
    const { coloniaId, avaliacaoId } = request.params as {
      coloniaId: string;
      avaliacaoId: string;
    };
    return avaliacoesService.buscarPorId(avaliacaoId, coloniaId, request.userId);
  });

  // ── Criação ─────────────────────────────────────────────────────────────────
  app.post("/", {
    schema: {
      tags: ["avaliacoes"],
      summary: "Registra uma nova avaliação",
      description:
        "O score (0–100) e o status (excelente/boa/atencao/critica) são calculados " +
        "automaticamente a partir das classificações dos parâmetros. " +
        "Todos os parâmetros enviados devem pertencer ao usuário e estar ativos.",
    },
  }, async (request, reply) => {
    const { coloniaId } = request.params as { coloniaId: string };
    const data = criarAvaliacaoSchema.parse(request.body);
    const avaliacao = await avaliacoesService.criar(coloniaId, request.userId, data);
    return reply.status(201).send(avaliacao);
  });

  // ── Atualização parcial ──────────────────────────────────────────────────────
  app.patch("/:avaliacaoId", {
    schema: {
      tags: ["avaliacoes"],
      summary: "Edita uma avaliação (disponível por 7 dias após o registro)",
      description:
        "Se 'parametros' for enviado, substitui todos os parâmetros da avaliação " +
        "e recalcula o score. Campos omitidos não são alterados. " +
        "Retorna 409 após 7 dias do registro.",
    },
  }, async (request) => {
    const { coloniaId, avaliacaoId } = request.params as {
      coloniaId: string;
      avaliacaoId: string;
    };
    const data = atualizarAvaliacaoSchema.parse(request.body);
    return avaliacoesService.atualizar(avaliacaoId, coloniaId, request.userId, data);
  });

  // ── Exclusão ────────────────────────────────────────────────────────────────
  app.delete("/:avaliacaoId", {
    schema: {
      tags: ["avaliacoes"],
      summary: "Exclui uma avaliação",
    },
  }, async (request, reply) => {
    const { coloniaId, avaliacaoId } = request.params as {
      coloniaId: string;
      avaliacaoId: string;
    };
    await avaliacoesService.excluir(avaliacaoId, coloniaId, request.userId);
    return reply.status(204).send();
  });
};
