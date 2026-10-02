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
  especie: EspecieResumo | null;
  ultimaAvaliacao: AvaliacaoResumo | null;
  _count: { avaliacoes: number; producoes: number };
  createdAt: string;
  updatedAt: string;
}

export interface ColoniaDetalhada extends Colonia {
  coloniaMae: { id: string; codigo: string } | null;
  coloniasFilhas: { id: string; codigo: string; status: StatusColonia }[];
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

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface ColoniaInput {
  dataEntrada: string;
  origem: Origem;
  tipoCaixa: TipoCaixa;
  especieId?: string | null;
  coloniaMaeId?: string | null;
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
