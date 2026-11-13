import { prisma } from "../../config/database";
import { parsearJson } from "../../shared/json";
import { classeDoMotivo } from "../../shared/vocabularios";
import { parsearDimensoes } from "../colonias/colonias.repository";
import { filtrosParaWhere, parsearCaracteristicas } from "../producoes/producoes.repository";
import type { LinhaCsv } from "./csv";
import type {
  Formato,
  ExportarAvaliacoesInput,
  ExportarColoniasInput,
  ExportarHistoricoStatusInput,
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
  climaFonte:
    "clima_fonte: api_previsao (Open-Meteo Forecast), api_historico (Open-Meteo Archive/ERA5), " +
    "digitado (o usuário informou ou alterou algum campo de clima); vazio = sem clima ou " +
    "avaliação anterior ao registro da procedência (não registrado).",
  protocolo:
    "Cada avaliação guarda o protocolo vigente: parâmetros avaliados e texto dos critérios " +
    "Bom/Médio/Ruim aplicados (com o override da espécie da colônia). Conteúdo canônico " +
    "{ versao: 1, itens } com os itens ordenados pelo nome normalizado (minúsculas, sem acentos) e " +
    "cada texto em Unicode NFC, sem espaços nas pontas; protocolo_hash = SHA-256 do JSON desse " +
    "conteúdo, sem ids: o mesmo hash indica os mesmos critérios, inclusive entre meliponários. " +
    "Editar um critério depois não muda o protocolo de avaliações já feitas. Vazio = avaliação " +
    "anterior ao registro do protocolo.",
  motivos:
    "motivo_inspecao, motivos_acoes e motivo_status usam vocabulários fechados (docs/exportacao.md); " +
    "vazio = não registrado. classe_motivo separa evento (morte, perda) de censura (saída do manejo).",
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
  "colonia_id", "codigo", "status", "status_desde", "motivo_status", "motivo_status_detalhe",
  "classe_motivo_status", "especie_codigo", "especie_nome_cientifico",
  "especie_nome_popular", "data_entrada", "origem", "tipo_caixa", "caixa_altura",
  "caixa_largura", "caixa_profundidade", "localizacao", "latitude", "longitude",
  "colonia_mae_id", "colonia_mae_codigo", "colonia_doadora_campeiras_id",
  "colonia_doadora_campeiras_codigo", "frequencia_inspecao_dias", "n_avaliacoes", "n_producoes", "observacoes",
  "registrado_em", "atualizado_em",
] as const;

async function linhasColonias(userId: string, f: ExportarColoniasInput): Promise<LinhaCsv[]> {
  const colonias = await prisma.colonia.findMany({
    where: { userId, ...(f.status !== undefined && { status: f.status }) },
    include: {
      especie: { select: { codigo: true, nomeCientifico: true, nomePopular: true } },
      coloniaMae: { select: { codigo: true } },
      coloniaDoadoraCampeiras: { select: { codigo: true } },
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
      status_desde: c.statusDesde,
      motivo_status: c.motivoStatus,
      motivo_status_detalhe: c.motivoStatusDetalhe,
      classe_motivo_status: classeDoMotivo(c.motivoStatus, c.status),
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
      colonia_doadora_campeiras_id: c.coloniaDoadoraCampeirasId,
      colonia_doadora_campeiras_codigo: c.coloniaDoadoraCampeiras?.codigo,
      frequencia_inspecao_dias: c.frequenciaInspecaoDias,
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
  "motivo_inspecao", "motivo_inspecao_detalhe",
  "duracao_minutos", "temperatura_c", "umidade_pct", "condicao_climatica", "clima_fonte", "score_geral",
  "status_geral", "n_parametros", "protocolo_hash", "parametro_id", "parametro_nome", "classificacao",
  "classificacao_pontos", "valor_numerico", "observacoes_parametro", "observacoes_gerais",
  "acoes_tomadas", "motivos_acoes", "registrado_em",
] as const;

// motivos_acoes no CSV: lista paralela a acoes_tomadas (mesma ordem, separador
// " | "), com item vazio na ação sem motivo; vazia quando nenhum motivo foi
// registrado. No JSON sai o próprio mapa { ação: motivo } (ou null).
// Só chaves próprias do mapa: uma ação chamada "constructor" não pode ler o
// Object.prototype.
const temChave = (obj: object, chave: string) => Object.prototype.hasOwnProperty.call(obj, chave);

function motivosParalelos(acoes: string[], motivos: unknown): string {
  if (!motivos || typeof motivos !== "object") return "";
  const mapa = motivos as Record<string, string>;
  const motivo = (a: string) => (temChave(mapa, a) ? mapa[a]! : "");
  if (!acoes.some((a) => motivo(a))) return "";
  return acoes.map(motivo).join(" | ");
}

function motivosObjeto(motivos: unknown): Record<string, string> | null {
  if (!motivos || typeof motivos !== "object" || Array.isArray(motivos)) return null;
  return motivos as Record<string, string>;
}

async function linhasAvaliacoes(
  userId: string,
  f: ExportarAvaliacoesInput,
  formato: Formato = "csv"
): Promise<LinhaCsv[]> {
  const periodo = intervalo(f.desde, f.ate);
  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      colonia: { userId },
      ...(f.coloniaId !== undefined && { coloniaId: f.coloniaId }),
      ...(f.status !== undefined && { statusGeral: f.status }),
      ...(periodo && { dataAvaliacao: periodo }),
    },
    include: {
      colonia: { select: { codigo: true, especie: { select: { codigo: true } } } },
      protocolo: { select: { hash: true } },
      parametros: {
        include: { parametro: { select: { nome: true, ordem: true } } },
        orderBy: { parametro: { ordem: "asc" } },
      },
    },
    orderBy: { dataAvaliacao: "asc" },
  });

  return avaliacoes.flatMap((a) => {
    const acoes = parsearLista(a.acoesTomadas);
    return a.parametros.map((p) => ({
      avaliacao_id: a.id,
      colonia_id: a.coloniaId,
      colonia_codigo: a.colonia.codigo,
      especie_codigo: a.colonia.especie?.codigo,
      data_avaliacao: a.dataAvaliacao,
      motivo_inspecao: a.motivoInspecao,
      motivo_inspecao_detalhe: a.motivoInspecaoDetalhe,
      duracao_minutos: a.duracaoMinutos,
      temperatura_c: a.temperatura,
      umidade_pct: a.umidade,
      condicao_climatica: a.condicaoClimatica,
      clima_fonte: a.climaFonte,
      score_geral: a.scoreGeral,
      status_geral: a.statusGeral,
      n_parametros: a.parametros.length,
      protocolo_hash: a.protocolo?.hash,
      parametro_id: p.parametroId,
      parametro_nome: p.parametro.nome,
      classificacao: p.classificacao,
      classificacao_pontos: PONTOS[p.classificacao],
      valor_numerico: p.valorNumerico,
      observacoes_parametro: p.observacoes,
      observacoes_gerais: a.observacoesGerais,
      acoes_tomadas: acoes.join(" | "),
      motivos_acoes: formato === "json" ? motivosObjeto(a.motivosAcoes) : motivosParalelos(acoes, a.motivosAcoes),
      registrado_em: a.createdAt,
    }));
  });
}

// ─── Histórico de status das colônias ─────────────────────────────────────────
// Uma linha por mudança de status (registradas a partir de 06/11/2026; mudanças
// anteriores não foram registradas e não são reconstituídas).

export const COLUNAS_HISTORICO_STATUS = [
  "historico_id", "colonia_id", "colonia_codigo", "especie_codigo", "status_anterior",
  "status_novo", "data_percebida", "motivo", "motivo_detalhe", "classe_motivo", "registrado_em",
  "atualizado_em",
] as const;

async function linhasHistoricoStatus(userId: string, f: ExportarHistoricoStatusInput): Promise<LinhaCsv[]> {
  const periodo = intervalo(f.desde, f.ate);
  const entradas = await prisma.coloniaStatusHistorico.findMany({
    where: {
      colonia: { userId },
      ...(f.coloniaId !== undefined && { coloniaId: f.coloniaId }),
      ...(periodo && { dataPercebida: periodo }),
    },
    include: { colonia: { select: { codigo: true, especie: { select: { codigo: true } } } } },
    orderBy: [{ dataPercebida: "asc" }, { createdAt: "asc" }],
  });

  return entradas.map((h) => ({
    historico_id: h.id,
    colonia_id: h.coloniaId,
    colonia_codigo: h.colonia.codigo,
    especie_codigo: h.colonia.especie?.codigo,
    status_anterior: h.statusAnterior,
    status_novo: h.statusNovo,
    data_percebida: h.dataPercebida,
    motivo: h.motivo,
    motivo_detalhe: h.motivoDetalhe,
    classe_motivo: classeDoMotivo(h.motivo, h.statusNovo),
    registrado_em: h.createdAt,
    atualizado_em: h.updatedAt,
  }));
}

// ─── Protocolos ───────────────────────────────────────────────────────────────
// Só JSON: o conteúdo é uma lista de parâmetros com critérios.

async function protocolos(userId: string) {
  const lista = await prisma.protocolo.findMany({
    where: { userId },
    include: { _count: { select: { avaliacoes: true } } },
    orderBy: { createdAt: "asc" },
  });
  return lista.map((p) => ({
    protocoloId: p.id,
    hash: p.hash,
    templateCodigo: p.templateCodigo,
    templateVersao: p.templateVersao,
    nAvaliacoes: p._count.avaliacoes,
    criadoEm: p.createdAt,
    conteudo: p.conteudo,
  }));
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
  const [usuario, parametros, colonias, avaliacoes, producoes, fotos, historicoStatus, listaProtocolos] = await Promise.all([
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
    prisma.coloniaStatusHistorico.findMany({
      where: { colonia: { userId } },
      orderBy: [{ dataPercebida: "asc" }, { createdAt: "asc" }],
    }),
    prisma.protocolo.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
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
    historicoStatus,
    protocolos: listaProtocolos,
  };
}

export const exportacaoService = {
  linhasColonias,
  linhasAvaliacoes,
  linhasProducoes,
  linhasHistoricoStatus,
  protocolos,
  backupCompleto,
};
