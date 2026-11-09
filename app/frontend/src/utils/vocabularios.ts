// Vocabulários fechados dos dados de desfecho e contexto (06/11/2026).
// Fonte única no frontend: mesmos códigos de app/backend/src/shared/vocabularios.ts
// (e do dicionário em docs/exportacao.md). Os rótulos dos motivos são os mesmos
// do backend; os da procedência do clima são rótulos curtos de tela (no backend,
// FONTES_CLIMA traz descrições de quando cada código vale).
// Os códigos são estáveis e vão para a exportação; os rótulos são os da tela.
// Também ficam aqui as funções puras que montam os payloads desses campos.
//
// Nenhum item afirma um fato biológico: as listas só organizam o que o
// meliponicultor já anotava em texto.

import type { StatusColonia } from "../types/api";

// ─── Motivo da mudança de status da colônia (CAP-1) ───────────────────────────
// `status` = status novo com que o motivo é compatível (null = qualquer um).
// `classe` separa evento (morte, perda) de censura (saída do manejo).

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
const CODIGOS_MOTIVO_STATUS = Object.keys(MOTIVOS_STATUS) as MotivoStatusCodigo[];

// O motivo serve para o status novo? (`outro` vale para qualquer um.)
export function motivoCompativel(motivo: MotivoStatusCodigo, status: StatusColonia): boolean {
  const permitido: StatusColonia | null = MOTIVOS_STATUS[motivo].status;
  return permitido === null || permitido === status;
}

// Motivos que aparecem como opção para o status escolhido, `outro` por último.
export function motivosDoStatus(status: StatusColonia): MotivoStatusCodigo[] {
  return CODIGOS_MOTIVO_STATUS.filter((m) => motivoCompativel(m, status));
}

// ─── Motivo da inspeção (CAP-2) ───────────────────────────────────────────────

export const MOTIVOS_INSPECAO = {
  rotina: "Rotina",
  problema_observado: "Algo chamou atenção",
  retorno_acao: "Retorno após uma ação",
  outro: "Outro (texto)",
} as const;

export type MotivoInspecaoCodigo = keyof typeof MOTIVOS_INSPECAO;

// ─── Motivo de cada ação tomada (CAP-3) ───────────────────────────────────────

export const MOTIVOS_ACAO = {
  preventiva: "Preventiva (calendário, estação, rotina)",
  resposta_problema: "Resposta a um problema observado",
} as const;

export type MotivoAcaoCodigo = keyof typeof MOTIVOS_ACAO;

// ─── Procedência do clima (CAP-5) ─────────────────────────────────────────────
// Definida pelo sistema; o usuário não escolhe. null = sem clima (ou registro
// anterior a 06/11/2026, quando a procedência não era registrada).

export const FONTES_CLIMA = {
  api_previsao: "API (previsão)",
  api_historico: "API (histórico ERA5)",
  digitado: "Digitado",
} as const;

export type FonteClima = keyof typeof FONTES_CLIMA;

// Código desconhecido (ex.: vocabulário novo no servidor) aparece como veio.
export const rotuloFonteClima = (fonte: string) => FONTES_CLIMA[fonte as FonteClima] ?? fonte;
export const rotuloMotivoAcao = (motivo: string) => MOTIVOS_ACAO[motivo as MotivoAcaoCodigo] ?? motivo;

// Há algum valor de clima? Decide se o cartão mostra os dados, a procedência e
// o crédito à Open-Meteo (CC BY 4.0). O crédito aparece sempre que houver
// clima, inclusive "digitado": basta um campo editado para virar digitado, e os
// outros podem continuar vindo da API.
export function temClima(a: {
  temperatura?: number | null;
  umidade?: number | null;
  condicaoClimatica?: string | null;
}): boolean {
  return a.temperatura != null || a.umidade != null || a.condicaoClimatica != null;
}

// Rótulo de um motivo com texto livre: com `outro`, o texto digitado (se houver).
export function rotuloComDetalhe(rotulo: string | undefined, codigo: string | null | undefined, detalhe: string | null | undefined): string | null {
  if (!codigo) return null;
  if (codigo === "outro") return detalhe?.trim() ? `Outro: ${detalhe.trim()}` : "Outro";
  return rotulo ?? codigo;
}

export const rotuloMotivoStatus = (codigo: string | null | undefined, detalhe?: string | null) =>
  rotuloComDetalhe(codigo ? MOTIVOS_STATUS[codigo as MotivoStatusCodigo]?.rotulo : undefined, codigo, detalhe);

export const rotuloMotivoInspecao = (codigo: string | null | undefined, detalhe?: string | null) =>
  rotuloComDetalhe(codigo ? MOTIVOS_INSPECAO[codigo as MotivoInspecaoCodigo] : undefined, codigo, detalhe);

// ─── Payloads ─────────────────────────────────────────────────────────────────

const textoOuNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

// Motivos das ações: só os das ações marcadas; nenhum = null (nada registrado).
export function montarMotivosAcoes(
  acoes: readonly string[],
  motivos: Readonly<Record<string, MotivoAcaoCodigo | undefined>>
): Record<string, MotivoAcaoCodigo> | null {
  const resultado: Record<string, MotivoAcaoCodigo> = {};
  for (const acao of acoes) {
    const motivo = motivos[acao];
    if (motivo) resultado[acao] = motivo;
  }
  return Object.keys(resultado).length > 0 ? resultado : null;
}

export interface ContextoAvaliacao {
  motivoInspecao: MotivoInspecaoCodigo | null;
  motivoInspecaoDetalhe: string;
  acoes: readonly string[];
  motivosAcoes: Readonly<Record<string, MotivoAcaoCodigo | undefined>>;
}

export interface PayloadContextoAvaliacao {
  motivoInspecao?: MotivoInspecaoCodigo | null;
  motivoInspecaoDetalhe?: string | null;
  motivosAcoes?: Record<string, MotivoAcaoCodigo> | null;
}

// Campos de contexto da avaliação para o payload. Sem nada marcado, não sai
// nenhuma chave (o payload é o de antes destes campos). Na edição (`original`),
// um valor que existia e foi desmarcado vai como null, para ser apagado.
// O texto livre só vai com o motivo `outro`.
export function payloadContextoAvaliacao(
  contexto: ContextoAvaliacao,
  original?: {
    motivoInspecao?: string | null;
    motivoInspecaoDetalhe?: string | null;
    motivosAcoes?: Record<string, string> | null;
  }
): PayloadContextoAvaliacao {
  const motivoInspecao = contexto.motivoInspecao;
  const detalhe = motivoInspecao === "outro" ? textoOuNull(contexto.motivoInspecaoDetalhe) : null;
  const motivosAcoes = montarMotivosAcoes(contexto.acoes, contexto.motivosAcoes);
  return {
    ...((motivoInspecao !== null || original?.motivoInspecao) && { motivoInspecao }),
    ...((detalhe !== null || original?.motivoInspecaoDetalhe) && { motivoInspecaoDetalhe: detalhe }),
    ...((motivosAcoes !== null || original?.motivosAcoes) && { motivosAcoes }),
  };
}

// ─── Mudança de status da colônia (formulário de edição) ─────────────────────

export interface StatusOriginal {
  status: StatusColonia;
  statusDesde?: string | null;
  motivoStatus?: string | null;
  motivoStatusDetalhe?: string | null;
}

export interface EstadoStatus {
  status: StatusColonia;
  // Data em que o usuário percebeu (YYYY-MM-DD, fuso local).
  desde: string;
  motivo: MotivoStatusCodigo | null;
  detalhe: string;
  // Com o status igual ao salvo: o usuário abriu a correção de data/motivo.
  corrigindo: boolean;
  // O usuário mexeu no campo de data (na correção, a data vai mesmo igual à
  // sugerida: numa colônia sem data salva, confirmar "hoje" é um dado).
  desdeTocado?: boolean;
}

export interface PayloadStatus {
  status?: StatusColonia;
  statusDesde?: string;
  motivoStatus?: MotivoStatusCodigo | null;
  motivoStatusDetalhe?: string | null;
}

// YYYY-MM-DD local de um instante ISO.
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

// Dia escolhido → instante ISO, ao meio-dia local, que não muda de dia ao
// converter para UTC. Hoje = o menor entre agora e o meio-dia: antes do
// meio-dia, ele ainda está no futuro (o servidor recusa data futura); à noite,
// "agora" já pode ser o dia seguinte em UTC (depois das 21h em UTC−3).
export function instanteDoDia(dia: string, agora: Date = new Date()): string {
  const meioDia = new Date(`${dia}T12:00:00`);
  const hoje = diaLocal(agora.toISOString());
  return (dia === hoje && agora < meioDia ? agora : meioDia).toISOString();
}

// Valores iniciais dos campos de status: data de hoje e sem motivo; numa
// correção (status igual), começam com os já salvos.
export function estadoStatusInicial(original: StatusOriginal | undefined, agora: Date = new Date()): EstadoStatus {
  return {
    status: original?.status ?? "ativa",
    desde: original?.statusDesde ? diaLocal(original.statusDesde) : diaLocal(agora.toISOString()),
    motivo: (original?.motivoStatus as MotivoStatusCodigo | null | undefined) ?? null,
    detalhe: original?.motivoStatusDetalhe ?? "",
    corrigindo: false,
  };
}

// Data mínima da mudança de status (YYYY-MM-DD): a entrada da colônia e, numa
// mudança (não numa correção), também a data do status atual, para o histórico
// não ficar fora de ordem. `origem` diz qual das duas vale, para a mensagem.
export function dataMinimaStatus(
  dataEntrada: string,
  original: StatusOriginal | undefined,
  mudou: boolean
): { dia: string; origem: "entrada" | "status" } {
  const desde = mudou && original?.statusDesde ? diaLocal(original.statusDesde) : "";
  return desde > dataEntrada ? { dia: desde, origem: "status" } : { dia: dataEntrada, origem: "entrada" };
}

// Troca de status no formulário. Status novo: data de hoje e motivo em branco
// (o usuário escolhe entre os compatíveis). De volta ao salvo: os valores salvos.
export function trocarStatus(original: StatusOriginal | undefined, novo: StatusColonia, agora: Date = new Date()): EstadoStatus {
  if (!original || novo === original.status) return { ...estadoStatusInicial(original, agora), status: novo };
  return { status: novo, desde: diaLocal(agora.toISOString()), motivo: null, detalhe: "", corrigindo: false };
}

// Campos de status do PATCH da colônia.
// - Status mudou: status + statusDesde (padrão hoje) + motivo (se escolhido e
//   compatível) e texto (só com `outro`).
// - Status igual: nenhum campo de status, a não ser que o usuário corrija data
//   ou motivo; aí vai só o que mudou em relação ao salvo.
export function payloadStatus(original: StatusOriginal, estado: EstadoStatus, agora: Date = new Date()): PayloadStatus {
  const motivo = estado.motivo && motivoCompativel(estado.motivo, estado.status) ? estado.motivo : null;
  const detalhe = motivo === "outro" ? textoOuNull(estado.detalhe) : null;

  if (estado.status !== original.status) {
    return {
      status: estado.status,
      // Data apagada no campo = o padrão (hoje).
      statusDesde: instanteDoDia(estado.desde || diaLocal(agora.toISOString()), agora),
      ...(motivo !== null && { motivoStatus: motivo }),
      ...(detalhe !== null && { motivoStatusDetalhe: detalhe }),
    };
  }
  if (!estado.corrigindo) return {};

  const inicial = estadoStatusInicial(original, agora);
  const motivoOriginal = original.motivoStatus ?? null;
  const detalheOriginal = original.motivoStatusDetalhe ?? null;
  return {
    // Data apagada numa correção = mantém a salva.
    ...(estado.desde && (estado.desdeTocado || estado.desde !== inicial.desde) && { statusDesde: instanteDoDia(estado.desde, agora) }),
    ...(motivo !== motivoOriginal && { motivoStatus: motivo }),
    ...(detalhe !== detalheOriginal && { motivoStatusDetalhe: detalhe }),
  };
}
