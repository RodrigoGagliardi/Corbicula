import { z } from "zod";

export const TIPOS_ALERTA = ["nunca_avaliada", "sem_inspecao", "score_baixo", "queda_score", "parametro_ruim"] as const;
export type TipoAlerta = (typeof TIPOS_ALERTA)[number];
export type Gravidade = "alta" | "media";

// Critérios (metodologia — devolvidos junto com os alertas, para transparência).
// São sugestões de manejo, não regras científicas.
export const DIAS_SEM_INSPECAO_PADRAO = 30;
export const QUEDA_SCORE_MINIMA = 20; // pontos entre a inspeção anterior e a última

export const filtrosAlertasSchema = z.object({
  // Preferência geral do usuário (guardada no navegador); a frequência da
  // colônia, quando definida, tem prioridade.
  diasSemInspecao: z.coerce
    .number()
    .int()
    .min(1, "Mínimo: 1 dia")
    .max(365, "Máximo: 365 dias")
    .default(DIAS_SEM_INSPECAO_PADRAO),
  incluirResolvidos: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

// Chave da ocorrência: "<tipo>:<uuid>" ou "<tipo>:<uuid>:<uuid>".
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const chaveAlertaSchema = z.object({
  chave: z
    .string()
    .regex(new RegExp(`^(${TIPOS_ALERTA.join("|")}):${UUID}(:${UUID})?$`), "Chave de alerta inválida"),
});

export type FiltrosAlertas = z.infer<typeof filtrosAlertasSchema>;

export interface Alerta {
  chave: string;
  tipo: TipoAlerta;
  gravidade: Gravidade;
  titulo: string;
  detalhe: string;
  // Desde quando o alerta vale (ex.: dia em que a inspeção passou a estar atrasada).
  desde: Date;
  colonia: { id: string; codigo: string; especie: { codigo: string; nomePopular: string } | null };
  avaliacao: { id: string; dataAvaliacao: Date; scoreGeral: number; statusGeral: string } | null;
  dados: Record<string, unknown>;
  resolvido: boolean;
  resolvidoEm: Date | null;
}
