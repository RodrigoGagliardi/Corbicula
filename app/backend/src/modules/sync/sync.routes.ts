import type { FastifyPluginAsync } from "fastify/types/plugin";
import { authenticate } from "../../shared/middleware/authenticate";
import { syncService } from "./sync.service";
import { alteracoesSyncSchema, loteSyncSchema } from "./sync.types";

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── Push: aplica a fila offline do cliente ───────────────────────────────────
  app.post("/", {
    schema: {
      tags: ["sync"],
      summary: "Envia um lote de operações feitas offline",
      description:
        "Operações (create/update/delete de colonia, avaliacao, producao) são aplicadas em ordem, " +
        "com as mesmas validações da API. Cada operação tem um `id` (UUID do cliente) que torna o " +
        "reenvio idempotente. Updates com `baseUpdatedAt` anterior à versão do servidor voltam como " +
        "`conflito` com a versão atual em `servidor`. Fotos sobem depois, via POST /fotos, " +
        "referenciando os ids gerados no cliente. Retorna sempre 200 com o status de cada operação.",
    },
  }, async (request) => {
    const { operacoes } = loteSyncSchema.parse(request.body);
    return syncService.processarLote(request.userId, operacoes, (err) => request.log.error(err));
  });

  // ── Pull: alterações desde a última sincronização ─────────────────────────────
  app.get("/alteracoes", {
    schema: {
      tags: ["sync"],
      summary: "Retorna registros alterados desde uma data",
      description:
        "Query `desde` (ISO). Sem `desde`, retorna tudo (carga inicial). `idsAtuais` lista todos os " +
        "ids existentes para o cliente detectar exclusões. Use `servidorEm` como próximo `desde`.",
    },
  }, async (request) => {
    const { desde } = alteracoesSyncSchema.parse(request.query);
    return syncService.alteracoes(request.userId, desde);
  });

  // ── Status ────────────────────────────────────────────────────────────────────
  app.get("/status", {
    schema: {
      tags: ["sync"],
      summary: "Última sincronização e operações não aplicadas (conflitos/erros)",
    },
  }, async (request) => syncService.status(request.userId));
};
