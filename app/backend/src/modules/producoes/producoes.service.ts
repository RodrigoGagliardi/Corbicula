import { prisma } from "../../config/database";
import { erroConflito, erroNaoEncontrado } from "../../shared/errors";
import { apagarArquivos, listarArquivosDe } from "../fotos/fotos.service";
import { parsearCaracteristicas, producoesRepository } from "./producoes.repository";
import type {
  AtualizarProducaoInput,
  CriarProducaoInput,
  FiltrosProducao,
} from "./producoes.types";

// ─── Mapper de saída ──────────────────────────────────────────────────────────

function mapearSaida<T extends { caracteristicas: string | null }>(producao: T) {
  const { caracteristicas, ...resto } = producao;
  return { ...resto, caracteristicas: parsearCaracteristicas(caracteristicas) };
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

// ─── Resumo de produção ───────────────────────────────────────────────────────
// Metodologia: agrupamento por (tipoProduto, unidade). Quantidades em unidades
// diferentes (ml × g) NUNCA são somadas — não há conversão volume→massa
// confiável sem densidade medida. Médias são aritméticas simples.

type ProducaoLista = Awaited<ReturnType<typeof producoesRepository.listar>>[number];

interface Acumulador {
  total: number;
  colheitas: number;
}

interface AcumuladorEspecie extends Acumulador {
  nomeCientifico: string | null;
  colonias: Set<string>;
}

interface Grupo extends Acumulador {
  tipoProduto: string;
  unidade: string;
  porColonia: Map<string, Acumulador & { codigo: string }>;
  porEspecie: Map<string, AcumuladorEspecie>;
}

function resumir(producoes: ProducaoLista[]) {
  const grupos = new Map<string, Grupo>();

  for (const p of producoes) {
    const chave = `${p.tipoProduto}|${p.unidade}`;
    let g = grupos.get(chave);
    if (!g) {
      g = { tipoProduto: p.tipoProduto, unidade: p.unidade, total: 0, colheitas: 0, porColonia: new Map(), porEspecie: new Map() };
      grupos.set(chave, g);
    }
    g.total += p.quantidade;
    g.colheitas += 1;

    const col = g.porColonia.get(p.coloniaId) ?? { codigo: p.colonia.codigo, total: 0, colheitas: 0 };
    col.total += p.quantidade;
    col.colheitas += 1;
    g.porColonia.set(p.coloniaId, col);

    const espCodigo = p.colonia.especie?.codigo ?? "SEM_ESPECIE";
    const esp = g.porEspecie.get(espCodigo) ?? {
      nomeCientifico: p.colonia.especie?.nomeCientifico ?? null,
      total: 0,
      colheitas: 0,
      colonias: new Set<string>(),
    };
    esp.total += p.quantidade;
    esp.colheitas += 1;
    esp.colonias.add(p.coloniaId);
    g.porEspecie.set(espCodigo, esp);
  }

  return [...grupos.values()].map((g) => {
    const ranking = [...g.porColonia.entries()]
      .map(([coloniaId, c]) => ({
        coloniaId,
        codigo: c.codigo,
        total: arredondar(c.total),
        colheitas: c.colheitas,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      tipoProduto: g.tipoProduto,
      unidade: g.unidade,
      total: arredondar(g.total),
      colheitas: g.colheitas,
      mediaPorColheita: arredondar(g.total / g.colheitas),
      coloniasProdutoras: ranking.length,
      mediaPorColonia: arredondar(g.total / ranking.length),
      melhorProdutora: ranking[0] ?? null,
      piorProdutora: ranking.length > 1 ? ranking[ranking.length - 1] : null,
      rankingColonias: ranking,
      porEspecie: [...g.porEspecie.entries()]
        .map(([codigo, e]) => ({
          especieCodigo: codigo === "SEM_ESPECIE" ? null : codigo,
          nomeCientifico: e.nomeCientifico,
          total: arredondar(e.total),
          colheitas: e.colheitas,
          colonias: e.colonias.size,
          mediaPorColonia: arredondar(e.total / e.colonias.size),
        }))
        .sort((a, b) => b.total - a.total),
    };
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

async function validarPropriedadeColonia(coloniaId: string, userId: string): Promise<void> {
  const colonia = await prisma.colonia.findFirst({
    where: { id: coloniaId, userId },
    select: { id: true },
  });
  if (!colonia) throw erroNaoEncontrado("Colônia não encontrada");
}

export const producoesService = {
  async listar(userId: string, filtros: FiltrosProducao) {
    const producoes = await producoesRepository.listar(userId, filtros);
    return producoes.map(mapearSaida);
  },

  async buscarPorId(id: string, userId: string) {
    const producao = await producoesRepository.buscarPorId(id, userId);
    if (!producao) throw erroNaoEncontrado("Colheita não encontrada");
    return mapearSaida(producao);
  },

  async resumo(userId: string, filtros: FiltrosProducao) {
    const producoes = await producoesRepository.listar(userId, filtros);
    return {
      filtros,
      metodologia:
        "Totais agrupados por (tipoProduto, unidade); unidades diferentes não são somadas. " +
        "Médias aritméticas simples.",
      grupos: resumir(producoes),
    };
  },

  async criar(userId: string, data: CriarProducaoInput) {
    await validarPropriedadeColonia(data.coloniaId, userId);
    if (data.id && (await producoesRepository.existeId(data.id))) {
      throw erroConflito("Já existe um registro com este id.");
    }
    return mapearSaida(await producoesRepository.criar(data));
  },

  async atualizar(id: string, userId: string, data: AtualizarProducaoInput) {
    await producoesService.buscarPorId(id, userId);
    return mapearSaida(await producoesRepository.atualizar(id, data));
  },

  async excluir(id: string, userId: string) {
    await producoesService.buscarPorId(id, userId);
    const arquivos = await listarArquivosDe({ producaoId: id });
    await producoesRepository.excluir(id);
    await apagarArquivos(arquivos);
  },
};
