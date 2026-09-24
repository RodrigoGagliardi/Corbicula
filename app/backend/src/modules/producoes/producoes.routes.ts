import type { FastifyPluginAsync } from "fastify/types/plugin";
import { authenticate } from "../../shared/middleware/authenticate";
import { producoesService } from "./producoes.service";
import {
  atualizarProducaoSchema,
  criarProducaoSchema,
  filtrosProducaoSchema,
} from "./producoes.types";

export const producoesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── Listagem ────────────────────────────────────────────────────────────────
  app.get("/", {
    schema: {
      tags: ["producao"],
      summary: "Lista colheitas do usuário",
      description: "Filtros: coloniaId, tipoProduto, desde, ate (datas ISO).",
    },
  }, async (request) => {
    const filtros = filtrosProducaoSchema.parse(request.query);
    return producoesService.listar(request.userId, filtros);
  });

  // ── Resumo / relatório ──────────────────────────────────────────────────────
  // Declarada antes de "/:id" por clareza (o router do Fastify já prioriza rotas estáticas).
  app.get("/resumo", {
    schema: {
      tags: ["producao"],
      summary: "Totais, médias e ranking de produção",
      description:
        "Agrupa por (tipoProduto, unidade) — ml e g nunca são somados. " +
        "Inclui ranking de colônias e totais por espécie. Aceita os mesmos filtros da listagem.",
    },
  }, async (request) => {
    const filtros = filtrosProducaoSchema.parse(request.query);
    return producoesService.resumo(request.userId, filtros);
  });

  // ── Detalhes ────────────────────────────────────────────────────────────────
  app.get("/:id", {
    schema: { tags: ["producao"], summary: "Retorna uma colheita" },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return producoesService.buscarPorId(id, request.userId);
  });

  // ── Criação ─────────────────────────────────────────────────────────────────
  app.post("/", {
    schema: {
      tags: ["producao"],
      summary: "Registra uma colheita",
      description: "Mel normalmente em ml; pólen, própolis e cera em g.",
    },
  }, async (request, reply) => {
    const data = criarProducaoSchema.parse(request.body);
    const producao = await producoesService.criar(request.userId, data);
    return reply.status(201).send(producao);
  });

  // ── Atualização parcial ──────────────────────────────────────────────────────
  app.patch("/:id", {
    schema: { tags: ["producao"], summary: "Atualiza campos de uma colheita" },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = atualizarProducaoSchema.parse(request.body);
    return producoesService.atualizar(id, request.userId, data);
  });

  // ── Exclusão ────────────────────────────────────────────────────────────────
  app.delete("/:id", {
    schema: { tags: ["producao"], summary: "Exclui uma colheita (e suas fotos)" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await producoesService.excluir(id, request.userId);
    return reply.status(204).send();
  });
};
