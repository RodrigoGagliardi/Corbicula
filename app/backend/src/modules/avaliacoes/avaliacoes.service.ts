import { prisma } from "../../config/database";
import { enriquecerComClima } from "../../services/weather.service";
import { apagarArquivos, listarArquivosDe } from "../fotos/fotos.service";
import { avaliacoesRepository } from "./avaliacoes.repository";
import type { CriarAvaliacaoInput, AtualizarAvaliacaoInput } from "./avaliacoes.types";

// ─── Constantes ───────────────────────────────────────────────────────────────

const LIMITE_EDICAO_DIAS = 7;

// ─── Erros tipados ────────────────────────────────────────────────────────────

function erroNaoEncontrado(msg = "Avaliação não encontrada"): Error {
  const err = new Error(msg);
  (err as NodeJS.ErrnoException).code = "NOT_FOUND";
  return err;
}

function erroConflito(msg: string): Error {
  const err = new Error(msg);
  (err as NodeJS.ErrnoException).code = "CONFLICT";
  return err;
}

// ─── Cálculo de score ─────────────────────────────────────────────────────────
// Fórmula: (qtd_BOM × 100 + qtd_MEDIO × 50 + qtd_RUIM × 0) / total_parametros
// 80–100 = excelente | 60–79 = boa | 40–59 = atencao | 0–39 = critica

export function calcularScore(parametros: { classificacao: string }[]): {
  scoreGeral: number;
  statusGeral: string;
} {
  const total = parametros.length;
  const qtdBom = parametros.filter((p) => p.classificacao === "bom").length;
  const qtdMedio = parametros.filter((p) => p.classificacao === "medio").length;
  const scoreGeral = Math.round((qtdBom * 100 + qtdMedio * 50) / total);

  let statusGeral: string;
  if (scoreGeral >= 80) statusGeral = "excelente";
  else if (scoreGeral >= 60) statusGeral = "boa";
  else if (scoreGeral >= 40) statusGeral = "atencao";
  else statusGeral = "critica";

  return { scoreGeral, statusGeral };
}

// ─── Validações ───────────────────────────────────────────────────────────────

function dentroDoLimiteEdicao(createdAt: Date): boolean {
  const diffMs = Date.now() - createdAt.getTime();
  return diffMs <= LIMITE_EDICAO_DIAS * 24 * 60 * 60 * 1000;
}

// Garante que todos os parametroIds pertencem ao usuário e estão ativos.
async function validarParametros(parametroIds: string[], userId: string): Promise<void> {
  const encontrados = await prisma.parametro.findMany({
    where: { id: { in: parametroIds }, userId, ativo: true },
    select: { id: true },
  });

  if (encontrados.length !== parametroIds.length) {
    throw erroConflito(
      "Um ou mais parâmetros não foram encontrados, não pertencem ao usuário ou estão inativos."
    );
  }
}

// Confirma que a colônia existe e pertence ao usuário.
async function validarPropriedadeColonia(coloniaId: string, userId: string): Promise<void> {
  const colonia = await prisma.colonia.findFirst({
    where: { id: coloniaId, userId },
    select: { id: true },
  });
  if (!colonia) throw erroNaoEncontrado("Colônia não encontrada");
}

// ─── Mapper de saída ──────────────────────────────────────────────────────────

function mapearSaida<T extends { acoesTomadas: string | null }>(
  avaliacao: T
): Omit<T, "acoesTomadas"> & { acoesTomadas: string[] } {
  const { acoesTomadas, ...resto } = avaliacao;
  let acoes: string[] = [];
  if (acoesTomadas) {
    try {
      acoes = JSON.parse(acoesTomadas) as string[];
    } catch {
      acoes = [];
    }
  }
  return { ...resto, acoesTomadas: acoes };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const avaliacoesService = {
  async listar(coloniaId: string, userId: string) {
    await validarPropriedadeColonia(coloniaId, userId);
    const avaliacoes = await avaliacoesRepository.listar(coloniaId);
    return avaliacoes.map(mapearSaida);
  },

  async buscarPorId(id: string, coloniaId: string, userId: string) {
    await validarPropriedadeColonia(coloniaId, userId);
    const avaliacao = await avaliacoesRepository.buscarPorId(id, coloniaId);
    if (!avaliacao) throw erroNaoEncontrado();
    return mapearSaida(avaliacao);
  },

  async criar(coloniaId: string, userId: string, data: CriarAvaliacaoInput) {
    await validarPropriedadeColonia(coloniaId, userId);
    await validarParametros(
      data.parametros.map((p) => p.parametroId),
      userId
    );

    if (data.id && (await avaliacoesRepository.existeId(data.id))) {
      throw erroConflito("Já existe um registro com este id.");
    }

    const { scoreGeral, statusGeral } = calcularScore(data.parametros);
    const avaliacao = await avaliacoesRepository.criar(coloniaId, scoreGeral, statusGeral, data);

    // Enriquecimento assíncrono — não bloqueia a resposta; falha silenciosamente.
    // Executado apenas quando o usuário não forneceu dados climáticos manuais.
    if (
      avaliacao.temperatura === null &&
      avaliacao.umidade === null &&
      avaliacao.condicaoClimatica === null
    ) {
      void enriquecerComClima(avaliacao.id, coloniaId, new Date(data.dataAvaliacao));
    }

    return mapearSaida(avaliacao);
  },

  async atualizar(id: string, coloniaId: string, userId: string, data: AtualizarAvaliacaoInput) {
    await validarPropriedadeColonia(coloniaId, userId);

    const existente = await avaliacoesRepository.buscarPorId(id, coloniaId);
    if (!existente) throw erroNaoEncontrado();

    if (!dentroDoLimiteEdicao(existente.createdAt)) {
      throw erroConflito(
        `Avaliações só podem ser editadas nos primeiros ${LIMITE_EDICAO_DIAS} dias após o registro.`
      );
    }

    // Recalcula score apenas se os parâmetros forem substituídos.
    let scoreGeral = existente.scoreGeral;
    let statusGeral = existente.statusGeral;

    if (data.parametros) {
      await validarParametros(
        data.parametros.map((p) => p.parametroId),
        userId
      );
      ({ scoreGeral, statusGeral } = calcularScore(data.parametros));
    }

    const avaliacao = await avaliacoesRepository.atualizar(id, scoreGeral, statusGeral, data);
    return mapearSaida(avaliacao);
  },

  async excluir(id: string, coloniaId: string, userId: string) {
    await validarPropriedadeColonia(coloniaId, userId);
    const existente = await avaliacoesRepository.buscarPorId(id, coloniaId);
    if (!existente) throw erroNaoEncontrado();
    const arquivos = await listarArquivosDe({ avaliacaoId: id });
    await avaliacoesRepository.excluir(id, coloniaId);
    await apagarArquivos(arquivos);
  },
};
