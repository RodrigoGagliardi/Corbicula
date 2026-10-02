import type { Colonia } from "../types/api";
import { diasDesde } from "./format";

// Intervalo a partir do qual uma colônia ativa aparece como "inspeção atrasada"
// no dashboard. É uma sugestão de manejo, não uma regra científica — pode virar
// preferência do usuário (tela 33) no futuro.
export const DIAS_INSPECAO_ATRASADA = 30;

export function precisaAtencao(c: Colonia, agora = new Date()): { motivo: string } | null {
  if (c.status !== "ativa") return null;
  const ultima = c.ultimaAvaliacao;
  if (!ultima) return { motivo: "Nunca avaliada" };
  if (ultima.statusGeral === "critica") return { motivo: `Score crítico (${ultima.scoreGeral})` };
  if (ultima.statusGeral === "atencao") return { motivo: `Score em atenção (${ultima.scoreGeral})` };
  const dias = diasDesde(ultima.dataAvaliacao, agora);
  if (dias > DIAS_INSPECAO_ATRASADA) return { motivo: `Sem inspeção há ${dias} dias` };
  return null;
}

// Filtro de texto da lista: código, nome popular, científico ou localização.
export function correspondeBusca(c: Colonia, termo: string): boolean {
  const t = termo
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (!t) return true;
  const alvo = [c.codigo, c.especie?.nomePopular, c.especie?.nomeCientifico, c.localizacao]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return alvo.includes(t);
}
