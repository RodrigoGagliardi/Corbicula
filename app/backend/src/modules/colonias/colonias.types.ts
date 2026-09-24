import { z } from "zod";

export const ORIGENS = ["captura", "compra", "divisao", "resgate"] as const;
export const TIPOS_CAIXA = ["INPA", "PNN", "Schenck", "tronco", "outro"] as const;
export const STATUS_COLONIA = ["ativa", "inativa", "morta"] as const;

export const dimensoesCaixaSchema = z.object({
  altura: z.number().positive().optional(),
  largura: z.number().positive().optional(),
  profundidade: z.number().positive().optional(),
});

export const criarColoniaSchema = z.object({
  // Opcional: UUID gerado no cliente para registros criados offline (ver /sync).
  id: z.uuid().optional(),
  dataEntrada: z.string().datetime({ message: "Data inválida (use formato ISO 8601)" }),
  origem: z.enum(ORIGENS, {
    message: "Origem deve ser: captura, compra, divisao ou resgate",
  }),
  tipoCaixa: z.enum(TIPOS_CAIXA, {
    message: "Tipo de caixa deve ser: INPA, PNN, Schenck, tronco ou outro",
  }),
  dimensoesCaixa: dimensoesCaixaSchema.nullable().optional(),
  localizacao: z.string().max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
  especieId: z.uuid("ID de espécie inválido").nullable().optional(),
  coloniaMaeId: z.uuid("ID de colônia mãe inválido").nullable().optional(),
  status: z.enum(STATUS_COLONIA).default("ativa"),
});

// No PATCH todos os campos são opcionais. Campos nullable permitem ser zerados
// enviando null explicitamente (ex.: remover colônia mãe = { coloniaMaeId: null }).
// `codigo` é somente leitura — gerado automaticamente pelo sistema no momento da criação.
export const atualizarColoniaSchema = z.object({
  dataEntrada: z.string().datetime().optional(),
  origem: z.enum(ORIGENS).optional(),
  tipoCaixa: z.enum(TIPOS_CAIXA).optional(),
  dimensoesCaixa: dimensoesCaixaSchema.nullable().optional(),
  localizacao: z.string().max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
  especieId: z.uuid().nullable().optional(),
  coloniaMaeId: z.uuid().nullable().optional(),
  status: z.enum(STATUS_COLONIA).optional(),
});

export const filtrosColoniaSchema = z.object({
  status: z.enum(STATUS_COLONIA).optional(),
  especieId: z.uuid().optional(),
});

export type DimensoesCaixa = z.infer<typeof dimensoesCaixaSchema>;
export type CriarColoniaInput = z.infer<typeof criarColoniaSchema>;
export type AtualizarColoniaInput = z.infer<typeof atualizarColoniaSchema>;
export type FiltrosColonia = z.infer<typeof filtrosColoniaSchema>;
