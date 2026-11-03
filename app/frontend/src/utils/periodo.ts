// Períodos rápidos usados nos filtros de histórico (produção, avaliações).
export type Periodo = "tudo" | "ano" | "12m" | "6m" | "30d";

export const ROTULO_PERIODO: Record<Periodo, string> = {
  tudo: "Tudo",
  ano: "Este ano",
  "12m": "Últimos 12 meses",
  "6m": "Últimos 6 meses",
  "30d": "Últimos 30 dias",
};

// Início do período (YYYY-MM-DD, fuso local) ou undefined para "tudo".
export function inicioDoPeriodo(periodo: Periodo, hoje: Date = new Date()): string | undefined {
  const d = new Date(hoje);
  if (periodo === "tudo") return undefined;
  if (periodo === "ano") d.setMonth(0, 1);
  else if (periodo === "12m") d.setFullYear(d.getFullYear() - 1);
  else if (periodo === "6m") d.setMonth(d.getMonth() - 6);
  else d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
