// Tipos das respostas da API (espelham app/backend/src/modules/*).
// Datas chegam como string ISO 8601 (UTC).

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
}

export interface Usuario {
  id: string;
  email: string;
  name: string;
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

export interface ColoniaInput {
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
}

export interface AvaliacaoInput {
  dataAvaliacao: string;
  parametros: { parametroId: string; classificacao: Classificacao; observacoes?: string | null }[];
  observacoesGerais?: string | null;
  acoesTomadas?: string[] | null;
  duracaoMinutos?: number | null;
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
  coloniaId: string;
  dataColheita: string;
  tipoProduto: TipoProduto;
  quantidade: number;
  unidade: Unidade;
  caracteristicas?: Caracteristicas | null;
  observacoes?: string | null;
}
