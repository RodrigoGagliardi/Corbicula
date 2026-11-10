// Tipos das respostas da API (espelham app/backend/src/modules/*).
// Datas chegam como string ISO 8601 (UTC).

import type { FonteClima, MotivoAcaoCodigo, MotivoInspecaoCodigo, MotivoStatusCodigo } from "../utils/vocabularios";

export type Classificacao = "bom" | "medio" | "ruim";
export type StatusAvaliacao = "excelente" | "boa" | "atencao" | "critica";
export type StatusColonia = "ativa" | "inativa" | "morta";
export type Origem = "captura" | "compra" | "divisao" | "resgate";
export type TipoCaixa = "INPA" | "PNN" | "Schenck" | "tronco" | "outro";
export type CondicaoClimatica = "ensolarado" | "nublado" | "chuvoso";

export interface Meliponario {
  id: string;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  bioma: string | null;
  areaTotal: number | null;
}

export interface MeliponarioInput {
  nome: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  latitude?: number;
  longitude?: number;
  bioma?: string;
  areaTotal?: number;
}

export interface Usuario {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  meliponario: Meliponario | null;
}

export interface RespostaAuth {
  token: string;
  user: Usuario;
}

export interface Especie {
  id: string;
  codigo: string;
  nomePopular: string;
  nomeCientifico: string;
  nomesAlternativos: string[];
  statusConservacao: string | null;
}

export interface EspecieResumo {
  codigo: string;
  nomePopular: string;
  nomeCientifico: string;
}

export interface AvaliacaoResumo {
  id: string;
  dataAvaliacao: string;
  scoreGeral: number;
  statusGeral: StatusAvaliacao;
}

export interface DimensoesCaixa {
  altura?: number;
  largura?: number;
  profundidade?: number;
}

export interface Colonia {
  id: string;
  codigo: string;
  dataEntrada: string;
  origem: Origem;
  tipoCaixa: TipoCaixa;
  dimensoesCaixa: DimensoesCaixa | null;
  localizacao: string | null;
  latitude: number | null;
  longitude: number | null;
  observacoes: string | null;
  status: StatusColonia;
  // Intervalo sugerido entre inspeções (dias); null = preferência geral.
  frequenciaInspecaoDias: number | null;
  // Estado atual do status (cópia da última entrada do histórico). Nulos em
  // registros anteriores a 06/11/2026; podem faltar numa cópia offline antiga.
  statusDesde: string | null;
  motivoStatus: MotivoStatusCodigo | null;
  motivoStatusDetalhe: string | null;
  especieId: string | null;
  coloniaMaeId: string | null;
  coloniaDoadoraCampeirasId: string | null;
  especie: EspecieResumo | null;
  ultimaAvaliacao: AvaliacaoResumo | null;
  _count: { avaliacoes: number; producoes: number };
  createdAt: string;
  updatedAt: string;
}

export interface ColoniaDetalhada extends Colonia {
  coloniaMae: { id: string; codigo: string } | null;
  coloniasFilhas: { id: string; codigo: string; status: StatusColonia }[];
  coloniaDoadoraCampeiras: { id: string; codigo: string } | null;
  coloniasReceptorasCampeiras: { id: string; codigo: string; status: StatusColonia }[];
  // Só na API (GET /colonias/:id); a cópia offline não o tem.
  historicoStatus?: EntradaHistoricoStatus[];
}

// Uma mudança de status (a API devolve da mais antiga para a mais recente).
export interface EntradaHistoricoStatus {
  id: string;
  // null = primeira entrada criada por uma correção (status anterior desconhecido).
  statusAnterior: StatusColonia | null;
  statusNovo: StatusColonia;
  dataPercebida: string;
  motivo: MotivoStatusCodigo | null;
  motivoDetalhe: string | null;
  createdAt: string;
  // Difere de createdAt quando a entrada foi corrigida.
  updatedAt: string;
}

export interface CriterioEspecie {
  id: string;
  especieId: string;
  criterioBom: string;
  criterioMedio: string;
  criterioRuim: string;
  especie: { id: string; codigo: string; nomePopular: string };
}

export interface Parametro {
  id: string;
  nome: string;
  ordem: number;
  criterioBom: string;
  criterioMedio: string;
  criterioRuim: string;
  ativo: boolean;
  criteriosEspecie: CriterioEspecie[];
  _count: { avaliacoesParametros: number };
}

export interface AvaliacaoParametro {
  id: string;
  parametroId: string;
  classificacao: Classificacao;
  valorNumerico: number | null;
  observacoes: string | null;
  parametro: { id: string; nome: string; ordem: number };
}

export interface Avaliacao {
  id: string;
  coloniaId: string;
  dataAvaliacao: string;
  duracaoMinutos: number | null;
  temperatura: number | null;
  umidade: number | null;
  condicaoClimatica: CondicaoClimatica | null;
  observacoesGerais: string | null;
  acoesTomadas: string[];
  // Contexto (06/11/2026; nulos em registros anteriores).
  motivoInspecao: MotivoInspecaoCodigo | null;
  motivoInspecaoDetalhe: string | null;
  // Ação (de acoesTomadas) → motivo.
  motivosAcoes: Record<string, MotivoAcaoCodigo> | null;
  climaFonte: FonteClima | null;
  protocoloId: string | null;
  scoreGeral: number;
  statusGeral: StatusAvaliacao;
  createdAt: string;
  updatedAt: string;
}

export interface AvaliacaoDetalhada extends Avaliacao {
  parametros: AvaliacaoParametro[];
}

export interface AvaliacaoLista extends Avaliacao {
  _count: { parametros: number };
}

// Item do histórico geral (GET /avaliacoes): inclui a colônia.
export interface AvaliacaoHistorico extends AvaliacaoLista {
  colonia: { id: string; codigo: string; especie: { codigo: string; nomePopular: string } | null };
}

export interface FiltrosAvaliacoes {
  coloniaId?: string;
  status?: StatusAvaliacao;
  parametroId?: string;
  classificacao?: Classificacao;
  desde?: string; // YYYY-MM-DD
  ate?: string;
}

export interface Foto {
  id: string;
  url: string;
  legenda: string | null;
  tamanhoKb: number | null;
  coloniaId: string | null;
  avaliacaoId: string | null;
  avaliacaoParametroId: string | null;
  producaoId: string | null;
  createdAt: string;
}

// ─── Produção ─────────────────────────────────────────────────────────────────

export type TipoProduto = "mel" | "polen" | "propolis" | "cera";
export type Unidade = "ml" | "g";

export interface Caracteristicas {
  cor?: string;
  aroma?: string;
  sabor?: string;
}

export interface Producao {
  id: string;
  coloniaId: string;
  dataColheita: string;
  tipoProduto: TipoProduto;
  quantidade: number;
  unidade: Unidade;
  caracteristicas: Caracteristicas | null;
  observacoes: string | null;
  colonia: { id: string; codigo: string; especie: EspecieResumo | null };
  _count: { fotos: number };
  createdAt: string;
  updatedAt: string;
}

export interface FiltrosProducao {
  coloniaId?: string;
  tipoProduto?: TipoProduto;
  desde?: string; // YYYY-MM-DD
  ate?: string;
}

export interface ColoniaRanking {
  coloniaId: string;
  codigo: string;
  total: number;
  colheitas: number;
}

// Um grupo por (tipoProduto, unidade): unidades diferentes nunca são somadas.
export interface GrupoProducao {
  tipoProduto: TipoProduto;
  unidade: Unidade;
  total: number;
  colheitas: number;
  mediaPorColheita: number;
  coloniasProdutoras: number;
  mediaPorColonia: number;
  melhorProdutora: ColoniaRanking | null;
  piorProdutora: ColoniaRanking | null;
  rankingColonias: ColoniaRanking[];
  porEspecie: {
    especieCodigo: string | null;
    nomeCientifico: string | null;
    total: number;
    colheitas: number;
    colonias: number;
    mediaPorColonia: number;
  }[];
}

export interface ResumoProducao {
  metodologia: string;
  grupos: GrupoProducao[];
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

// `id` (create): UUID gerado no cliente, o mesmo da operação offline (services/offline/escrita.ts).
export interface ColoniaInput {
  id?: string;
  dataEntrada: string;
  origem: Origem;
  tipoCaixa: TipoCaixa;
  especieId?: string | null;
  coloniaMaeId?: string | null;
  coloniaDoadoraCampeirasId?: string | null;
  status?: StatusColonia;
  dimensoesCaixa?: DimensoesCaixa | null;
  localizacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  observacoes?: string | null;
  frequenciaInspecaoDias?: number | null;
  // Só no PATCH: data e motivo da mudança de status (ou correção da última).
  statusDesde?: string;
  motivoStatus?: MotivoStatusCodigo | null;
  motivoStatusDetalhe?: string | null;
}

export interface AvaliacaoInput {
  id?: string;
  dataAvaliacao: string;
  parametros: { parametroId: string; classificacao: Classificacao; observacoes?: string | null }[];
  observacoesGerais?: string | null;
  acoesTomadas?: string[] | null;
  duracaoMinutos?: number | null;
  motivoInspecao?: MotivoInspecaoCodigo | null;
  motivoInspecaoDetalhe?: string | null;
  motivosAcoes?: Record<string, MotivoAcaoCodigo> | null;
}

export interface ParametroInput {
  nome: string;
  ordem?: number;
  criterioBom: string;
  criterioMedio: string;
  criterioRuim: string;
  ativo?: boolean;
}

export interface ProducaoInput {
  id?: string;
  coloniaId: string;
  dataColheita: string;
  tipoProduto: TipoProduto;
  quantidade: number;
  unidade: Unidade;
  caracteristicas?: Caracteristicas | null;
  observacoes?: string | null;
}

// ─── Templates e importação de parâmetros (tela 18) ──────────────────────────

export type ModoAplicacao = "mesclar" | "substituir";

export interface CriteriosTexto {
  criterioBom: string;
  criterioMedio: string;
  criterioRuim: string;
}

export interface TemplateParametros {
  id: string;
  nome: string;
  versao: number;
  descricao: string;
  parametros: (CriteriosTexto & { nome: string })[];
}

// Formato de GET /parametros/exportar (aceito por POST /parametros/importar).
export interface ArquivoParametros {
  formato: "corbicula-parametros";
  versao: 1;
  exportadoEm?: string;
  parametros: (CriteriosTexto & {
    nome: string;
    ativo?: boolean;
    criteriosEspecie?: (CriteriosTexto & { especie: string })[];
  })[];
}

export interface ResumoAplicacao {
  criados: string[];
  reativados: string[];
  desativados: string[];
  existentes: string[];
  criteriosDiferentes: string[];
  especiesIgnoradas: string[];
}

// ─── Central de Alertas (tela 30) ────────────────────────────────────────────

export type TipoAlerta = "nunca_avaliada" | "sem_inspecao" | "score_baixo" | "queda_score" | "parametro_ruim";

export interface Alerta {
  chave: string;
  tipo: TipoAlerta;
  gravidade: "alta" | "media";
  titulo: string;
  detalhe: string;
  desde: string;
  colonia: { id: string; codigo: string; especie: { codigo: string; nomePopular: string } | null };
  avaliacao: AvaliacaoResumo | null;
  dados: Record<string, unknown>;
  resolvido: boolean;
  resolvidoEm: string | null;
}

export interface RespostaAlertas {
  alertas: Alerta[];
  totais: { abertos: number; alta: number; media: number; resolvidos: number };
  criterios: { diasSemInspecao: number; diasSemInspecaoPadrao: number; quedaScoreMinima: number; descricao: string };
}
