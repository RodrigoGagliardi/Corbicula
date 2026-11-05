import type { Colonia } from "../types/api";
import { diasDesde } from "./format";

// Intervalo padrão a partir do qual uma colônia ativa aparece como "inspeção
// atrasada" no dashboard. É uma sugestão de manejo, não uma regra científica;
// o usuário ajusta em Preferências (tela 33).
export const DIAS_INSPECAO_ATRASADA = 30;

export function precisaAtencao(
  c: Colonia,
  agora = new Date(),
  diasAtrasada = DIAS_INSPECAO_ATRASADA
): { motivo: string } | null {
  if (c.status !== "ativa") return null;
  // Mesmas regras de GET /alertas: a frequência da colônia, quando definida, tem
  // prioridade; colônia nunca avaliada só conta quando a 1ª inspeção atrasa.
  const limite = c.frequenciaInspecaoDias ?? diasAtrasada;
  const ultima = c.ultimaAvaliacao;
  if (!ultima) {
    const dias = diasDesde(c.dataEntrada, agora);
    return dias > limite ? { motivo: `Nunca avaliada (entrou há ${dias} dias)` } : null;
  }
  if (ultima.statusGeral === "critica") return { motivo: `Score crítico (${ultima.scoreGeral})` };
  if (ultima.statusGeral === "atencao") return { motivo: `Score em atenção (${ultima.scoreGeral})` };
  const dias = diasDesde(ultima.dataAvaliacao, agora);
  if (dias > limite) return { motivo: `Sem inspeção há ${dias} dias` };
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
