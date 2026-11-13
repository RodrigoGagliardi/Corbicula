// Vocabulários fechados dos dados de desfecho e contexto (06/11/2026).
// Fonte única para a validação (schemas Zod e services) e para a exportação.
// Os códigos são estáveis (snake_case) e vão para os arquivos exportados; os
// rótulos em pt-BR são os da tela. O dicionário completo está em docs/exportacao.md.
//
// Nenhum item afirma um fato biológico: as listas só organizam o que o
// meliponicultor já anotava em texto.

import type { STATUS_COLONIA } from "../modules/colonias/colonias.types";

type StatusColonia = (typeof STATUS_COLONIA)[number];

// ─── Motivo da mudança de status da colônia (CAP-1) ───────────────────────────
// `classe` separa o desfecho (evento: morte, perda) da saída do manejo
// (censura: venda, doação, união, roubo), como a análise de sobrevivência trata.
// `status` = status novo com que o motivo é compatível (null = qualquer um).

export type ClasseMotivo = "evento" | "censura";

interface MotivoStatus {
  rotulo: string;
  status: StatusColonia | null;
  classe: ClasseMotivo | null;
}

export const MOTIVOS_STATUS = {
  fome_escassez: { rotulo: "Fome / falta de alimento", status: "morta", classe: "evento" },
  frio: { rotulo: "Frio", status: "morta", classe: "evento" },
  pragas_predadores: { rotulo: "Pragas ou predadores (forídeos, formigas...)", status: "morta", classe: "evento" },
  intoxicacao_suspeita: { rotulo: "Intoxicação suspeita (agrotóxico)", status: "morta", classe: "evento" },
  orfandade: { rotulo: "Sem rainha / orfandade", status: "morta", classe: "evento" },
  falha_divisao: { rotulo: "Divisão não vingou", status: "morta", classe: "evento" },
  desconhecida: { rotulo: "Causa desconhecida", status: "morta", classe: "evento" },
  abandono: { rotulo: "A colônia abandonou a caixa", status: "inativa", classe: "evento" },
  roubo_perda: { rotulo: "Roubo ou perda da caixa", status: "inativa", classe: "censura" },
  venda_doacao: { rotulo: "Venda ou doação", status: "inativa", classe: "censura" },
  uniao: { rotulo: "Unida a outra colônia", status: "inativa", classe: "censura" },
  recuperada: { rotulo: "Voltou a ser ativa", status: "ativa", classe: null },
  correcao_registro: { rotulo: "Correção de registro", status: "ativa", classe: null },
  outro: { rotulo: "Outro (texto)", status: null, classe: null },
} as const satisfies Record<string, MotivoStatus>;

export type MotivoStatusCodigo = keyof typeof MOTIVOS_STATUS;
export const CODIGOS_MOTIVO_STATUS = Object.keys(MOTIVOS_STATUS) as [MotivoStatusCodigo, ...MotivoStatusCodigo[]];

// `outro` herda a classe "conforme o status": morte é evento; inativa é tratada
// como saída do manejo (censura), já que a única inativação que é evento
// (abandono) tem código próprio; ativa não tem classe.
const CLASSE_OUTRO: Record<StatusColonia, ClasseMotivo | null> = {
  morta: "evento",
  inativa: "censura",
  ativa: null,
};

// O motivo serve para o status novo? (`outro` vale para qualquer um.)
export function motivoCompativel(motivo: MotivoStatusCodigo, status: StatusColonia): boolean {
  const permitido = MOTIVOS_STATUS[motivo].status;
  return permitido === null || permitido === status;
}

// Classe do motivo (evento/censura) para a exportação; null quando não há
// motivo registrado ou o motivo não tem classe.
export function classeDoMotivo(motivo: string | null, status: string): ClasseMotivo | null {
  if (!motivo || !(motivo in MOTIVOS_STATUS)) return null;
  if (motivo === "outro") return CLASSE_OUTRO[status as StatusColonia] ?? null;
  return MOTIVOS_STATUS[motivo as MotivoStatusCodigo].classe;
}

// ─── Motivo da inspeção (CAP-2) ───────────────────────────────────────────────

export const MOTIVOS_INSPECAO = {
  rotina: "Rotina",
  problema_observado: "Algo chamou atenção",
  retorno_acao: "Retorno após uma ação",
  outro: "Outro (texto)",
} as const;

export type MotivoInspecaoCodigo = keyof typeof MOTIVOS_INSPECAO;
export const CODIGOS_MOTIVO_INSPECAO = Object.keys(MOTIVOS_INSPECAO) as [
  MotivoInspecaoCodigo,
  ...MotivoInspecaoCodigo[],
];

// ─── Motivo de cada ação tomada (CAP-3) ───────────────────────────────────────

export const MOTIVOS_ACAO = {
  preventiva: "Preventiva (calendário, estação, rotina)",
  resposta_problema: "Resposta a um problema observado",
} as const;

export type MotivoAcaoCodigo = keyof typeof MOTIVOS_ACAO;
export const CODIGOS_MOTIVO_ACAO = Object.keys(MOTIVOS_ACAO) as [MotivoAcaoCodigo, ...MotivoAcaoCodigo[]];

// ─── Procedência do clima (CAP-5) ─────────────────────────────────────────────
// Definida pelo sistema; o usuário não escolhe. null = sem clima (ou registro
// anterior a 06/11/2026, quando a procedência não era registrada).

export const FONTES_CLIMA = {
  api_previsao: "Preenchido pela Open-Meteo Forecast",
  api_historico: "Preenchido pela Open-Meteo Archive (ERA5)",
  digitado: "O usuário informou ou alterou algum campo de clima",
} as const;

export type FonteClima = keyof typeof FONTES_CLIMA;
