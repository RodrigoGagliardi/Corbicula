import type { FastifyInstance } from "fastify/types/instance";
import type { FastifyReply } from "fastify/types/reply";
import type { FastifyRequest } from "fastify/types/request";
import { mkdir } from "node:fs/promises";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";
import { swaggerOptions, swaggerUiOptions } from "./config/swagger";
import { authRoutes } from "./modules/auth/auth.routes";
import { coloniasRoutes } from "./modules/colonias/colonias.routes";
import { especiesRoutes } from "./modules/especies/especies.routes";
import { exportacaoRoutes } from "./modules/exportacao/exportacao.routes";
import { fotosRoutes } from "./modules/fotos/fotos.routes";
import { TAMANHO_MAX_BYTES } from "./modules/fotos/fotos.types";
import { parametrosRoutes } from "./modules/parametros/parametros.routes";
import { producoesRoutes } from "./modules/producoes/producoes.routes";
import { syncRoutes } from "./modules/sync/sync.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { env } from "./shared/env";

// Monta a aplicação sem abrir porta — usado pelo server.ts e pelos testes (app.inject).
export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app: FastifyInstance = require("fastify")({
    logger: opts.logger === false ? false : { transport: { target: "pino-pretty" } },
  });

  await app.register(cors);
  await app.register(multipart, { limits: { fileSize: TAMANHO_MAX_BYTES, files: 1 } });

  // Fotos: servidas estaticamente com nomes UUID (não adivinháveis).
  await mkdir(env.UPLOADS_DIR, { recursive: true });
  await app.register(fastifyStatic, { root: env.UPLOADS_DIR, prefix: "/uploads/" });
  await app.register(swagger, swaggerOptions);
  await app.register(swaggerUi, swaggerUiOptions);

  app.setErrorHandler(
    (error: Error, _request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: "Dados inválidos",
          detalhes: error.issues.map((e) => ({
            campo: e.path.join("."),
            mensagem: e.message,
          })),
        });
      }

      const code = (error as NodeJS.ErrnoException).code;
      if (code === "CONFLICT") return reply.status(409).send({ error: error.message });
      if (code === "UNAUTHORIZED") return reply.status(401).send({ error: error.message });
      if (code === "NOT_FOUND") return reply.status(404).send({ error: error.message });
      if (code === "BAD_REQUEST") return reply.status(400).send({ error: error.message });

      // Erros do próprio Fastify/plugins (JSON malformado, arquivo grande demais etc.)
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
        return reply.status(statusCode).send({ error: error.message });
      }

      app.log.error(error);
      return reply.status(500).send({ error: "Erro interno do servidor" });
    }
  );

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes, { prefix: "/users" });
  await app.register(coloniasRoutes, { prefix: "/colonias" });
  await app.register(especiesRoutes, { prefix: "/especies" });
  await app.register(parametrosRoutes, { prefix: "/parametros" });
  await app.register(producoesRoutes, { prefix: "/producoes" });
  await app.register(fotosRoutes, { prefix: "/fotos" });
  await app.register(exportacaoRoutes, { prefix: "/exportacao" });
  await app.register(syncRoutes, { prefix: "/sync" });

  return app;
}
