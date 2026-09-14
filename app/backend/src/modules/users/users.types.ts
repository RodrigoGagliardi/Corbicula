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
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  bioma: z.string().optional(),
  areaTotal: z.number().positive().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type MeliponarioInput = z.infer<typeof meliponarioSchema>;
