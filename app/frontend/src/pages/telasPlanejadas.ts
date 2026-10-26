import {
  Bell,
  CalendarDays,
  ChartLine,
  Database,
  GitBranch,
  LayoutTemplate,
  Map,
  RefreshCw,
  Settings,
  User,
  Warehouse,
} from "lucide-react";
import type { TelaPlanejada } from "./EmConstrucao";

// Telas do MVP/roadmap que ainda não foram implementadas (ver docs/telas.md).
// Cada uma já tem rota em /app e mostra o que está previsto. Ao implementar
// uma tela, remova a entrada daqui e registre a página real em router.tsx.
export const TELAS_PLANEJADAS: Record<string, TelaPlanejada> = {
  "colonias/mapa": {
    titulo: "Mapa de colônias",
    descricao: "Localização das colônias e do meliponário.",
    icone: Map,
    previsto: ["Mapa (Leaflet/OpenStreetMap) com as colônias que têm coordenadas", "Cor do marcador pelo status do último score", "Filtros por espécie e status"],
  },
  "parametros/templates": {
    titulo: "Templates de parâmetros",
    descricao: "Conjuntos de parâmetros prontos para importar.",
    icone: LayoutTemplate,
    previsto: ["Templates por objetivo (manejo, pesquisa, produção)", "Importar e exportar parâmetros"],
  },
  analises: {
    titulo: "Análises",
    descricao: "Hub de análises científicas (Fase 2 — microsserviço Python).",
    icone: ChartLine,
    previsto: ["Análise individual por colônia", "Comparativa entre 2 a 10 colônias", "Correlações entre parâmetros (Pearson/Spearman)", "Genealogia (árvore mãe → filhas)", "Padrões comportamentais e predições (estimativas que melhoram com o tempo)"],
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
    previsto: ["Matriz de correlação (Pearson/Spearman)", "Clima × score e produção", "Metodologia e tamanho de amostra sempre visíveis"],
  },
  "analises/genealogia": {
    titulo: "Genealogia",
    descricao: "Árvore de linhagens das colônias.",
    icone: GitBranch,
    previsto: ["Árvore mãe → filhas, com doadoras de campeiras", "Score e status de cada colônia na árvore"],
  },
  calendario: {
    titulo: "Calendário de inspeções",
    descricao: "Planeje e acompanhe as inspeções.",
    icone: CalendarDays,
    previsto: ["Calendário mensal com inspeções, colheitas e divisões", "Próximas inspeções sugeridas", "Frequência configurável por colônia"],
  },
  alertas: {
    titulo: "Central de alertas",
    descricao: "Avisos que exigem atenção.",
    icone: Bell,
    previsto: ["Colônia sem inspeção há X dias", "Status crítico ou queda súbita de score", "Marcar como resolvido e ir direto à colônia"],
  },
  configuracoes: {
    titulo: "Configurações",
    descricao: "Conta, meliponário e preferências.",
    icone: Settings,
    previsto: ["Perfil", "Dados do meliponário", "Preferências", "Exportar/importar dados", "Sincronização offline"],
  },
  "configuracoes/perfil": {
    titulo: "Perfil",
    descricao: "Seus dados de usuário.",
    icone: User,
    previsto: ["Nome e e-mail", "Tipo de meliponicultor (hobby, comercial, pesquisador)", "Alterar senha", "Excluir conta (LGPD)"],
  },
  "configuracoes/meliponario": {
    titulo: "Dados do meliponário",
    descricao: "Usados como fallback de localização para o clima automático.",
    icone: Warehouse,
    previsto: ["Nome, endereço e bioma", "Coordenadas GPS", "Área total"],
  },
  "configuracoes/preferencias": {
    titulo: "Preferências",
    descricao: "Ajustes da interface.",
    icone: Settings,
    previsto: ["Tema claro/escuro/sistema (já disponível no menu do usuário)", "Unidades e formato de data", "Frequência de inspeção sugerida", "Notificações"],
  },
  "configuracoes/dados": {
    titulo: "Exportar e importar dados",
    descricao: "Portabilidade e backup para uso científico.",
    icone: Database,
    previsto: ["Exportar colônias, avaliações e produção em CSV/JSON (a API já oferece)", "Backup completo em JSON", "Fotos em zip", "Restaurar backup e importar parâmetros"],
  },
  "configuracoes/sync": {
    titulo: "Sincronização offline",
    descricao: "Fila de dados registrados sem conexão.",
    icone: RefreshCw,
    previsto: ["Status e última sincronização", "Fila de pendências e botão “Sincronizar agora”", "Resolução de conflitos"],
  },
};
