import type { FastifyPluginAsync } from "fastify/types/plugin";
import { authenticate } from "../../shared/middleware/authenticate";
import { alertasService } from "./alertas.service";
import { chaveAlertaSchema, filtrosAlertasSchema } from "./alertas.types";

export const alertasRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/", {
    schema: {
      tags: ["alertas"],
      summary: "Alertas calculados a partir das inspeções (Central de Alertas)",
      description:
        "Tipos: nunca_avaliada, sem_inspecao, score_baixo, queda_score, parametro_ruim. " +
        "?diasSemInspecao=30 (preferência geral; a frequência da colônia tem prioridade) e ?incluirResolvidos=true. " +
        "A resposta traz os totais e os critérios usados.",
    },
  }, async (request) => {
    const filtros = filtrosAlertasSchema.parse(request.query);
    return alertasService.listar(request.userId, filtros);
  });

  app.post("/resolvidos", {
    schema: {
      tags: ["alertas"],
      summary: "Marca um alerta como resolvido",
      description: 'Body: { "chave": "<chave do alerta>" }. Idempotente.',
    },
  }, async (request, reply) => {
    const { chave } = chaveAlertaSchema.parse(request.body);
    await alertasService.resolver(request.userId, chave);
    return reply.status(204).send();
  });

  app.delete("/resolvidos", {
    schema: {
      tags: ["alertas"],
      summary: "Reabre um alerta marcado como resolvido",
      description: 'Body: { "chave": "<chave do alerta>" }. Idempotente.',
    },
  }, async (request, reply) => {
    const { chave } = chaveAlertaSchema.parse(request.body);
    await alertasService.reabrir(request.userId, chave);
    return reply.status(204).send();
  });
};
