import { Activity, ChartLine, GitBranch, Sparkles } from "lucide-react";
import type { TelaPlanejada } from "./EmConstrucao";

// Telas do MVP/roadmap que ainda não foram implementadas (ver docs/telas.md).
// Cada uma já tem rota em /app e mostra o que está previsto. Ao implementar
// uma tela, remova a entrada daqui e registre a página real em router.tsx.
export const TELAS_PLANEJADAS: Record<string, TelaPlanejada> = {
  analises: {
    titulo: "Análises",
    descricao: "Hub de análises científicas (Fase 2 — microsserviço Python).",
    icone: ChartLine,
    previsto: ["Análise individual por colônia", "Comparativa entre 2 a 10 colônias", "Correlações entre parâmetros (Pearson/Spearman)", "Genealogia (linhagem materna: mãe → filhas)", "Padrões de inspeção, sazonalidade e predições (estimativas que melhoram com o tempo)"],
  },
  "analises/comparativa": {
    titulo: "Análise comparativa",
    descricao: "Compare a evolução de várias colônias.",
    icone: ChartLine,
    previsto: ["Seleção de 2 a 10 colônias", "Score e parâmetros lado a lado", "Médias, medianas e desvios"],
  },
  "analises/correlacoes": {
    titulo: "Correlações",
    descricao: "Relações entre parâmetros, clima e produção.",
    icone: ChartLine,
    previsto: ["Matriz de correlação de postos (Spearman) entre parâmetros", "Clima × score e produção, sempre ajustados pela estação", "Metodologia e tamanho de amostra sempre visíveis"],
  },
  "analises/genealogia": {
    titulo: "Genealogia",
    descricao: "Árvore da linhagem materna das colônias (o pai é desconhecido).",
    icone: GitBranch,
    previsto: ["Árvore mãe → filhas, com doadoras de campeiras", "Score e status de cada colônia na árvore"],
  },
  "analises/comportamental": {
    titulo: "Análise comportamental",
    descricao: "Quando as inspeções acontecem e como o score varia ao longo do ano.",
    icone: Activity,
    previsto: ["Inspeções por hora do dia e dia da semana (é o horário em que você abre a caixa, não a atividade das abelhas)", "Relação com o clima dos dias anteriores, ajustada pela estação", "Padrões sazonais ao longo do ano"],
  },
  "analises/predicoes": {
    titulo: "Predições",
    descricao: "Modelos de machine learning (Fase 4).",
    icone: Sparkles,
    previsto: [
      "Tendência do score e risco de queda",
      "Detecção de anomalias nas avaliações",
      "Sempre rotuladas como estimativas, com tamanho de amostra e incerteza visíveis",
      "Dependem de uma base histórica grande: melhoram com o tempo de uso",
    ],
  },
};
