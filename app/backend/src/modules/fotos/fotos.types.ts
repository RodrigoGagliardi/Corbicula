import { z } from "zod";

// A compressão acontece no cliente (~200–500 KB). O limite do servidor é folgado
// para não rejeitar fotos de quem enviar sem comprimir, mas evita abusos.
export const TAMANHO_MAX_BYTES = 5 * 1024 * 1024;

// Formatos exibíveis em qualquer navegador. HEIC deve ser convertido no cliente.
export const EXTENSOES_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Campos de texto do multipart. Todas as FKs são opcionais individualmente;
// a regra "pelo menos uma" é validada no service.
export const vinculoFotoSchema = z.object({
  coloniaId: z.uuid().optional(),
  avaliacaoId: z.uuid().optional(),
  avaliacaoParametroId: z.uuid().optional(),
  producaoId: z.uuid().optional(),
  legenda: z.string().max(300).optional(),
});

export const filtrosFotoSchema = z.object({
  coloniaId: z.uuid().optional(),
  avaliacaoId: z.uuid().optional(),
  avaliacaoParametroId: z.uuid().optional(),
  producaoId: z.uuid().optional(),
});

export const atualizarFotoSchema = z.object({
  legenda: z.string().max(300).nullable(),
});

export type VinculoFotoInput = z.infer<typeof vinculoFotoSchema>;
export type FiltrosFoto = z.infer<typeof filtrosFotoSchema>;
export type AtualizarFotoInput = z.infer<typeof atualizarFotoSchema>;

export interface ArquivoFoto {
  buffer: Buffer;
  mimetype: string;
}
