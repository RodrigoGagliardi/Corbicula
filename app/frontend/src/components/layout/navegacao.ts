import {
  Bell,
  CalendarDays,
  ChartLine,
  ClipboardCheck,
  ClipboardList,
  Droplets,
  Hexagon,
  LayoutDashboard,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export interface ItemNav {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
  exata?: boolean; // ativo só na rota exata (não nas filhas)
}

// Única fonte dos itens de navegação: a sidebar (desktop) mostra todos; a
// barra inferior (mobile) mostra os de ITENS_BARRA_INFERIOR + "Mais", que abre
// o restante. Rotas privadas ficam sob /app.
export const ITENS_NAV: ItemNav[] = [
  { rota: "/app", rotulo: "Dashboard", icone: LayoutDashboard, exata: true },
  { rota: "/app/colonias", rotulo: "Colônias", icone: Hexagon },
  { rota: "/app/avaliacoes", rotulo: "Avaliações", icone: ClipboardList, exata: true },
  { rota: "/app/parametros", rotulo: "Parâmetros", icone: SlidersHorizontal },
  { rota: "/app/analises", rotulo: "Análises", icone: ChartLine },
  { rota: "/app/producao", rotulo: "Produção", icone: Droplets },
  { rota: "/app/calendario", rotulo: "Calendário", icone: CalendarDays },
  { rota: "/app/alertas", rotulo: "Alertas", icone: Bell },
  { rota: "/app/configuracoes", rotulo: "Configurações", icone: Settings },
];

// Ação principal: botão amarelo no topo da sidebar e botão central no mobile.
export const ACAO_PRINCIPAL: ItemNav = { rota: "/app/avaliacoes/nova", rotulo: "Avaliar", icone: ClipboardCheck };

// Mobile: Dashboard, Colônias, [Avaliar], Produção, Mais.
export const ITENS_BARRA_INFERIOR = ["/app", "/app/colonias", "/app/producao"];
