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

// ─── Templates, importação e exportação ──────────────────────────────────────

// mesclar: acrescenta o que falta e mantém o resto como está.
// substituir: o conjunto passa a ser exatamente o do template/arquivo — os
// parâmetros que não estão nele são DESATIVADOS (nunca excluídos: o histórico
// de avaliações continua íntegro).
export const modoAplicacaoSchema = z.enum(["mesclar", "substituir"], {
  message: 'Modo deve ser "mesclar" ou "substituir"',
});

export const aplicarTemplateSchema = z.object({ modo: modoAplicacaoSchema });

const criteriosSchema = {
  criterioBom: z.string().trim().min(1, "Critério Bom obrigatório"),
  criterioMedio: z.string().trim().min(1, "Critério Médio obrigatório"),
  criterioRuim: z.string().trim().min(1, "Critério Ruim obrigatório"),
};

// Formato do arquivo gerado por GET /parametros/exportar (versão 1).
export const FORMATO_ARQUIVO_PARAMETROS = "corbicula-parametros";

export const arquivoParametrosSchema = z.object({
  formato: z.literal(FORMATO_ARQUIVO_PARAMETROS, {
    message: `Arquivo não é uma exportação de parâmetros do Corbicula (formato "${FORMATO_ARQUIVO_PARAMETROS}")`,
  }),
  versao: z.literal(1, { message: "Versão do arquivo não suportada (esperada: 1)" }),
  parametros: z
    .array(
      z.object({
        nome: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
        ativo: z.boolean().optional(),
        ...criteriosSchema,
        criteriosEspecie: z
          .array(z.object({ especie: z.string().trim().min(1), ...criteriosSchema }))
          .max(50)
          .optional(),
      })
    )
    .min(1, "O arquivo não tem parâmetros")
    .max(100, "No máximo 100 parâmetros por arquivo"),
});

export const importarParametrosSchema = z.object({
  modo: modoAplicacaoSchema,
  dados: arquivoParametrosSchema,
});

export type ModoAplicacao = z.infer<typeof modoAplicacaoSchema>;
export type ItemConjunto = z.infer<typeof arquivoParametrosSchema>["parametros"][number];
