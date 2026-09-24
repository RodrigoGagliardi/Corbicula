import type { FastifyPluginAsync } from "fastify/types/plugin";
import type { FastifyRequest } from "fastify/types/request";
import { authenticate } from "../../shared/middleware/authenticate";
import { erroRequisicao } from "../../shared/errors";
import { fotosService } from "./fotos.service";
import {
  atualizarFotoSchema,
  filtrosFotoSchema,
  vinculoFotoSchema,
  type ArquivoFoto,
} from "./fotos.types";

// Lê o multipart independentemente da ordem das partes: campos de texto viram
// objeto; o (único) arquivo é lido para memória — o limite de tamanho é
// aplicado pelo @fastify/multipart (413 se exceder).
async function lerMultipart(request: FastifyRequest) {
  const campos: Record<string, string> = {};
  let arquivo: ArquivoFoto | undefined;

  for await (const parte of request.parts()) {
    if (parte.type === "file") {
      if (arquivo) throw erroRequisicao("Envie apenas uma foto por requisição.");
      arquivo = { buffer: await parte.toBuffer(), mimetype: parte.mimetype };
    } else if (typeof parte.value === "string" && parte.value !== "") {
      campos[parte.fieldname] = parte.value;
    }
  }

  if (!arquivo) throw erroRequisicao("Nenhum arquivo enviado (campo 'arquivo').");
  return { campos, arquivo };
}

export const fotosRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── Listagem ────────────────────────────────────────────────────────────────
  app.get("/", {
    schema: {
      tags: ["fotos"],
      summary: "Lista fotos do usuário",
      description:
        "Filtra por coloniaId, avaliacaoId, avaliacaoParametroId ou producaoId. " +
        "O campo `url` é servido estaticamente pelo backend (ex.: /uploads/fotos/<uuid>.jpg).",
    },
  }, async (request) => {
    const filtros = filtrosFotoSchema.parse(request.query);
    return fotosService.listar(request.userId, filtros);
  });

  // ── Detalhes ────────────────────────────────────────────────────────────────
  app.get("/:id", {
    schema: { tags: ["fotos"], summary: "Retorna os metadados de uma foto" },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return fotosService.buscarPorId(id, request.userId);
  });

  // ── Upload ──────────────────────────────────────────────────────────────────
  app.post("/", {
    schema: {
      tags: ["fotos"],
      summary: "Envia uma foto (multipart/form-data)",
      description:
        "Campos: `arquivo` (JPEG/PNG/WebP, máx. 5 MB — comprima no cliente), `legenda` opcional " +
        "e pelo menos um vínculo: `coloniaId`, `avaliacaoId`, `avaliacaoParametroId` ou `producaoId`. " +
        "Os vínculos superiores são derivados automaticamente (ex.: avaliacaoId → coloniaId). " +
        "Foto é sempre opcional: nenhuma outra operação depende deste endpoint.",
    },
  }, async (request, reply) => {
    const { campos, arquivo } = await lerMultipart(request);
    const vinculos = vinculoFotoSchema.parse(campos);
    const foto = await fotosService.criar(request.userId, vinculos, arquivo);
    return reply.status(201).send(foto);
  });

  // ── Legenda ─────────────────────────────────────────────────────────────────
  app.patch("/:id", {
    schema: { tags: ["fotos"], summary: "Altera a legenda de uma foto" },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const data = atualizarFotoSchema.parse(request.body);
    return fotosService.atualizar(id, request.userId, data);
  });

  // ── Exclusão ────────────────────────────────────────────────────────────────
  app.delete("/:id", {
    schema: { tags: ["fotos"], summary: "Exclui a foto (registro e arquivo)" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await fotosService.excluir(id, request.userId);
    return reply.status(204).send();
  });
};
