import { z } from "zod";

export const criarParametroSchema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
  ordem: z.number().int().min(0).default(0),
  criterioBom: z.string().min(1, "Critério Bom obrigatório"),
  criterioMedio: z.string().min(1, "Critério Médio obrigatório"),
  criterioRuim: z.string().min(1, "Critério Ruim obrigatório"),
});

export const atualizarParametroSchema = z.object({
  nome: z.string().min(2).max(100).optional(),
  ordem: z.number().int().min(0).optional(),
  criterioBom: z.string().min(1).optional(),
  criterioMedio: z.string().min(1).optional(),
  criterioRuim: z.string().min(1).optional(),
  ativo: z.boolean().optional(),
});

// Critérios específicos por espécie — sobrescreve os critérios genéricos do Parametro
// quando a colônia avaliada tem espécie identificada.
export const criterioEspecieSchema = z.object({
  criterioBom: z.string().min(1, "Critério Bom obrigatório"),
  criterioMedio: z.string().min(1, "Critério Médio obrigatório"),
  criterioRuim: z.string().min(1, "Critério Ruim obrigatório"),
});

// Query params chegam como string; transforma "true"/"false" em boolean.
export const filtrosParametroSchema = z.object({
  ativo: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type CriarParametroInput = z.infer<typeof criarParametroSchema>;
export type AtualizarParametroInput = z.infer<typeof atualizarParametroSchema>;
export type CriterioEspecieInput = z.infer<typeof criterioEspecieSchema>;
export type FiltrosParametro = z.infer<typeof filtrosParametroSchema>;
