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
}

export const META_VAZIA: MetaOffline = { desde: null, ultimoPull: null, armazenamentoPersistente: null };
