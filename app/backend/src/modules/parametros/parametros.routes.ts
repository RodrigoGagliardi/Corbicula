import type { FastifyPluginAsync } from "fastify/types/plugin";
import { authenticate } from "../../shared/middleware/authenticate";
import { parametrosService } from "./parametros.service";
import {
  criarParametroSchema,
  atualizarParametroSchema,
  criterioEspecieSchema,
  filtrosParametroSchema,
} from "./parametros.types";

export const parametrosRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── Parâmetros ──────────────────────────────────────────────────────────────

  app.get("/", {
    schema: {
      tags: ["parametros"],
      summary: "Lista parâmetros do usuário",
      description:
        "Use ?ativo=true para buscar somente os ativos (padrão para o formulário de avaliação) " +
        "ou ?ativo=false para ver os desativados. Sem filtro retorna todos. " +
        "Cada parâmetro já inclui seus critérios por espécie.",
    },
  }, async (request) => {
    const filtros = filtrosParametroSchema.parse(request.query);
    return parametrosService.listar(request.userId, filtros);
  });

  app.get("/:id", {
    schema: {
      tags: ["parametros"],
      summary: "Retorna um parâmetro com todos os critérios por espécie",
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return parametrosService.buscarPorId(id, request.userId);
  });

  app.post("/", {
    schema: {
      tags: ["parametros"],
      summary: "Cria um novo parâmetro de avaliação",
    },
  }, async (request, reply) => {
    const data = criarParametroSchema.parse(request.body);
    const parametro = await parametrosService.criar(request.userId, data);
    return reply.status(201).send(parametro);
  });

  app.patch("/:id", {
    schema: {
      tags: ["parametros"],
      summary: "Atualiza campos de um parâmetro",
      description:
        "Envie somente os campos que deseja alterar. " +
        "Use { \"ativo\": false } para desativar sem excluir — " +
        "parâmetros desativados não aparecem em novas avaliações mas preservam o histórico.",
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = atualizarParametroSchema.parse(request.body);
    return parametrosService.atualizar(id, request.userId, data);
  });

  app.delete("/:id", {
    schema: {
      tags: ["parametros"],
      summary: "Exclui um parâmetro sem histórico de avaliações",
      description: "Retorna 409 se o parâmetro já foi usado em avaliações. Use PATCH ativo=false para desativar.",
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await parametrosService.excluir(id, request.userId);
    return reply.status(204).send();
  });

  // ── Critérios por espécie ───────────────────────────────────────────────────

  app.put("/:id/especies/:especieId", {
    schema: {
      tags: ["parametros"],
      summary: "Define critérios específicos de uma espécie para o parâmetro",
      description:
        "Cria ou substitui os critérios Bom/Médio/Ruim para uma espécie específica. " +
        "Esses critérios sobrescrevem os genéricos do parâmetro ao avaliar colônias " +
        "da espécie informada. Use :especieId com o UUID da espécie.",
    },
  }, async (request) => {
    const { id, especieId } = request.params as { id: string; especieId: string };
    const data = criterioEspecieSchema.parse(request.body);
    return parametrosService.upsertCriterioEspecie(id, request.userId, especieId, data);
  });

  app.delete("/:id/especies/:especieId", {
    schema: {
      tags: ["parametros"],
      summary: "Remove o critério específico de uma espécie",
      description: "Após remover, o parâmetro volta a usar os critérios genéricos para essa espécie.",
    },
  }, async (request, reply) => {
    const { id, especieId } = request.params as { id: string; especieId: string };
    await parametrosService.excluirCriterioEspecie(id, request.userId, especieId);
    return reply.status(204).send();
  });
};
