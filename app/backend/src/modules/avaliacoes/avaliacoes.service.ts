import { prisma } from "../../config/database";
import { enriquecerComClima } from "../../services/weather.service";
import { erroRequisicao } from "../../shared/errors";
import { parsearJson } from "../../shared/json";
import type { FonteClima } from "../../shared/vocabularios";
import { apagarArquivos, listarArquivosDe } from "../fotos/fotos.service";
import { resolverProtocolo } from "./avaliacoes.protocolo";
import { avaliacoesRepository } from "./avaliacoes.repository";
import type { CriarAvaliacaoInput, AtualizarAvaliacaoInput, FiltrosAvaliacoes } from "./avaliacoes.types";

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
// Na edição, parâmetros que já estavam na avaliação continuam aceitos mesmo
// que tenham sido desativados depois (jaAvaliados).
async function validarParametros(
  parametroIds: string[],
  userId: string,
  jaAvaliados: string[] = []
): Promise<void> {
  const encontrados = await prisma.parametro.findMany({
    where: {
      id: { in: parametroIds },
      userId,
      OR: [{ ativo: true }, { id: { in: jaAvaliados } }],
    },
    select: { id: true },
  });

  if (encontrados.length !== parametroIds.length) {
    throw erroConflito(
      "Um ou mais parâmetros não foram encontrados, não pertencem ao usuário ou estão inativos."
    );
  }
}

// Confirma que a colônia existe e pertence ao usuário; devolve a espécie
// (critérios por espécie do protocolo).
async function validarPropriedadeColonia(
  coloniaId: string,
  userId: string
): Promise<{ especieId: string | null }> {
  const colonia = await prisma.colonia.findFirst({
    where: { id: coloniaId, userId },
    select: { especieId: true },
  });
  if (!colonia) throw erroNaoEncontrado("Colônia não encontrada");
  return colonia;
}

// ─── Contexto: motivos das ações e procedência do clima ───────────────────────

// Cada chave de motivosAcoes precisa ser uma das ações tomadas. Mapa vazio é
// gravado como nulo (nada registrado).
function conferirMotivosAcoes(
  motivos: Record<string, string> | null,
  acoes: string[]
): Record<string, string> | null {
  if (!motivos) return null;
  const fora = Object.keys(motivos).filter((acao) => !acoes.includes(acao));
  if (fora.length > 0) {
    throw erroRequisicao(
      `motivosAcoes: as ações ${fora.map((a) => `"${a}"`).join(", ")} não estão em acoesTomadas.`
    );
  }
  return Object.keys(motivos).length > 0 ? motivos : null;
}

const CAMPOS_CLIMA = ["temperatura", "umidade", "condicaoClimatica"] as const;
type Clima = {
  temperatura?: number | null | undefined;
  umidade?: number | null | undefined;
  condicaoClimatica?: string | null | undefined;
};

// Na criação: algum campo de clima informado = digitado. Sem clima, fica nulo
// até o weather.service preencher (api_previsao / api_historico).
function fonteClimaNaCriacao(data: Clima): FonteClima | null {
  return CAMPOS_CLIMA.some((c) => data[c] !== undefined && data[c] !== null) ? "digitado" : null;
}

// Na edição: só muda quando o usuário altera algum campo de clima (reenviar o
// mesmo valor não conta). Alterou e sobrou clima = digitado (um valor da API
// editado vira digitado); alterou e apagou tudo = sem clima (nulo).
function fonteClimaNaEdicao(data: Clima, atual: { [K in keyof Clima]-?: Exclude<Clima[K], undefined> }): FonteClima | null | undefined {
  const alterou = CAMPOS_CLIMA.some((c) => data[c] !== undefined && data[c] !== atual[c]);
  if (!alterou) return undefined;
  const final = CAMPOS_CLIMA.map((c) => (data[c] !== undefined ? data[c] : atual[c]));
  return final.every((v) => v === null) ? null : "digitado";
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

  // Histórico de todas as colônias do usuário, com filtros.
  async listarDoUsuario(userId: string, filtros: FiltrosAvaliacoes) {
    const avaliacoes = await avaliacoesRepository.listarDoUsuario(userId, filtros);
    return avaliacoes.map(mapearSaida);
  },

  async buscarPorId(id: string, coloniaId: string, userId: string) {
    await validarPropriedadeColonia(coloniaId, userId);
    const avaliacao = await avaliacoesRepository.buscarPorId(id, coloniaId);
    if (!avaliacao) throw erroNaoEncontrado();
    return mapearSaida(avaliacao);
  },

  async criar(coloniaId: string, userId: string, data: CriarAvaliacaoInput) {
    const { especieId } = await validarPropriedadeColonia(coloniaId, userId);
    const parametroIds = data.parametros.map((p) => p.parametroId);
    await validarParametros(parametroIds, userId);
    const motivosAcoes = conferirMotivosAcoes(data.motivosAcoes ?? null, data.acoesTomadas ?? []);

    if (data.id && (await avaliacoesRepository.existeId(data.id))) {
      throw erroConflito("Já existe um registro com este id.");
    }

    const { scoreGeral, statusGeral } = calcularScore(data.parametros);
    const protocoloId = await resolverProtocolo(userId, especieId, parametroIds);
    const avaliacao = await avaliacoesRepository.criar(coloniaId, scoreGeral, statusGeral, data, {
      protocoloId,
      motivosAcoes,
      climaFonte: fonteClimaNaCriacao(data),
    });

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
    const { especieId } = await validarPropriedadeColonia(coloniaId, userId);

    const existente = await avaliacoesRepository.buscarPorId(id, coloniaId);
    if (!existente) throw erroNaoEncontrado();

    if (!dentroDoLimiteEdicao(existente.createdAt)) {
      throw erroConflito(
        `Avaliações só podem ser editadas nos primeiros ${LIMITE_EDICAO_DIAS} dias após o registro.`
      );
    }

    // Motivos das ações: conferidos contra as ações finais. Se só as ações
    // mudaram, os motivos de ações que saíram são descartados.
    const acoesFinais =
      data.acoesTomadas !== undefined
        ? (data.acoesTomadas ?? [])
        : parsearJson<string[]>(existente.acoesTomadas, []);
    let motivosAcoes: Record<string, string> | null | undefined;
    if (data.motivosAcoes !== undefined) {
      motivosAcoes = conferirMotivosAcoes(data.motivosAcoes, acoesFinais);
    } else if (data.acoesTomadas !== undefined && existente.motivosAcoes) {
      const atuais = existente.motivosAcoes as Record<string, string>;
      const mantidos = Object.fromEntries(Object.entries(atuais).filter(([acao]) => acoesFinais.includes(acao)));
      if (Object.keys(mantidos).length !== Object.keys(atuais).length) {
        motivosAcoes = Object.keys(mantidos).length > 0 ? mantidos : null;
      }
    }

    // Recalcula score apenas se os parâmetros forem substituídos.
    let scoreGeral = existente.scoreGeral;
    let statusGeral = existente.statusGeral;
    let protocoloId: string | undefined;

    if (data.parametros) {
      const novos = data.parametros.map((p) => p.parametroId);
      const atuais = existente.parametros.map((p) => p.parametroId);
      await validarParametros(novos, userId, atuais);
      ({ scoreGeral, statusGeral } = calcularScore(data.parametros));
      // O protocolo só é resolvido de novo quando o CONJUNTO avaliado muda
      // (mudar só as classificações mantém o protocolo, inclusive o nulo de
      // avaliações antigas).
      const mesmoConjunto = novos.length === atuais.length && novos.every((p) => atuais.includes(p));
      if (!mesmoConjunto) protocoloId = await resolverProtocolo(userId, especieId, novos);
    }

    const avaliacao = await avaliacoesRepository.atualizar(id, scoreGeral, statusGeral, data, {
      protocoloId,
      motivosAcoes,
      climaFonte: fonteClimaNaEdicao(data, existente),
    });
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
