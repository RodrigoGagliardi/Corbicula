import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

export const meliponarioSchema = z.object({
  nome: z.string().min(2, "Nome do meliponário deve ter ao menos 2 caracteres"),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  bioma: z.string().optional(),
  areaTotal: z.number().positive().optional(),
});

export const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, "Informe a senha atual"),
  novaSenha: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres"),
});

// Excluir a conta exige a senha: o token sozinho (ex.: aparelho esquecido logado) não basta.
export const excluirContaSchema = z.object({
  senha: z.string().min(1, "Informe a senha para confirmar"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type MeliponarioInput = z.infer<typeof meliponarioSchema>;
export type AlterarSenhaInput = z.infer<typeof alterarSenhaSchema>;
export type ExcluirContaInput = z.infer<typeof excluirContaSchema>;
