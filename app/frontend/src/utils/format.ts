import type { CondicaoClimatica, Origem, StatusColonia, TipoCaixa } from "../types/api";

const DIA_MS = 24 * 60 * 60 * 1000;

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Dias inteiros de calendário entre a data e "agora" (fuso local).
export function diasDesde(iso: string, agora: Date = new Date()): number {
  const inicio = new Date(iso);
  const a = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const b = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((b - a) / DIA_MS);
}

export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const dias = diasDesde(iso, agora);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
  const anos = Math.floor(dias / 365);
  return anos === 1 ? "há 1 ano" : `há ${anos} anos`;
}

// Valor para <input type="datetime-local"> no fuso local (YYYY-MM-DDTHH:mm).
export function paraInputDataHora(data: Date): string {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

// Valor para <input type="date"> no fuso local (YYYY-MM-DD).
export const paraInputData = (data: Date) => paraInputDataHora(data).slice(0, 10);

export const ROTULO_STATUS_COLONIA: Record<StatusColonia, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
  morta: "Morta",
};

export const ROTULO_ORIGEM: Record<Origem, string> = {
  captura: "Captura",
  compra: "Compra",
  divisao: "Divisão",
  resgate: "Resgate",
};

export const ROTULO_CAIXA: Record<TipoCaixa, string> = {
  INPA: "INPA",
  PNN: "PNN",
  Schenck: "Schenck",
  tronco: "Tronco",
  outro: "Outro",
};

export const ROTULO_CLIMA: Record<CondicaoClimatica, string> = {
  ensolarado: "Ensolarado",
  nublado: "Nublado",
  chuvoso: "Chuvoso",
};
