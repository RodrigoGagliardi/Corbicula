import { Prisma } from "@prisma/client";
import { parametrosRepository } from "./parametros.repository";
import type {
  CriarParametroInput,
  AtualizarParametroInput,
  CriterioEspecieInput,
  FiltrosParametro,
} from "./parametros.types";

// ─── Erros tipados ────────────────────────────────────────────────────────────

function erroNaoEncontrado(msg = "Parâmetro não encontrado"): Error {
  const err = new Error(msg);
  (err as NodeJS.ErrnoException).code = "NOT_FOUND";
  return err;
}

function erroConflito(msg: string): Error {
  const err = new Error(msg);
  (err as NodeJS.ErrnoException).code = "CONFLICT";
  return err;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const parametrosService = {
  listar(userId: string, filtros: FiltrosParametro) {
    return parametrosRepository.listar(userId, filtros.ativo);
  },

  async buscarPorId(id: string, userId: string) {
    const parametro = await parametrosRepository.buscarPorId(id, userId);
    if (!parametro) throw erroNaoEncontrado();
    return parametro;
  },

  async criar(userId: string, data: CriarParametroInput) {
    try {
      return await parametrosRepository.criar(userId, data);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw erroConflito(`Já existe um parâmetro com o nome "${data.nome}"`);
      }
      throw err;
    }
  },

  async atualizar(id: string, userId: string, data: AtualizarParametroInput) {
    const existente = await parametrosRepository.buscarPorId(id, userId);
    if (!existente) throw erroNaoEncontrado();

    try {
      return await parametrosRepository.atualizar(id, userId, data);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw erroConflito(`Já existe um parâmetro com o nome "${data.nome ?? existente.nome}"`);
      }
      throw err;
    }
  },

  async excluir(id: string, userId: string) {
    const existente = await parametrosRepository.buscarPorId(id, userId);
    if (!existente) throw erroNaoEncontrado();

    // Preservação de dados: parâmetros usados em avaliações não podem ser excluídos
    // pois isso destruiria o histórico científico via cascade.
    // Use ativo: false para desativar sem perder os dados.
    const usos = await parametrosRepository.contarUsos(id);
    if (usos > 0) {
      throw erroConflito(
        `Parâmetro vinculado a ${usos} avaliação(ões). ` +
          `Desative com { "ativo": false } para que não apareça em novas avaliações.`
      );
    }

    await parametrosRepository.excluir(id, userId);
  },

  // ── Critérios por espécie ─────────────────────────────────────────────────

  async upsertCriterioEspecie(
    parametroId: string,
    userId: string,
    especieId: string,
    data: CriterioEspecieInput
  ) {
    const parametro = await parametrosRepository.buscarPorId(parametroId, userId);
    if (!parametro) throw erroNaoEncontrado();

    try {
      return await parametrosRepository.upsertCriterioEspecie(parametroId, especieId, data);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        throw erroNaoEncontrado("Espécie não encontrada");
      }
      throw err;
    }
  },

  async excluirCriterioEspecie(parametroId: string, userId: string, especieId: string) {
    const parametro = await parametrosRepository.buscarPorId(parametroId, userId);
    if (!parametro) throw erroNaoEncontrado();

    try {
      await parametrosRepository.excluirCriterioEspecie(parametroId, especieId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw erroNaoEncontrado("Critério por espécie não encontrado");
      }
      throw err;
    }
  },
};
