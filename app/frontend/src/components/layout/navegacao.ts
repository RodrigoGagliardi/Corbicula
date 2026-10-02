import { ClipboardCheck, Hexagon, House, Info, SlidersHorizontal, type LucideIcon } from "lucide-react";

export interface ItemNav {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
  destaque?: boolean; // ação principal (botão central no mobile)
}

// Única fonte dos itens de navegação: sidebar (desktop) e barra inferior (mobile)
// renderizam a mesma lista.
export const ITENS_NAV: ItemNav[] = [
  { rota: "/dashboard", rotulo: "Início", icone: House },
  { rota: "/colonias", rotulo: "Colônias", icone: Hexagon },
  { rota: "/avaliacoes/nova", rotulo: "Avaliar", icone: ClipboardCheck, destaque: true },
  { rota: "/parametros", rotulo: "Parâmetros", icone: SlidersHorizontal },
  { rota: "/sobre", rotulo: "Sobre", icone: Info },
];
