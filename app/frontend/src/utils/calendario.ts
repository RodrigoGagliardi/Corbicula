import type { Colonia } from "../types/api";

// Lógica do Calendário de Inspeções (tela 29), separada da tela para ser testável.
// Todas as datas são agrupadas pelo dia LOCAL do navegador (uma inspeção às 22h
// de 30/11 em Brasília é do dia 30, mesmo sendo 01h de 01/12 em UTC).

const DIA_MS = 24 * 60 * 60 * 1000;

// "AAAA-MM-DD" no fuso local.
export function chaveDia(data: Date | string): string {
  const d = typeof data === "string" ? new Date(data) : data;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dataDaChave(chave: string): Date {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(a!, m! - 1, d!);
}

// "AAAA-MM" → { ano, mes (0–11) }; inválido → mês atual.
export function lerMes(valor: string | null, hoje = new Date()): { ano: number; mes: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(valor ?? "");
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { ano: Number(m[1]), mes: Number(m[2]) - 1 };
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() };
}

export const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes + 1).padStart(2, "0")}`;

export function somarMeses(ano: number, mes: number, delta: number) {
  const d = new Date(ano, mes + delta, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

// Grade do mês em semanas de domingo a sábado (inclui os dias das bordas dos
// meses vizinhos para completar as semanas).
export function gradeDoMes(ano: number, mes: number): Date[][] {
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(ano, mes, 1 - primeiro.getDay());
  const semanas: Date[][] = [];
  const cursor = new Date(inicio);
  do {
    const semana: Date[] = [];
    for (let i = 0; i < 7; i++) {
      semana.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    semanas.push(semana);
  } while (cursor.getMonth() === mes);
  return semanas;
}

export interface Sugestao {
  dia: string; // chave do dia
  colonia: Colonia;
  frequencia: number;
  frequenciaDaColonia: boolean;
  // Data em que a inspeção vencia, quando já passou (a sugestão fica em "hoje").
  atrasadaDesde: string | null;
  diasAtraso: number;
}

// Próximas inspeções sugeridas para as colônias ativas, entre `inicio` e `fim`
// (chaves de dia, inclusivas). Base = última inspeção (ou a entrada, se nunca
// foi avaliada) + frequência (da colônia ou a geral). Repete a cada frequência
// até o fim do período. Vencida = aparece em hoje, marcada como atrasada.
// É uma sugestão de manejo, não uma previsão.
export function sugestoesInspecao(
  colonias: Colonia[],
  frequenciaGeral: number,
  inicio: string,
  fim: string,
  hoje = new Date()
): Sugestao[] {
  const chaveHoje = chaveDia(hoje);
  const inicioHoje = dataDaChave(chaveHoje).getTime();
  const sugestoes: Sugestao[] = [];

  for (const c of colonias) {
    if (c.status !== "ativa") continue;
    const frequencia = c.frequenciaInspecaoDias ?? frequenciaGeral;
    const base = dataDaChave(chaveDia(c.ultimaAvaliacao?.dataAvaliacao ?? c.dataEntrada));
    let proxima = new Date(base.getFullYear(), base.getMonth(), base.getDate() + frequencia);
    const comum = { colonia: c, frequencia, frequenciaDaColonia: c.frequenciaInspecaoDias !== null };

    if (proxima.getTime() < inicioHoje) {
      const diasAtraso = Math.round((inicioHoje - proxima.getTime()) / DIA_MS);
      if (chaveHoje >= inicio && chaveHoje <= fim) {
        sugestoes.push({ ...comum, dia: chaveHoje, atrasadaDesde: chaveDia(proxima), diasAtraso });
      }
      // As seguintes contam a partir de hoje (supõe a inspeção feita hoje).
      proxima = new Date(dataDaChave(chaveHoje).getTime());
      proxima.setDate(proxima.getDate() + frequencia);
    }
    for (let guarda = 0; guarda < 400 && chaveDia(proxima) <= fim; guarda++) {
      const dia = chaveDia(proxima);
      if (dia >= inicio) sugestoes.push({ ...comum, dia, atrasadaDesde: null, diasAtraso: 0 });
      proxima.setDate(proxima.getDate() + frequencia);
    }
  }
  return sugestoes;
}

export function agruparPorDia<T>(itens: T[], dia: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const chave = dia(item);
    const lista = mapa.get(chave);
    if (lista) lista.push(item);
    else mapa.set(chave, [item]);
  }
  return mapa;
}

export const somarDias = (chave: string, dias: number) => {
  const d = dataDaChave(chave);
  d.setDate(d.getDate() + dias);
  return chaveDia(d);
};

// Próxima inspeção sugerida de uma colônia ativa (mesma regra do calendário).
// Vencida = hoje, com atrasadaDesde preenchido.
export function proximaInspecao(colonia: Colonia, frequenciaGeral: number, hoje = new Date()): Sugestao | null {
  const inicio = chaveDia(hoje);
  const fim = somarDias(inicio, colonia.frequenciaInspecaoDias ?? frequenciaGeral);
  return sugestoesInspecao([colonia], frequenciaGeral, inicio, fim, hoje)[0] ?? null;
}
