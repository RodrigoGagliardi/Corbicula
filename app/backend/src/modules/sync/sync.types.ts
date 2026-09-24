import { z } from "zod";

export const TIPOS_SYNC = ["colonia", "avaliacao", "producao"] as const;
export const OPERACOES_SYNC = ["create", "update", "delete"] as const;

// Uma operação da fila offline do cliente (IndexedDB).
//  - id: UUID da operação, gerado no cliente → chave de idempotência
//  - entidadeId: UUID da entidade (no create, o cliente gera e o servidor usa)
//  - baseUpdatedAt: `updatedAt` da versão que o cliente editou; se o servidor
//    tiver versão mais nova, a operação volta como "conflito" (não aplicada).
//    Omitido → last-write-wins.
export const operacaoSyncSchema = z.object({
  id: z.uuid(),
  tipo: z.enum(TIPOS_SYNC),
  operacao: z.enum(OPERACOES_SYNC),
  entidadeId: z.uuid(),
  coloniaId: z.uuid().optional(), // obrigatório para tipo "avaliacao"
  dados: z.record(z.string(), z.unknown()).default({}),
  baseUpdatedAt: z.string().datetime().optional(),
  criadoEm: z.string().datetime(),
});

export const loteSyncSchema = z.object({
  operacoes: z.array(operacaoSyncSchema).min(1).max(500),
});

export const alteracoesSyncSchema = z.object({
  desde: z.coerce.date().optional(),
});

export type OperacaoSync = z.infer<typeof operacaoSyncSchema>;

export type StatusSync = "aplicado" | "duplicado" | "conflito" | "erro";

export interface ResultadoSync {
  id: string;
  status: StatusSync;
  entidadeId: string;
  erro?: string;
  servidor?: unknown; // versão atual no servidor, em caso de conflito
}
