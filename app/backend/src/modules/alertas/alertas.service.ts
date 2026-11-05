import { alertasRepository } from "./alertas.repository";
import {
  DIAS_SEM_INSPECAO_PADRAO,
  QUEDA_SCORE_MINIMA,
  type Alerta,
  type FiltrosAlertas,
  type Gravidade,
} from "./alertas.types";

// Central de Alertas (tela 30). Os alertas são CALCULADOS a partir dos dados já
// registrados — nada é digitado para gerá-los. Só a última inspeção de cada
// colônia ativa conta: um problema antigo já superado por uma inspeção nova não
// gera alerta. Cada alerta tem uma chave que identifica a ocorrência; marcar
// como resolvido guarda a chave (tabela alertas_resolvidos), e o mesmo problema
// numa inspeção futura gera uma chave nova.

const DIA_MS = 24 * 60 * 60 * 1000;
const ORDEM_GRAVIDADE: Record<Gravidade, number> = { alta: 0, media: 1 };

type ColoniaComAvaliacoes = Awaited<ReturnType<typeof alertasRepository.coloniasParaAlertas>>[number];

export function calcularAlertas(
  colonias: ColoniaComAvaliacoes[],
  diasSemInspecao: number,
  agora: Date
): Omit<Alerta, "resolvido" | "resolvidoEm">[] {
  const alertas: Omit<Alerta, "resolvido" | "resolvidoEm">[] = [];

  for (const c of colonias) {
    const colonia = { id: c.id, codigo: c.codigo, especie: c.especie };
    const [ultima, anterior] = c.avaliacoes;
    const limite = c.frequenciaInspecaoDias ?? diasSemInspecao;

    // Nunca avaliada: só vira alerta quando a primeira inspeção já está
    // atrasada (entrada + frequência), a mesma regra do calendário — uma
    // colônia que acabou de entrar não é um problema.
    if (!ultima) {
      const diasDesdeEntrada = Math.floor((agora.getTime() - c.dataEntrada.getTime()) / DIA_MS);
      if (diasDesdeEntrada > limite) {
        alertas.push({
          chave: `nunca_avaliada:${c.id}`,
          tipo: "nunca_avaliada",
          gravidade: diasDesdeEntrada > 2 * limite ? "alta" : "media",
          titulo: "Nunca avaliada",
          detalhe: `Entrou há ${diasDesdeEntrada} dias e ainda não tem inspeção (frequência ${c.frequenciaInspecaoDias ? "desta colônia" : "geral"}: ${limite} dias).`,
          desde: new Date(c.dataEntrada.getTime() + limite * DIA_MS),
          colonia,
          avaliacao: null,
          dados: { diasDesdeEntrada, limite, frequenciaDaColonia: c.frequenciaInspecaoDias !== null },
        });
      }
      continue;
    }

    const avaliacao = {
      id: ultima.id,
      dataAvaliacao: ultima.dataAvaliacao,
      scoreGeral: ultima.scoreGeral,
      statusGeral: ultima.statusGeral,
    };
    const ruins = ultima.parametros
      .map((p) => p.parametro)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
      .map(({ id, nome }) => ({ id, nome }));

    // 1. Inspeção atrasada (frequência da colônia > preferência geral).
    const dias = Math.floor((agora.getTime() - ultima.dataAvaliacao.getTime()) / DIA_MS);
    if (dias > limite) {
      alertas.push({
        chave: `sem_inspecao:${c.id}:${ultima.id}`,
        tipo: "sem_inspecao",
        gravidade: dias > 2 * limite ? "alta" : "media",
        titulo: `Sem inspeção há ${dias} dias`,
        detalhe: `A frequência ${c.frequenciaInspecaoDias ? "desta colônia" : "geral"} é de ${limite} dias.`,
        desde: new Date(ultima.dataAvaliacao.getTime() + limite * DIA_MS),
        colonia,
        avaliacao,
        dados: { dias, limite, frequenciaDaColonia: c.frequenciaInspecaoDias !== null },
      });
    }

    // 2. Score baixo na última inspeção (inclui os parâmetros Ruim).
    if (ultima.statusGeral === "critica" || ultima.statusGeral === "atencao") {
      const critica = ultima.statusGeral === "critica";
      alertas.push({
        chave: `score_baixo:${ultima.id}`,
        tipo: "score_baixo",
        gravidade: critica ? "alta" : "media",
        titulo: `${critica ? "Status crítico" : "Status em atenção"} (score ${ultima.scoreGeral})`,
        detalhe: ruins.length ? `Ruim em: ${ruins.map((p) => p.nome).join(", ")}.` : "Última inspeção abaixo de 60 pontos.",
        desde: ultima.dataAvaliacao,
        colonia,
        avaliacao,
        dados: { parametrosRuins: ruins },
      });
    } else if (ruins.length) {
      // 3. Parâmetro Ruim escondido num score bom (ex.: rainha ausente numa
      //    colônia com reservas e atividade boas).
      alertas.push({
        chave: `parametro_ruim:${ultima.id}`,
        tipo: "parametro_ruim",
        gravidade: "media",
        titulo: ruins.length === 1 ? `Ruim em ${ruins[0]!.nome}` : `${ruins.length} parâmetros ruins`,
        detalhe: `Score ${ultima.scoreGeral}, mas a última inspeção classificou como Ruim: ${ruins.map((p) => p.nome).join(", ")}.`,
        desde: ultima.dataAvaliacao,
        colonia,
        avaliacao,
        dados: { parametrosRuins: ruins },
      });
    }

    // 4. Queda súbita em relação à inspeção anterior.
    if (anterior && anterior.scoreGeral - ultima.scoreGeral >= QUEDA_SCORE_MINIMA) {
      alertas.push({
        chave: `queda_score:${ultima.id}`,
        tipo: "queda_score",
        gravidade: "media",
        titulo: `Score caiu ${anterior.scoreGeral - ultima.scoreGeral} pontos`,
        detalhe: `De ${anterior.scoreGeral} para ${ultima.scoreGeral} entre as duas últimas inspeções.`,
        desde: ultima.dataAvaliacao,
        colonia,
        avaliacao,
        dados: { anterior: anterior.scoreGeral, atual: ultima.scoreGeral, avaliacaoAnteriorId: anterior.id },
      });
    }
  }
  return alertas;
}

export const alertasService = {
  async listar(userId: string, filtros: FiltrosAlertas, agora = new Date()) {
    const [colonias, resolvidos] = await Promise.all([
      alertasRepository.coloniasParaAlertas(userId),
      alertasRepository.resolvidos(userId),
    ]);
    const resolvidoEm = new Map(resolvidos.map((r) => [r.chave, r.resolvidoEm]));

    const todos: Alerta[] = calcularAlertas(colonias, filtros.diasSemInspecao, agora).map((a) => ({
      ...a,
      resolvido: resolvidoEm.has(a.chave),
      resolvidoEm: resolvidoEm.get(a.chave) ?? null,
    }));
    todos.sort(
      (a, b) =>
        Number(a.resolvido) - Number(b.resolvido) ||
        ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] ||
        b.desde.getTime() - a.desde.getTime()
    );

    const abertos = todos.filter((a) => !a.resolvido);
    return {
      alertas: filtros.incluirResolvidos ? todos : abertos,
      totais: {
        abertos: abertos.length,
        alta: abertos.filter((a) => a.gravidade === "alta").length,
        media: abertos.filter((a) => a.gravidade === "media").length,
        resolvidos: todos.length - abertos.length,
      },
      criterios: {
        diasSemInspecao: filtros.diasSemInspecao,
        diasSemInspecaoPadrao: DIAS_SEM_INSPECAO_PADRAO,
        quedaScoreMinima: QUEDA_SCORE_MINIMA,
        descricao:
          "Só a última inspeção de cada colônia ativa é considerada. Inspeção atrasada (ou a primeira inspeção, contando " +
          "da entrada, para colônia nunca avaliada) usa a frequência da colônia " +
          "ou, sem ela, a preferência geral (alta se passar do dobro). Score baixo: status Crítica (alta) ou Atenção (média), " +
          "listando os parâmetros Ruim. Parâmetro Ruim com score Boa/Excelente gera alerta próprio. Queda: " +
          `${QUEDA_SCORE_MINIMA} pontos ou mais em relação à inspeção anterior.`,
      },
    };
  },

  resolver: (userId: string, chave: string) => alertasRepository.resolver(userId, chave),
  reabrir: (userId: string, chave: string) => alertasRepository.reabrir(userId, chave),
};
