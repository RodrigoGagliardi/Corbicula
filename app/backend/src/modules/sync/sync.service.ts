import { ZodError } from "zod";
import { prisma } from "../../config/database";
import { erroRequisicao } from "../../shared/errors";
import { parsearJson } from "../../shared/json";
import { avaliacoesService } from "../avaliacoes/avaliacoes.service";
import { atualizarAvaliacaoSchema, criarAvaliacaoSchema } from "../avaliacoes/avaliacoes.types";
import { parsearDimensoes } from "../colonias/colonias.repository";
import { coloniasService } from "../colonias/colonias.service";
import { atualizarColoniaSchema, criarColoniaSchema } from "../colonias/colonias.types";
import { parsearCaracteristicas } from "../producoes/producoes.repository";
import { producoesService } from "../producoes/producoes.service";
import { atualizarProducaoSchema, criarProducaoSchema } from "../producoes/producoes.types";
import type { OperacaoSync, ResultadoSync, StatusSync } from "./sync.types";

// ─── Visão geral ──────────────────────────────────────────────────────────────
// O cliente acumula operações offline e as envia em lote, na ordem em que
// ocorreram. Cada operação é aplicada pelos MESMOS services da API REST —
// todas as validações (propriedade, score, janela de 7 dias etc.) valem igual.
//
// Garantias:
//  - Idempotência: operação já aplicada (mesmo id) volta como "duplicado".
//  - Create repetido: se a entidade já existe, conta como aplicado.
//  - Delete de entidade inexistente: conta como aplicado.
//  - Conflito: update com baseUpdatedAt anterior ao updatedAt do servidor
//    não é aplicado; a versão do servidor volta para o cliente decidir.
//  - Uma operação com erro não interrompe o lote.

interface Entidade {
  updatedAt: Date;
  coloniaId?: string;
}

// Busca a entidade restrita ao usuário (null = não existe ou não é dele).
async function buscarEntidade(op: OperacaoSync, userId: string): Promise<Entidade | null> {
  const select = { updatedAt: true } as const;
  switch (op.tipo) {
    case "colonia":
      return prisma.colonia.findFirst({ where: { id: op.entidadeId, userId }, select });
    case "avaliacao":
      return prisma.avaliacao.findFirst({
        where: { id: op.entidadeId, colonia: { userId } },
        select: { ...select, coloniaId: true },
      });
    case "producao":
      return prisma.producao.findFirst({
        where: { id: op.entidadeId, colonia: { userId } },
        select,
      });
  }
}

function versaoServidor(op: OperacaoSync, userId: string, coloniaId?: string) {
  switch (op.tipo) {
    case "colonia":
      return coloniasService.buscarPorId(op.entidadeId, userId);
    case "avaliacao":
      return avaliacoesService.buscarPorId(op.entidadeId, coloniaId!, userId);
    case "producao":
      return producoesService.buscarPorId(op.entidadeId, userId);
  }
}

function exigirColoniaId(op: OperacaoSync, existente: Entidade | null): string {
  const coloniaId = existente?.coloniaId ?? op.coloniaId;
  if (!coloniaId) throw erroRequisicao("coloniaId é obrigatório para operações de avaliação");
  return coloniaId;
}

async function aplicar(op: OperacaoSync, userId: string): Promise<Omit<ResultadoSync, "id">> {
  const aplicado = { status: "aplicado" as const, entidadeId: op.entidadeId };
  const existente = await buscarEntidade(op, userId);

  if (op.operacao === "create") {
    if (existente) return aplicado;
    const dados = { ...op.dados, id: op.entidadeId };
    if (op.tipo === "colonia") await coloniasService.criar(userId, criarColoniaSchema.parse(dados));
    if (op.tipo === "producao") await producoesService.criar(userId, criarProducaoSchema.parse(dados));
    if (op.tipo === "avaliacao") {
      await avaliacoesService.criar(exigirColoniaId(op, null), userId, criarAvaliacaoSchema.parse(dados));
    }
    return aplicado;
  }

  if (op.operacao === "delete") {
    if (!existente) return aplicado;
    if (op.tipo === "colonia") await coloniasService.excluir(op.entidadeId, userId);
    if (op.tipo === "producao") await producoesService.excluir(op.entidadeId, userId);
    if (op.tipo === "avaliacao") {
      await avaliacoesService.excluir(op.entidadeId, exigirColoniaId(op, existente), userId);
    }
    return aplicado;
  }

  // update
  if (!existente) {
    return { status: "erro", entidadeId: op.entidadeId, erro: "Registro não encontrado no servidor" };
  }
  if (op.baseUpdatedAt && existente.updatedAt > new Date(op.baseUpdatedAt)) {
    return {
      status: "conflito",
      entidadeId: op.entidadeId,
      erro: "O registro foi alterado no servidor depois da versão editada offline.",
      servidor: await versaoServidor(op, userId, existente.coloniaId),
    };
  }
  if (op.tipo === "colonia") {
    await coloniasService.atualizar(op.entidadeId, userId, atualizarColoniaSchema.parse(op.dados));
  }
  if (op.tipo === "producao") {
    await producoesService.atualizar(op.entidadeId, userId, atualizarProducaoSchema.parse(op.dados));
  }
  if (op.tipo === "avaliacao") {
    await avaliacoesService.atualizar(
      op.entidadeId,
      exigirColoniaId(op, existente),
      userId,
      atualizarAvaliacaoSchema.parse(op.dados)
    );
  }
  return aplicado;
}

// Erros de validação/domínio viram mensagem para o cliente; null = erro inesperado.
function mensagemDeErro(err: unknown): string | null {
  if (err instanceof ZodError) {
    return err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  const code = (err as NodeJS.ErrnoException).code;
  if (err instanceof Error && (code === "NOT_FOUND" || code === "CONFLICT" || code === "BAD_REQUEST")) {
    return err.message;
  }
  return null;
}

async function registrar(op: OperacaoSync, userId: string, status: StatusSync, erro?: string) {
  const sincronizado = status === "aplicado";
  await prisma.syncQueue.upsert({
    where: { id: op.id },
    create: {
      id: op.id,
      userId,
      tipo: op.tipo,
      operacao: op.operacao,
      entidadeId: op.entidadeId,
      dados: JSON.stringify(op.dados),
      resultado: status,
      ultimoErro: erro ?? null,
      sincronizado,
      criadoNoCliente: new Date(op.criadoEm),
    },
    update: {
      dados: JSON.stringify(op.dados),
      resultado: status,
      ultimoErro: erro ?? null,
      sincronizado,
      tentativas: { increment: 1 },
    },
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const syncService = {
  async processarLote(userId: string, operacoes: OperacaoSync[], log: (err: unknown) => void) {
    const resultados: ResultadoSync[] = [];

    for (const op of operacoes) {
      const anterior = await prisma.syncQueue.findUnique({
        where: { id: op.id },
        select: { userId: true, sincronizado: true },
      });

      if (anterior && anterior.userId !== userId) {
        resultados.push({ id: op.id, status: "erro", entidadeId: op.entidadeId, erro: "id de operação já utilizado" });
        continue;
      }
      if (anterior?.sincronizado) {
        resultados.push({ id: op.id, status: "duplicado", entidadeId: op.entidadeId });
        continue;
      }

      let resultado: Omit<ResultadoSync, "id">;
      try {
        resultado = await aplicar(op, userId);
      } catch (err) {
        const erro = mensagemDeErro(err);
        if (erro === null) log(err);
        resultado = { status: "erro", entidadeId: op.entidadeId, erro: erro ?? "Erro interno ao aplicar a operação" };
      }

      await registrar(op, userId, resultado.status, resultado.erro);
      resultados.push({ id: op.id, ...resultado });
    }

    const contagem = (s: StatusSync) => resultados.filter((r) => r.status === s).length;
    return {
      servidorEm: new Date().toISOString(),
      processadas: resultados.length,
      aplicadas: contagem("aplicado"),
      duplicadas: contagem("duplicado"),
      conflitos: contagem("conflito"),
      erros: contagem("erro"),
      resultados,
    };
  },

  // Pull incremental: registros alterados desde `desde` + lista completa de ids
  // atuais (o cliente remove localmente o que não estiver mais na lista).
  // `servidorEm` é capturado ANTES das consultas — use-o como próximo `desde`.
  async alteracoes(userId: string, desde?: Date) {
    const servidorEm = new Date();
    const alterado = desde ? { updatedAt: { gt: desde } } : {};
    const daColonia = { colonia: { userId } };

    const [colonias, avaliacoes, producoes, parametros, ids] = await Promise.all([
      prisma.colonia.findMany({ where: { userId, ...alterado } }),
      prisma.avaliacao.findMany({ where: { ...daColonia, ...alterado }, include: { parametros: true } }),
      prisma.producao.findMany({ where: { ...daColonia, ...alterado } }),
      prisma.parametro.findMany({ where: { userId, ...alterado }, include: { criteriosEspecie: true } }),
      Promise.all([
        prisma.colonia.findMany({ where: { userId }, select: { id: true } }),
        prisma.avaliacao.findMany({ where: daColonia, select: { id: true } }),
        prisma.producao.findMany({ where: daColonia, select: { id: true } }),
        prisma.parametro.findMany({ where: { userId }, select: { id: true } }),
      ]),
    ]);

    const soIds = (l: { id: string }[]) => l.map((r) => r.id);

    return {
      servidorEm: servidorEm.toISOString(),
      desde: desde?.toISOString() ?? null,
      colonias: colonias.map(({ dimensoesCaixa, ...c }) => ({ ...c, dimensoesCaixa: parsearDimensoes(dimensoesCaixa) })),
      avaliacoes: avaliacoes.map(({ acoesTomadas, ...a }) => ({ ...a, acoesTomadas: parsearJson<string[]>(acoesTomadas, []) })),
      producoes: producoes.map(({ caracteristicas, ...p }) => ({ ...p, caracteristicas: parsearCaracteristicas(caracteristicas) })),
      parametros,
      idsAtuais: {
        colonias: soIds(ids[0]),
        avaliacoes: soIds(ids[1]),
        producoes: soIds(ids[2]),
        parametros: soIds(ids[3]),
      },
    };
  },

  async status(userId: string) {
    const [ultima, pendentes] = await Promise.all([
      prisma.syncQueue.findFirst({
        where: { userId, sincronizado: true },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.syncQueue.findMany({
        where: { userId, sincronizado: false },
        orderBy: { criadoNoCliente: "asc" },
        select: { id: true, tipo: true, operacao: true, entidadeId: true, resultado: true, ultimoErro: true, tentativas: true },
      }),
    ]);
    return { ultimaSincronizacao: ultima?.updatedAt ?? null, naoAplicadas: pendentes };
  },
};
