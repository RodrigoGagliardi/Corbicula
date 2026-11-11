import type { Avaliacao, Classificacao, Colonia, Parametro, Producao } from "../../types/api";

// Linhas como o GET /sync/alteracoes as devolve (app/backend/src/modules/sync/sync.service.ts):
// registros crus do Prisma, sem os campos que as rotas REST derivam ou embutem
// (`especie`, `ultimaAvaliacao`, `_count`, `colonia`). Datas em ISO 8601 (UTC).

export type ColoniaServidor = Omit<Colonia, "especie" | "ultimaAvaliacao" | "_count"> & { userId: string };

export interface AvaliacaoParametroServidor {
  id: string;
  avaliacaoId: string;
  parametroId: string;
  classificacao: Classificacao;
  valorNumerico: number | null;
  observacoes: string | null;
  createdAt: string;
}

// Os parâmetros avaliados vêm só com o `parametroId` (sem o objeto `parametro`).
export interface AvaliacaoServidor extends Avaliacao {
  parametros: AvaliacaoParametroServidor[];
}

export type ProducaoServidor = Omit<Producao, "colonia" | "_count">;

export interface CriterioEspecieServidor {
  id: string;
  parametroId: string;
  especieId: string;
  criterioBom: string;
  criterioMedio: string;
  criterioRuim: string;
  createdAt: string;
  updatedAt: string;
}

export type ParametroServidor = Omit<Parametro, "criteriosEspecie" | "_count"> & {
  userId: string;
  createdAt: string;
  updatedAt: string;
  criteriosEspecie: CriterioEspecieServidor[];
};

// Tipos de registro que o pull traz (cada um vira um store do IndexedDB).
export const TIPOS_PULL = ["colonias", "avaliacoes", "producoes", "parametros"] as const;
export type TipoPull = (typeof TIPOS_PULL)[number];

export interface LinhasPull {
  colonias: ColoniaServidor[];
  avaliacoes: AvaliacaoServidor[];
  producoes: ProducaoServidor[];
  parametros: ParametroServidor[];
}

export type IdsPorTipo = Record<TipoPull, string[]>;

export interface RespostaAlteracoes extends LinhasPull {
  // Momento do servidor capturado antes das consultas: é o próximo `desde`.
  servidorEm: string;
  desde: string | null;
  // Todos os ids existentes no servidor, por tipo; o que faltar foi excluído.
  idsAtuais: IdsPorTipo;
}

// Registro único do store `meta`.
export interface MetaOffline {
  // `servidorEm` do último pull aplicado; null = nunca houve carga (próximo pull é completo).
  desde: string | null;
  // Quando (relógio local) o último pull foi aplicado; só para exibição.
  ultimoPull: string | null;
  // Resultado do pedido de armazenamento persistente; null = ainda não pedido.
  armazenamentoPersistente: boolean | null;
  // true = o próximo pull é uma carga completa (ex.: uma exclusão local foi
  // descartada e a linha precisa voltar do servidor).
  recarregar?: boolean;
}

export const META_VAZIA: MetaOffline = { desde: null, ultimoPull: null, armazenamentoPersistente: null };

// ─── Fila de operações offline (POST /sync) ──────────────────────────────────
// Contrato em app/backend/src/modules/sync/sync.types.ts.

export const TIPOS_OPERACAO = ["colonia", "avaliacao", "producao"] as const;
export type TipoOperacao = (typeof TIPOS_OPERACAO)[number];
export type AcaoOperacao = "create" | "update" | "delete";

// Linha local de qualquer tipo que a fila altera.
export type LinhaLocal = ColoniaServidor | AvaliacaoServidor | ProducaoServidor;

// Operação como o POST /sync a recebe.
export interface OperacaoSync {
  id: string;
  tipo: TipoOperacao;
  operacao: AcaoOperacao;
  entidadeId: string;
  coloniaId?: string;
  dados: Record<string, unknown>;
  baseUpdatedAt?: string;
  criadoEm: string;
}

// pendente: espera envio (também enquanto está sendo enviada; o reenvio usa o
// mesmo `id`). conflito/erro: parada, espera decisão do usuário (story 6).
export type EstadoOperacao = "pendente" | "conflito" | "erro";

export interface OperacaoFila extends OperacaoSync {
  // Posição na fila (crescente): a última da fila + 1, dada pelo `enfileirar`.
  ordem: number;
  estado: EstadoOperacao;
  tentativas: number;
  // Colônias que a operação referencia além da própria entidade (mãe, doadora,
  // colônia da avaliação/colheita): uma pendência numa delas a segura.
  relacionadas: string[];
  ultimoErro?: string;
  // Versão do servidor devolvida num conflito.
  servidor?: unknown;
  // Campos alterados nos dois lados para valores diferentes (conflito que espera decisão).
  conflitos?: { campo: string; local: unknown; servidor: unknown }[];
  // Linha local antes de um update (base da junção por campos, story 6).
  base?: LinhaLocal;
}

export type StatusSync = "aplicado" | "duplicado" | "conflito" | "erro";

export interface ResultadoOperacaoSync {
  id: string;
  status: StatusSync;
  entidadeId: string;
  erro?: string;
  servidor?: unknown;
}

export interface RespostaSync {
  servidorEm: string;
  processadas: number;
  aplicadas: number;
  duplicadas: number;
  conflitos: number;
  erros: number;
  resultados: ResultadoOperacaoSync[];
}

// ─── Fotos guardadas offline (POST /fotos depois do /sync) ───────────────────

// Registro a que a foto se liga (um só, como o upload aceita).
export type VinculoFoto = { coloniaId: string } | { avaliacaoId: string } | { producaoId: string };

export interface FotoPendente {
  id: string;
  vinculo: VinculoFoto;
  // Id do registro do vínculo (índice para a galeria e para esperar o create).
  entidadeId: string;
  // Bytes da foto comprimida e o tipo: um Blob no IndexedDB falha em alguns navegadores.
  bytes: ArrayBuffer;
  tipo: string;
  criadoEm: string;
  // pendente: sobe na próxima sincronização; erro: recusada pelo servidor (4xx), parada.
  estado: "pendente" | "erro";
  tentativas: number;
  ultimoErro?: string;
}
