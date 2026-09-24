import { prisma } from "../../config/database";
import { parsearJson } from "../../shared/json";
import { parsearDimensoes } from "../colonias/colonias.repository";
import { filtrosParaWhere, parsearCaracteristicas } from "../producoes/producoes.repository";
import type { LinhaCsv } from "./csv";
import type {
  ExportarAvaliacoesInput,
  ExportarColoniasInput,
  ExportarProducoesInput,
} from "./exportacao.types";

// Metodologia anexada a toda exportação JSON (e documentada em docs/exportacao.md),
// para que o dataset seja interpretável e reprodutível fora do app.
export const METODOLOGIA = {
  score:
    "scoreGeral = round((n_bom × 100 + n_medio × 50 + n_ruim × 0) / n_parametros). " +
    "Faixas: 80–100 excelente | 60–79 boa | 40–59 atencao | 0–39 critica.",
  classificacaoPontos: { bom: 100, medio: 50, ruim: 0 },
  clima:
    "temperatura (°C), umidade (% relativa) e condicao_climatica, quando não informados " +
    "manualmente, são obtidos automaticamente da Open-Meteo (Forecast ou Archive/ERA5) " +
    "para a hora UTC da avaliação e a coordenada da colônia (fallback: meliponário). " +
    "Dados climáticos: Open-Meteo.com, licença CC BY 4.0.",
  producao:
    "quantidade na unidade indicada (ml ou g); unidades diferentes não devem ser somadas.",
  especies: "codigo no padrão Kew: 4 letras do gênero + 4 do epíteto (+ _4 da subespécie).",
  datas: "ISO 8601, UTC.",
} as const;

export function metadados(recurso: string, filtros: object, totalRegistros: number) {
  return {
    fonte: "Corbicula",
    versaoApi: "1.0.0",
    recurso,
    exportadoEm: new Date().toISOString(),
    filtros,
    totalRegistros,
    metodologia: METODOLOGIA,
  };
}

const PONTOS: Record<string, number> = { bom: 100, medio: 50, ruim: 0 };

const parsearLista = (valor: string | null) => parsearJson<string[]>(valor, []);

function intervalo(desde?: Date, ate?: Date) {
  if (desde === undefined && ate === undefined) return undefined;
  return { ...(desde !== undefined && { gte: desde }), ...(ate !== undefined && { lte: ate }) };
}

// ─── Colônias ─────────────────────────────────────────────────────────────────

export const COLUNAS_COLONIAS = [
  "colonia_id", "codigo", "status", "especie_codigo", "especie_nome_cientifico",
  "especie_nome_popular", "data_entrada", "origem", "tipo_caixa", "caixa_altura",
  "caixa_largura", "caixa_profundidade", "localizacao", "latitude", "longitude",
  "colonia_mae_id", "colonia_mae_codigo", "n_avaliacoes", "n_producoes", "observacoes",
  "registrado_em", "atualizado_em",
] as const;

async function linhasColonias(userId: string, f: ExportarColoniasInput): Promise<LinhaCsv[]> {
  const colonias = await prisma.colonia.findMany({
    where: { userId, ...(f.status !== undefined && { status: f.status }) },
    include: {
      especie: { select: { codigo: true, nomeCientifico: true, nomePopular: true } },
      coloniaMae: { select: { codigo: true } },
      _count: { select: { avaliacoes: true, producoes: true } },
    },
    orderBy: { codigo: "asc" },
  });

  return colonias.map((c) => {
    const dim = parsearDimensoes(c.dimensoesCaixa);
    return {
      colonia_id: c.id,
      codigo: c.codigo,
      status: c.status,
      especie_codigo: c.especie?.codigo,
      especie_nome_cientifico: c.especie?.nomeCientifico,
      especie_nome_popular: c.especie?.nomePopular,
      data_entrada: c.dataEntrada,
      origem: c.origem,
      tipo_caixa: c.tipoCaixa,
      caixa_altura: dim?.altura,
      caixa_largura: dim?.largura,
      caixa_profundidade: dim?.profundidade,
      localizacao: c.localizacao,
      latitude: c.latitude,
      longitude: c.longitude,
      colonia_mae_id: c.coloniaMaeId,
      colonia_mae_codigo: c.coloniaMae?.codigo,
      n_avaliacoes: c._count.avaliacoes,
      n_producoes: c._count.producoes,
      observacoes: c.observacoes,
      registrado_em: c.createdAt,
      atualizado_em: c.updatedAt,
    };
  });
}

// ─── Avaliações (formato longo / tidy) ────────────────────────────────────────
// Uma linha por (avaliação × parâmetro avaliado). Os campos da avaliação se
// repetem em cada linha — formato direto para pivot, dplyr/pandas groupby etc.

export const COLUNAS_AVALIACOES = [
  "avaliacao_id", "colonia_id", "colonia_codigo", "especie_codigo", "data_avaliacao",
  "duracao_minutos", "temperatura_c", "umidade_pct", "condicao_climatica", "score_geral",
  "status_geral", "n_parametros", "parametro_id", "parametro_nome", "classificacao",
  "classificacao_pontos", "valor_numerico", "observacoes_parametro", "observacoes_gerais",
  "acoes_tomadas", "registrado_em",
] as const;

async function linhasAvaliacoes(userId: string, f: ExportarAvaliacoesInput): Promise<LinhaCsv[]> {
  const periodo = intervalo(f.desde, f.ate);
  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      colonia: { userId },
      ...(f.coloniaId !== undefined && { coloniaId: f.coloniaId }),
      ...(periodo && { dataAvaliacao: periodo }),
    },
    include: {
      colonia: { select: { codigo: true, especie: { select: { codigo: true } } } },
      parametros: {
        include: { parametro: { select: { nome: true, ordem: true } } },
        orderBy: { parametro: { ordem: "asc" } },
      },
    },
    orderBy: { dataAvaliacao: "asc" },
  });

  return avaliacoes.flatMap((a) =>
    a.parametros.map((p) => ({
      avaliacao_id: a.id,
      colonia_id: a.coloniaId,
      colonia_codigo: a.colonia.codigo,
      especie_codigo: a.colonia.especie?.codigo,
      data_avaliacao: a.dataAvaliacao,
      duracao_minutos: a.duracaoMinutos,
      temperatura_c: a.temperatura,
      umidade_pct: a.umidade,
      condicao_climatica: a.condicaoClimatica,
      score_geral: a.scoreGeral,
      status_geral: a.statusGeral,
      n_parametros: a.parametros.length,
      parametro_id: p.parametroId,
      parametro_nome: p.parametro.nome,
      classificacao: p.classificacao,
      classificacao_pontos: PONTOS[p.classificacao],
      valor_numerico: p.valorNumerico,
      observacoes_parametro: p.observacoes,
      observacoes_gerais: a.observacoesGerais,
      acoes_tomadas: parsearLista(a.acoesTomadas).join(" | "),
      registrado_em: a.createdAt,
    }))
  );
}

// ─── Produções ────────────────────────────────────────────────────────────────

export const COLUNAS_PRODUCOES = [
  "producao_id", "colonia_id", "colonia_codigo", "especie_codigo", "data_colheita",
  "tipo_produto", "quantidade", "unidade", "cor", "aroma", "sabor", "n_fotos",
  "observacoes", "registrado_em",
] as const;

async function linhasProducoes(userId: string, f: ExportarProducoesInput): Promise<LinhaCsv[]> {
  const producoes = await prisma.producao.findMany({
    where: filtrosParaWhere(userId, f),
    include: {
      colonia: { select: { codigo: true, especie: { select: { codigo: true } } } },
      _count: { select: { fotos: true } },
    },
    orderBy: { dataColheita: "asc" },
  });

  return producoes.map((p) => {
    const car = parsearCaracteristicas(p.caracteristicas);
    return {
      producao_id: p.id,
      colonia_id: p.coloniaId,
      colonia_codigo: p.colonia.codigo,
      especie_codigo: p.colonia.especie?.codigo,
      data_colheita: p.dataColheita,
      tipo_produto: p.tipoProduto,
      quantidade: p.quantidade,
      unidade: p.unidade,
      cor: car?.cor,
      aroma: car?.aroma,
      sabor: car?.sabor,
      n_fotos: p._count.fotos,
      observacoes: p.observacoes,
      registrado_em: p.createdAt,
    };
  });
}

// ─── Backup completo ──────────────────────────────────────────────────────────
// JSON estruturado com todos os dados do usuário (portabilidade/LGPD).
// Campos JSON armazenados como texto são devolvidos já parseados. Fotos vão
// como metadados + url; os arquivos em si não entram no JSON.

async function backupCompleto(userId: string) {
  const [usuario, parametros, colonias, avaliacoes, producoes, fotos] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true, meliponario: true },
    }),
    prisma.parametro.findMany({
      where: { userId },
      include: { criteriosEspecie: { include: { especie: { select: { codigo: true } } } } },
      orderBy: { ordem: "asc" },
    }),
    prisma.colonia.findMany({
      where: { userId },
      include: { especie: { select: { codigo: true, nomeCientifico: true } } },
      orderBy: { codigo: "asc" },
    }),
    prisma.avaliacao.findMany({
      where: { colonia: { userId } },
      include: { parametros: true },
      orderBy: { dataAvaliacao: "asc" },
    }),
    prisma.producao.findMany({ where: { colonia: { userId } }, orderBy: { dataColheita: "asc" } }),
    prisma.foto.findMany({ where: { colonia: { userId } }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    metadados: metadados("backup", {}, colonias.length + avaliacoes.length + producoes.length),
    usuario,
    parametros,
    colonias: colonias.map(({ dimensoesCaixa, ...c }) => ({
      ...c,
      dimensoesCaixa: parsearDimensoes(dimensoesCaixa),
    })),
    avaliacoes: avaliacoes.map(({ acoesTomadas, ...a }) => ({
      ...a,
      acoesTomadas: parsearLista(acoesTomadas),
    })),
    producoes: producoes.map(({ caracteristicas, ...p }) => ({
      ...p,
      caracteristicas: parsearCaracteristicas(caracteristicas),
    })),
    fotos,
  };
}

export const exportacaoService = {
  linhasColonias,
  linhasAvaliacoes,
  linhasProducoes,
  backupCompleto,
};
