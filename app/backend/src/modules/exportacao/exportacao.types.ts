import { z } from "zod";
import { STATUS_COLONIA } from "../colonias/colonias.types";
import { TIPOS_PRODUTO } from "../producoes/producoes.types";

export const FORMATOS = ["csv", "json"] as const;

const formato = z.enum(FORMATOS, { message: "Formato deve ser: csv ou json" }).default("csv");

export const exportarColoniasSchema = z.object({
  formato,
  status: z.enum(STATUS_COLONIA).optional(),
});

export const exportarAvaliacoesSchema = z.object({
  formato,
  coloniaId: z.uuid().optional(),
  desde: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

export const exportarProducoesSchema = z.object({
  formato,
  coloniaId: z.uuid().optional(),
  tipoProduto: z.enum(TIPOS_PRODUTO).optional(),
  desde: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

export type Formato = (typeof FORMATOS)[number];
// Filtros sem o campo `formato` (consumido na rota).
export type ExportarColoniasInput = Omit<z.infer<typeof exportarColoniasSchema>, "formato">;
export type ExportarAvaliacoesInput = Omit<z.infer<typeof exportarAvaliacoesSchema>, "formato">;
export type ExportarProducoesInput = Omit<z.infer<typeof exportarProducoesSchema>, "formato">;
