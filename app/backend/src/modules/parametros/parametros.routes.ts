import type { FastifyPluginAsync } from "fastify/types/plugin";
import { authenticate } from "../../shared/middleware/authenticate";
import { aplicarConjunto, aplicarTemplate, exportarParametros } from "./parametros.conjuntos";
import { parametrosService } from "./parametros.service";
import { TEMPLATES } from "./parametros.templates";
import {
  criarParametroSchema,
  atualizarParametroSchema,
  aplicarTemplateSchema,
  criterioEspecieSchema,
  filtrosParametroSchema,
  importarParametrosSchema,
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

  // ── Templates, exportação e importação ──────────────────────────────────────

  app.get("/templates", {
    schema: {
      tags: ["parametros"],
      summary: "Lista os templates de parâmetros (Iniciante, Intermediário, Avançado, Científico)",
      description: "Conjuntos cumulativos e versionados (5, 8, 12 e 15 parâmetros). Critérios de referência gerais.",
    },
  }, async () => TEMPLATES);

  app.post("/templates/:id/aplicar", {
    schema: {
      tags: ["parametros"],
      summary: "Aplica um template aos parâmetros do usuário",
      description:
        'Body: { "modo": "mesclar" | "substituir" }. Transação única. Parâmetros que já existem (mesmo nome) ' +
        "são mantidos com os critérios do usuário e reativados se estavam desativados. " +
        '"substituir" desativa (não exclui) os parâmetros fora do template. Retorna o resumo do que mudou.',
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { modo } = aplicarTemplateSchema.parse(request.body);
    return aplicarTemplate(request.userId, id, modo);
  });

  app.get("/exportar", {
    schema: {
      tags: ["parametros"],
      summary: "Exporta os parâmetros do usuário (JSON versionado, reimportável)",
    },
  }, async (request, reply) => {
    const arquivo = await exportarParametros(request.userId);
    const data = arquivo.exportadoEm.slice(0, 10);
    return reply
      .header("Content-Disposition", `attachment; filename="corbicula-parametros-${data}.json"`)
      .send(arquivo);
  });

  app.post("/importar", {
    schema: {
      tags: ["parametros"],
      summary: "Importa parâmetros de um arquivo gerado por GET /parametros/exportar",
      description:
        'Body: { "modo": "mesclar" | "substituir", "dados": <arquivo> }. Mesmas regras de aplicar template. ' +
        "Critérios por espécie são criados só para parâmetros novos; códigos de espécie desconhecidos são ignorados e listados.",
    },
  }, async (request) => {
    const { modo, dados } = importarParametrosSchema.parse(request.body);
    return aplicarConjunto(request.userId, dados.parametros, modo);
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
