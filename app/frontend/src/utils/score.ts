import type { Classificacao, StatusAvaliacao } from "../types/api";

// PRÉVIA do score, exibida enquanto o usuário avalia. O valor oficial é sempre
// o calculado pelo servidor (mesma fórmula, ver docs/exportacao.md):
// round((n_bom × 100 + n_medio × 50 + n_ruim × 0) / n)
export const PONTOS: Record<Classificacao, number> = { bom: 100, medio: 50, ruim: 0 };

export function calcularScore(classificacoes: Classificacao[]): { score: number; status: StatusAvaliacao } | null {
  if (classificacoes.length === 0) return null;
  const soma = classificacoes.reduce((acc, c) => acc + PONTOS[c], 0);
  const score = Math.round(soma / classificacoes.length);
  return { score, status: statusDoScore(score) };
}

export function statusDoScore(score: number): StatusAvaliacao {
  if (score >= 80) return "excelente";
  if (score >= 60) return "boa";
  if (score >= 40) return "atencao";
  return "critica";
}

export const ROTULO_STATUS: Record<StatusAvaliacao, string> = {
  excelente: "Excelente",
  boa: "Boa",
  atencao: "Atenção",
  critica: "Crítica",
};

export const ROTULO_CLASSIFICACAO: Record<Classificacao, string> = {
  bom: "Bom",
  medio: "Médio",
  ruim: "Ruim",
};

// Classes Tailwind por status (cores definidas em index.css).
export const COR_STATUS: Record<StatusAvaliacao, { fundo: string; texto: string; barra: string }> = {
  excelente: { fundo: "bg-green-50", texto: "text-excelente", barra: "bg-excelente" },
  boa: { fundo: "bg-lime-50", texto: "text-boa", barra: "bg-boa" },
  atencao: { fundo: "bg-amber-50", texto: "text-atencao", barra: "bg-atencao" },
  critica: { fundo: "bg-red-50", texto: "text-critica", barra: "bg-critica" },
};
