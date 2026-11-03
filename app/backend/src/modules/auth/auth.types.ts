import { z } from "zod";

export const registerBodySchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  // Meliponário pode ser criado junto ao registro (1:1 com o usuário).
  // Se omitido, o usuário configura depois em Configurações > Meliponário.
  meliponario: z
    .object({
      nome: z.string().min(2, "Nome do meliponário deve ter ao menos 2 caracteres"),
      cidade: z.string().optional(),
      estado: z.string().optional(),
      bioma: z.string().optional(),
    })
    .optional(),
});

export const loginBodySchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
