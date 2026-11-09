import type { FastifyPluginAsync } from "fastify/types/plugin";
import type { FastifyReply } from "fastify/types/reply";
import { authenticate } from "../../shared/middleware/authenticate";
import { gerarCsv, type LinhaCsv } from "./csv";
import {
  COLUNAS_AVALIACOES,
  COLUNAS_COLONIAS,
  COLUNAS_HISTORICO_STATUS,
  COLUNAS_PRODUCOES,
  exportacaoService,
  metadados,
} from "./exportacao.service";
import {
  exportarAvaliacoesSchema,
  exportarColoniasSchema,
  exportarHistoricoStatusSchema,
  exportarProducoesSchema,
  type Formato,
} from "./exportacao.types";

const hoje = () => new Date().toISOString().slice(0, 10);

// CSV: apenas os dados (o dicionário de dados está em docs/exportacao.md).
// JSON: { metadados, dados } — metadados incluem filtros e metodologia.
function enviar(
  reply: FastifyReply,
  recurso: string,
  formato: Formato,
  colunas: readonly string[],
  linhas: LinhaCsv[],
  filtros: object
) {
  const arquivo = `corbicula_${recurso}_${hoje()}.${formato}`;
  reply.header("Content-Disposition", `attachment; filename="${arquivo}"`);

  if (formato === "csv") {
    return reply.type("text/csv; charset=utf-8").send(gerarCsv(colunas, linhas));
  }
  return reply
    .type("application/json; charset=utf-8")
    .send({ metadados: metadados(recurso, filtros, linhas.length), dados: linhas });
}

export const exportacaoRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get("/colonias", {
    schema: {
      tags: ["exportacao"],
      summary: "Exporta colônias (CSV ou JSON)",
      description: "Query: formato=csv|json (padrão csv), status.",
    },
  }, async (request, reply) => {
    const { formato, ...filtros } = exportarColoniasSchema.parse(request.query);
    const linhas = await exportacaoService.linhasColonias(request.userId, filtros);
    return enviar(reply, "colonias", formato, COLUNAS_COLONIAS, linhas, filtros);
  });

  app.get("/avaliacoes", {
    schema: {
      tags: ["exportacao"],
      summary: "Exporta avaliações em formato longo (uma linha por avaliação × parâmetro)",
      description: "Query: formato=csv|json, coloniaId, status, desde, ate (datas ISO).",
    },
  }, async (request, reply) => {
    const { formato, ...filtros } = exportarAvaliacoesSchema.parse(request.query);
    const linhas = await exportacaoService.linhasAvaliacoes(request.userId, filtros, formato);
    return enviar(reply, "avaliacoes", formato, COLUNAS_AVALIACOES, linhas, filtros);
  });

  app.get("/producoes", {
    schema: {
      tags: ["exportacao"],
      summary: "Exporta colheitas (CSV ou JSON)",
      description: "Query: formato=csv|json, coloniaId, tipoProduto, desde, ate.",
    },
  }, async (request, reply) => {
    const { formato, ...filtros } = exportarProducoesSchema.parse(request.query);
    const linhas = await exportacaoService.linhasProducoes(request.userId, filtros);
    return enviar(reply, "producoes", formato, COLUNAS_PRODUCOES, linhas, filtros);
  });

  app.get("/historico-status", {
    schema: {
      tags: ["exportacao"],
      summary: "Exporta o histórico de mudanças de status das colônias (CSV ou JSON)",
      description:
        "Uma linha por mudança de status (data percebida, motivo e classe evento/censura). " +
        "Query: formato=csv|json, coloniaId, desde, ate (pela data percebida).",
    },
  }, async (request, reply) => {
    const { formato, ...filtros } = exportarHistoricoStatusSchema.parse(request.query);
    const linhas = await exportacaoService.linhasHistoricoStatus(request.userId, filtros);
    return enviar(reply, "historico-status", formato, COLUNAS_HISTORICO_STATUS, linhas, filtros);
  });

  app.get("/protocolos", {
    schema: {
      tags: ["exportacao"],
      summary: "Exporta os protocolos de avaliação (JSON)",
      description:
        "Parâmetros e critérios aplicados em cada protocolo, com hash, template de origem e " +
        "número de avaliações. Só JSON (o conteúdo é uma lista aninhada).",
    },
  }, async (request, reply) => {
    const dados = await exportacaoService.protocolos(request.userId);
    reply.header("Content-Disposition", `attachment; filename="corbicula_protocolos_${hoje()}.json"`);
    return reply
      .type("application/json; charset=utf-8")
      .send({ metadados: metadados("protocolos", {}, dados.length), dados });
  });

  app.get("/backup", {
    schema: {
      tags: ["exportacao"],
      summary: "Backup completo em JSON estruturado",
      description:
        "Todos os dados do usuário (meliponário, parâmetros, colônias, avaliações, produções, " +
        "metadados de fotos, histórico de status e protocolos). Os arquivos de imagem não são incluídos.",
    },
  }, async (request, reply) => {
    const backup = await exportacaoService.backupCompleto(request.userId);
    reply.header("Content-Disposition", `attachment; filename="corbicula_backup_${hoje()}.json"`);
    return reply.type("application/json; charset=utf-8").send(backup);
  });
};
