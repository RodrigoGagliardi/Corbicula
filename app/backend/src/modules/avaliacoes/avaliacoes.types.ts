import { z } from "zod";

export const CLASSIFICACOES = ["bom", "medio", "ruim"] as const;
export const CONDICOES_CLIMATICAS = ["ensolarado", "nublado", "chuvoso"] as const;
export const STATUS_AVALIACAO = ["excelente", "boa", "atencao", "critica"] as const;

const avaliacaoParametroSchema = z.object({
  parametroId: z.uuid(),
  classificacao: z.enum(CLASSIFICACOES, {
    message: "Classificação deve ser: bom, medio ou ruim",
  }),
  valorNumerico: z.number().int().positive().nullable().optional(),
  observacoes: z.string().max(500).nullable().optional(),
});

export const criarAvaliacaoSchema = z.object({
  // Opcional: UUID gerado no cliente para registros criados offline (ver /sync).
  id: z.uuid().optional(),
  dataAvaliacao: z.string().datetime({ message: "Data inválida (use formato ISO 8601)" }),
  duracaoMinutos: z.number().int().positive().nullable().optional(),
  temperatura: z.number().min(-20).max(60).nullable().optional(),
  umidade: z.number().min(0).max(100).nullable().optional(),
  condicaoClimatica: z.enum(CONDICOES_CLIMATICAS).nullable().optional(),
  observacoesGerais: z.string().max(2000).nullable().optional(),
  acoesTomadas: z.array(z.string().min(1)).nullable().optional(),
  parametros: z
    .array(avaliacaoParametroSchema)
    .min(1, "Avalie ao menos um parâmetro")
    .refine(
      (params) => new Set(params.map((p) => p.parametroId)).size === params.length,
      { message: "Cada parâmetro só pode ser avaliado uma vez por avaliação" }
    ),
});

export const atualizarAvaliacaoSchema = z.object({
  dataAvaliacao: z.string().datetime().optional(),
  duracaoMinutos: z.number().int().positive().nullable().optional(),
  temperatura: z.number().min(-20).max(60).nullable().optional(),
  umidade: z.number().min(0).max(100).nullable().optional(),
  condicaoClimatica: z.enum(CONDICOES_CLIMATICAS).nullable().optional(),
  observacoesGerais: z.string().max(2000).nullable().optional(),
  acoesTomadas: z.array(z.string().min(1)).nullable().optional(),
  // Se enviado, substitui todos os parâmetros da avaliação e recalcula o score.
  parametros: z
    .array(avaliacaoParametroSchema)
    .min(1)
    .refine(
      (params) => new Set(params.map((p) => p.parametroId)).size === params.length,
      { message: "Cada parâmetro só pode ser avaliado uma vez por avaliação" }
    )
    .optional(),
});

// Histórico de todas as colônias do usuário (GET /avaliacoes).
// parametroId + classificacao: avaliações em que aquele parâmetro recebeu a classificação.
export const filtrosAvaliacoesSchema = z.object({
  coloniaId: z.uuid().optional(),
  status: z.enum(STATUS_AVALIACAO).optional(),
  parametroId: z.uuid().optional(),
  classificacao: z.enum(CLASSIFICACOES).optional(),
  desde: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

export type FiltrosAvaliacoes = z.infer<typeof filtrosAvaliacoesSchema>;
export type CriarAvaliacaoInput = z.infer<typeof criarAvaliacaoSchema>;
export type AtualizarAvaliacaoInput = z.infer<typeof atualizarAvaliacaoSchema>;
