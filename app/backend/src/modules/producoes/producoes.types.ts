import { z } from "zod";

export const TIPOS_PRODUTO = ["mel", "polen", "propolis", "cera"] as const;
export const UNIDADES = ["ml", "g"] as const;

export const caracteristicasSchema = z.object({
  cor: z.string().max(100).optional(),
  aroma: z.string().max(100).optional(),
  sabor: z.string().max(100).optional(),
});

export const criarProducaoSchema = z.object({
  // Opcional: UUID gerado no cliente para registros criados offline (ver /sync).
  id: z.uuid().optional(),
  coloniaId: z.uuid("ID de colônia inválido"),
  dataColheita: z.string().datetime({ message: "Data inválida (use formato ISO 8601)" }),
  tipoProduto: z.enum(TIPOS_PRODUTO, {
    message: "Tipo de produto deve ser: mel, polen, propolis ou cera",
  }),
  quantidade: z.number().positive("Quantidade deve ser maior que zero"),
  unidade: z.enum(UNIDADES, { message: "Unidade deve ser: ml ou g" }),
  caracteristicas: caracteristicasSchema.nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
});

// A colônia de uma colheita não muda — para corrigir, exclua e registre de novo.
export const atualizarProducaoSchema = z.object({
  dataColheita: z.string().datetime().optional(),
  tipoProduto: z.enum(TIPOS_PRODUTO).optional(),
  quantidade: z.number().positive().optional(),
  unidade: z.enum(UNIDADES).optional(),
  caracteristicas: caracteristicasSchema.nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
});

export const filtrosProducaoSchema = z.object({
  coloniaId: z.uuid().optional(),
  tipoProduto: z.enum(TIPOS_PRODUTO).optional(),
  desde: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

export type Caracteristicas = z.infer<typeof caracteristicasSchema>;
export type CriarProducaoInput = z.infer<typeof criarProducaoSchema>;
export type AtualizarProducaoInput = z.infer<typeof atualizarProducaoSchema>;
export type FiltrosProducao = z.infer<typeof filtrosProducaoSchema>;
