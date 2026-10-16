import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { apagarArquivos, listarArquivosDe } from "../fotos/fotos.service";
import { coloniasRepository, parsearDimensoes } from "./colonias.repository";
import type { CriarColoniaInput, AtualizarColoniaInput, FiltrosColonia } from "./colonias.types";

// ─── Erros tipados ────────────────────────────────────────────────────────────

function erroNaoEncontrado(msg = "Colônia não encontrada"): Error {
  const err = new Error(msg);
  (err as NodeJS.ErrnoException).code = "NOT_FOUND";
  return err;
}

function erroConflito(msg: string): Error {
  const err = new Error(msg);
  (err as NodeJS.ErrnoException).code = "CONFLICT";
  return err;
}

// ─── Geração de código ────────────────────────────────────────────────────────
// Formato: [CODIGO_KEW]-[NNN]   ex.: TETRANGU-001, MELIQUAD-003
// Sem espécie identificada:     COL-001
//
// O número é calculado buscando o maior sufixo existente para o prefixo,
// garantindo que gaps por exclusões não causem colisão.

async function gerarCodigoColonia(userId: string, especieId?: string | null): Promise<string> {
  let prefixo = "COL";

  if (especieId) {
    const especie = await prisma.especie.findUnique({
      where: { id: especieId },
      select: { codigo: true },
    });
    if (!especie) throw erroNaoEncontrado("Espécie não encontrada");
    prefixo = especie.codigo;
  }

  const existentes = await prisma.colonia.findMany({
    where: { userId, codigo: { startsWith: `${prefixo}-` } },
    select: { codigo: true },
  });

  // Extrai o número do sufixo de cada código (ex.: "TETRANGU-007" → 7)
  const numeros = existentes
    .map((c) => {
      const partes = c.codigo.split("-");
      return parseInt(partes[partes.length - 1] ?? "0", 10);
    })
    .filter((n) => Number.isFinite(n) && n > 0);

  const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  return `${prefixo}-${String(proximo).padStart(3, "0")}`;
}

// ─── Mapper de saída ──────────────────────────────────────────────────────────

// `avaliacoes` vem do banco como lista com no máximo 1 item (a mais recente);
// sai como `ultimaAvaliacao` (objeto ou null).
function mapearSaida<T extends { dimensoesCaixa: string | null; avaliacoes: unknown[] }>(colonia: T) {
  const { dimensoesCaixa, avaliacoes, ...resto } = colonia;
  return {
    ...resto,
    dimensoesCaixa: parsearDimensoes(dimensoesCaixa),
    ultimaAvaliacao: (avaliacoes[0] ?? null) as T["avaliacoes"][number] | null,
  };
}

// ─── Regras de genealogia ─────────────────────────────────────────────────────
// - Espécie: definida uma vez, nunca alterada (colônia de jataí é sempre de
//   jataí). Colônia criada sem espécie (COL-NNN) pode ser identificada depois,
//   uma única vez, e passa a ter o código da espécie.
// - Divisão é reprodução da própria colônia: mãe, filha e a doadora de
//   campeiras (opcional) são da mesma espécie quando as duas pontas têm espécie
//   identificada; colônia sem espécie não restringe nada.
// - Ordem no tempo: mãe e doadora já estavam no meliponário quando a filha
//   entrou (dataEntrada da filha ≥ dataEntrada delas; mesmo dia vale).
// - Mãe e doadora só em colônias de origem divisão.
// - A árvore não tem ciclos (A mãe de B e B mãe de A).

type Relacionada = { id: string; codigo: string; especieId: string | null; dataEntrada: Date };

const dia = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

async function buscarRelacionada(id: string, userId: string, papel: string): Promise<Relacionada> {
  const colonia = await prisma.colonia.findFirst({
    where: { id, userId },
    select: { id: true, codigo: true, especieId: true, dataEntrada: true },
  });
  if (!colonia) throw erroNaoEncontrado(`Colônia ${papel} não encontrada ou não pertence ao usuário`);
  return colonia;
}

// Confere a colônia (mãe ou doadora) de que a filha veio.
function conferirOrigem(
  rel: Relacionada,
  papel: string,
  filha: { especieId: string | null; dataEntrada: Date | string }
) {
  if (rel.especieId && filha.especieId && rel.especieId !== filha.especieId) {
    throw erroConflito(`A espécie deve ser a mesma da colônia ${papel} (${rel.codigo}): uma divisão não muda de espécie.`);
  }
  if (dia(filha.dataEntrada) < dia(rel.dataEntrada)) {
    throw erroConflito(
      `A data de entrada não pode ser anterior à da colônia ${papel} (${rel.codigo}, ${dia(rel.dataEntrada)}).`
    );
  }
}

// Sobe a linhagem a partir da nova mãe; se encontrar a própria colônia, haveria ciclo.
async function conferirCiclo(id: string, maeId: string) {
  const visitados = new Set<string>();
  let atual: string | null = maeId;
  while (atual && !visitados.has(atual)) {
    if (atual === id) throw erroConflito("Genealogia inválida: a colônia mãe é descendente desta colônia");
    visitados.add(atual);
    const registro: { coloniaMaeId: string | null } | null = await prisma.colonia.findUnique({
      where: { id: atual },
      select: { coloniaMaeId: true },
    });
    atual = registro?.coloniaMaeId ?? null;
  }
}

// Confere as colônias formadas a partir desta (filhas e receptoras de campeiras).
async function conferirDerivadas(id: string, origem: { especieId: string | null; dataEntrada: Date | string }) {
  const derivadas = await prisma.colonia.findMany({
    where: { OR: [{ coloniaMaeId: id }, { coloniaDoadoraCampeirasId: id }] },
    select: { codigo: true, especieId: true, dataEntrada: true },
    orderBy: { codigo: "asc" },
  });
  const codigos = (lista: { codigo: string }[]) => lista.map((d) => d.codigo).join(", ");

  const outraEspecie = derivadas.filter((d) => origem.especieId && d.especieId && d.especieId !== origem.especieId);
  if (outraEspecie.length > 0) {
    throw erroConflito(
      `A espécie deve ser a mesma das colônias formadas a partir desta (${codigos(outraEspecie)}): uma divisão não muda de espécie.`
    );
  }
  const anteriores = derivadas.filter((d) => dia(d.dataEntrada) < dia(origem.dataEntrada));
  if (anteriores.length > 0) {
    throw erroConflito(
      `A data de entrada não pode ser posterior à das colônias formadas a partir desta (${codigos(anteriores)}).`
    );
  }
}

// Mãe e doadora de campeiras só existem em divisão (colônia comprada, capturada
// ou resgatada não tem mãe no meliponário); a doadora é outra colônia que não a mãe.
function conferirVinculos(id: string | null, final: { origem: string; maeId: string | null; doadoraId: string | null }) {
  if (final.origem !== "divisao") {
    if (final.maeId) throw erroConflito("Colônia mãe só se aplica a colônias de origem divisão");
    if (final.doadoraId) throw erroConflito("Colônia doadora de campeiras só se aplica a colônias de origem divisão");
  }
  if (!final.doadoraId) return;
  if (final.doadoraId === id) throw erroConflito("Uma colônia não pode doar campeiras para si mesma");
  if (final.doadoraId === final.maeId) {
    throw erroConflito("A doadora de campeiras deve ser outra colônia, diferente da mãe");
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const coloniasService = {
  async listar(userId: string, filtros: FiltrosColonia) {
    const colonias = await coloniasRepository.listar(userId, filtros);
    return colonias.map(mapearSaida);
  },

  async buscarPorId(id: string, userId: string) {
    const colonia = await coloniasRepository.buscarPorId(id, userId);
    if (!colonia) throw erroNaoEncontrado();
    return mapearSaida(colonia);
  },

  async criar(userId: string, data: CriarColoniaInput) {
    conferirVinculos(data.id ?? null, {
      origem: data.origem,
      maeId: data.coloniaMaeId ?? null,
      doadoraId: data.coloniaDoadoraCampeirasId ?? null,
    });
    if (data.coloniaMaeId) {
      const mae = await buscarRelacionada(data.coloniaMaeId, userId, "mãe");
      // Filha sem espécie informada herda a da mãe (e o código segue o dela).
      if (!data.especieId && mae.especieId) data = { ...data, especieId: mae.especieId };
      conferirOrigem(mae, "mãe", { especieId: data.especieId ?? null, dataEntrada: data.dataEntrada });
    }
    if (data.coloniaDoadoraCampeirasId) {
      const doadora = await buscarRelacionada(data.coloniaDoadoraCampeirasId, userId, "doadora de campeiras");
      conferirOrigem(doadora, "doadora de campeiras", {
        especieId: data.especieId ?? null,
        dataEntrada: data.dataEntrada,
      });
    }

    if (data.id && (await coloniasRepository.existeId(data.id))) {
      throw erroConflito("Já existe um registro com este id.");
    }

    const codigo = await gerarCodigoColonia(userId, data.especieId);

    try {
      const colonia = await coloniasRepository.criar(userId, codigo, data);
      return mapearSaida(colonia);
    } catch (err) {
      // P2002 aqui indicaria race condition (dois POSTs simultâneos com mesmo prefixo)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw erroConflito("Conflito ao gerar código da colônia. Tente novamente.");
      }
      throw err;
    }
  },

  async atualizar(id: string, userId: string, data: AtualizarColoniaInput) {
    const existente = await coloniasRepository.buscarPorId(id, userId);
    if (!existente) throw erroNaoEncontrado();

    if (data.coloniaMaeId === id) {
      throw erroConflito("Uma colônia não pode ser mãe de si mesma");
    }

    const trocaEspecie = data.especieId !== undefined && data.especieId !== existente.especieId;
    if (trocaEspecie && existente.especieId) {
      throw erroConflito(
        "A espécie de uma colônia não pode ser alterada depois de definida. " +
          "Se a identificação estava errada, registre uma nova colônia e marque esta como inativa."
      );
    }

    // Estado final após o PATCH (campo ausente = mantém o valor atual).
    const final = {
      especieId: data.especieId !== undefined ? data.especieId : existente.especieId,
      dataEntrada: data.dataEntrada ?? existente.dataEntrada,
      origem: data.origem ?? existente.origem,
      maeId: data.coloniaMaeId !== undefined ? data.coloniaMaeId : existente.coloniaMaeId,
      doadoraId:
        data.coloniaDoadoraCampeirasId !== undefined
          ? data.coloniaDoadoraCampeirasId
          : existente.coloniaDoadoraCampeirasId,
    };

    // Só valida o que o PATCH mexe: um registro antigo já inconsistente ainda
    // pode ter outros campos editados (ex.: status) e ser corrigido depois.
    const mexeNaOrigem =
      trocaEspecie ||
      data.dataEntrada !== undefined ||
      data.origem !== undefined ||
      data.coloniaMaeId !== undefined ||
      data.coloniaDoadoraCampeirasId !== undefined;
    if (mexeNaOrigem) {
      conferirVinculos(id, final);
      if (final.maeId) {
        conferirOrigem(await buscarRelacionada(final.maeId, userId, "mãe"), "mãe", final);
        if (data.coloniaMaeId) await conferirCiclo(id, final.maeId);
      }
      if (final.doadoraId) {
        const doadora = await buscarRelacionada(final.doadoraId, userId, "doadora de campeiras");
        conferirOrigem(doadora, "doadora de campeiras", final);
      }
    }
    if (trocaEspecie || data.dataEntrada !== undefined) await conferirDerivadas(id, final);

    // Identificar uma colônia COL-NNN dá a ela o código da espécie (ex.: TETRANGU-004).
    const codigo = trocaEspecie ? await gerarCodigoColonia(userId, final.especieId) : undefined;

    const colonia = await coloniasRepository.atualizar(id, userId, { ...data, ...(codigo && { codigo }) });
    return mapearSaida(colonia);
  },

  async excluir(id: string, userId: string) {
    const existente = await coloniasRepository.buscarPorId(id, userId);
    if (!existente) throw erroNaoEncontrado();

    // Preservação de dados: colônias com avaliações não podem ser excluídas —
    // use status "morta" para registrar o encerramento sem perder o histórico.
    const qtdAvaliacoes = await coloniasRepository.contarAvaliacoes(id);
    if (qtdAvaliacoes > 0) {
      throw erroConflito(
        `Não é possível excluir: colônia possui ${qtdAvaliacoes} avaliação(ões). ` +
          `Use status "morta" para registrar o encerramento preservando o histórico.`
      );
    }

    // O cascade apaga as linhas de fotos/produções; os arquivos em disco saem aqui.
    const arquivos = await listarArquivosDe({ coloniaId: id });
    await coloniasRepository.excluir(id, userId);
    await apagarArquivos(arquivos);
  },
};
