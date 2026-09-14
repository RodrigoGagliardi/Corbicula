import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
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

function mapearSaida<T extends { dimensoesCaixa: string | null }>(
  colonia: T
): Omit<T, "dimensoesCaixa"> & { dimensoesCaixa: ReturnType<typeof parsearDimensoes> } {
  const { dimensoesCaixa, ...resto } = colonia;
  return { ...resto, dimensoesCaixa: parsearDimensoes(dimensoesCaixa) };
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
    if (data.coloniaMaeId) {
      const mae = await coloniasRepository.buscarPorId(data.coloniaMaeId, userId);
      if (!mae) throw erroNaoEncontrado("Colônia mãe não encontrada ou não pertence ao usuário");
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

    if (data.coloniaMaeId) {
      if (data.coloniaMaeId === id) {
        throw erroConflito("Uma colônia não pode ser mãe de si mesma");
      }
      const mae = await coloniasRepository.buscarPorId(data.coloniaMaeId, userId);
      if (!mae) throw erroNaoEncontrado("Colônia mãe não encontrada ou não pertence ao usuário");
    }

    const colonia = await coloniasRepository.atualizar(id, userId, data);
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

    await coloniasRepository.excluir(id, userId);
  },
};
