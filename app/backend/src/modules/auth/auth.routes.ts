import type { FastifyPluginAsync } from "fastify/types/plugin";
import { authService } from "./auth.service";
import { loginBodySchema, registerBodySchema } from "./auth.types";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", {
    schema: {
      tags: ["auth"],
      summary: "Registrar novo usuário",
      description:
        "Cria conta. Se o campo meliponario for omitido, configure depois em PUT /users/me/meliponario.",
    },
  }, async (request, reply) => {
    const data = registerBodySchema.parse(request.body);
    const result = await authService.register(data);
    return reply.status(201).send(result);
  });

  app.post("/login", {
    schema: {
      tags: ["auth"],
      summary: "Autenticar usuário",
      description: "Retorna JWT válido por 7 dias.",
    },
  }, async (request, reply) => {
    const data = loginBodySchema.parse(request.body);
    const result = await authService.login(data);
    return reply.send(result);
  });
};
