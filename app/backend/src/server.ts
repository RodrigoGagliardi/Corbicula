import "dotenv/config";
import type { FastifyInstance } from "fastify/types/instance";
import type { FastifyReply } from "fastify/types/reply";
import type { FastifyRequest } from "fastify/types/request";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";
import { swaggerOptions, swaggerUiOptions } from "./config/swagger";
import { authRoutes } from "./modules/auth/auth.routes";
import { coloniasRoutes } from "./modules/colonias/colonias.routes";
import { especiesRoutes } from "./modules/especies/especies.routes";
import { parametrosRoutes } from "./modules/parametros/parametros.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { env } from "./shared/env";

const app: FastifyInstance = require("fastify")({
  logger: {
    transport: { target: "pino-pretty" },
  },
});

async function bootstrap() {
  await app.register(cors);
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

      app.log.error(error);
      return reply.status(500).send({ error: "Erro interno do servidor" });
    }
  );

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes, { prefix: "/users" });
  await app.register(coloniasRoutes, { prefix: "/colonias" });
  await app.register(especiesRoutes, { prefix: "/especies" });
  await app.register(parametrosRoutes, { prefix: "/parametros" });

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
