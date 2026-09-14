import type { FastifyPluginAsync } from "fastify/types/plugin";
import { authenticate } from "../../shared/middleware/authenticate";
import { meliponarioSchema, updateProfileSchema } from "./users.types";
import { usersService } from "./users.service";

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/me", {
    schema: {
      tags: ["users"],
      summary: "Retorna perfil do usuário autenticado e seu meliponário",
    },
  }, async (request) => {
    return usersService.getProfile(request.userId);
  });

  app.patch("/me", {
    schema: {
      tags: ["users"],
      summary: "Atualiza nome ou e-mail do usuário",
    },
  }, async (request) => {
    const data = updateProfileSchema.parse(request.body);
    return usersService.updateProfile(request.userId, data);
  });

  // PUT porque a relação é 1:1 — cria se não existe, atualiza se já existe.
  app.put("/me/meliponario", {
    schema: {
      tags: ["users"],
      summary: "Cria ou atualiza o meliponário do usuário",
      description:
        "Relação 1:1 — cada usuário tem exatamente um meliponário. " +
        "Use PUT para criar na primeira vez ou atualizar depois.",
    },
  }, async (request) => {
    const data = meliponarioSchema.parse(request.body);
    return usersService.upsertMeliponario(request.userId, data);
  });
};
