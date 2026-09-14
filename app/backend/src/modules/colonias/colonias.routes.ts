import type { FastifyPluginAsync } from "fastify/types/plugin";
import { authenticate } from "../../shared/middleware/authenticate";
import { avaliacoesRoutes } from "../avaliacoes/avaliacoes.routes";
import { coloniasService } from "./colonias.service";
import {
  criarColoniaSchema,
  atualizarColoniaSchema,
  filtrosColoniaSchema,
} from "./colonias.types";

export const coloniasRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── Listagem ────────────────────────────────────────────────────────────────
  app.get("/", {
    schema: {
      tags: ["colonias"],
      summary: "Lista todas as colônias do usuário autenticado",
      description:
        "Filtra por status (ativa/inativa/morta) e/ou especieId. " +
        "Retorna contagem de avaliações e produções por colônia.",
    },
  }, async (request) => {
    const filtros = filtrosColoniaSchema.parse(request.query);
    return coloniasService.listar(request.userId, filtros);
  });

  // ── Detalhes ────────────────────────────────────────────────────────────────
  app.get("/:id", {
    schema: {
      tags: ["colonias"],
      summary: "Retorna uma colônia com detalhes completos",
      description:
        "Inclui espécie, colônia mãe e filhas da árvore genealógica.",
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return coloniasService.buscarPorId(id, request.userId);
  });

  // ── Criação ─────────────────────────────────────────────────────────────────
  app.post("/", {
    schema: {
      tags: ["colonias"],
      summary: "Cadastra uma nova colônia",
    },
  }, async (request, reply) => {
    const data = criarColoniaSchema.parse(request.body);
    const colonia = await coloniasService.criar(request.userId, data);
    return reply.status(201).send(colonia);
  });

  // ── Atualização parcial ──────────────────────────────────────────────────────
  app.patch("/:id", {
    schema: {
      tags: ["colonias"],
      summary: "Atualiza campos de uma colônia",
      description:
        "Envie somente os campos que deseja alterar. " +
        "Para zerar um campo anulável, envie null (ex.: { \"coloniaMaeId\": null }).",
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = atualizarColoniaSchema.parse(request.body);
    return coloniasService.atualizar(id, request.userId, data);
  });

  // ── Avaliações (sub-recurso) ─────────────────────────────────────────────────
  // O hook preHandler já aplicado neste escopo protege as rotas filhas também.
  await app.register(avaliacoesRoutes, { prefix: "/:coloniaId/avaliacoes" });

  // ── Exclusão ────────────────────────────────────────────────────────────────
  app.delete("/:id", {
    schema: {
      tags: ["colonias"],
      summary: "Exclui uma colônia sem histórico de avaliações",
      description:
        "Retorna 409 se a colônia possuir avaliações — use PATCH status=morta para encerrar " +
        "preservando o histórico científico.",
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await coloniasService.excluir(id, request.userId);
    return reply.status(204).send();
  });
};
