import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Tema = "claro" | "escuro" | "sistema";

interface EstadoPreferencias {
  tema: Tema;
  sidebarRecolhida: boolean;
  definirTema: (tema: Tema) => void;
  alternarSidebar: () => void;
}

// Preferências de interface deste navegador (não vão para o servidor).
export const usePreferencias = create<EstadoPreferencias>()(
  persist(
    (set) => ({
      tema: "sistema",
      sidebarRecolhida: false,
      definirTema: (tema) => set({ tema }),
      alternarSidebar: () => set((s) => ({ sidebarRecolhida: !s.sidebarRecolhida })),
    }),
    { name: "corbicula-preferencias" }
  )
);

const consultaEscuro = window.matchMedia("(prefers-color-scheme: dark)");

// Aplica a classe .dark no <html> conforme a preferência (e acompanha o
// sistema quando o tema é "sistema"). Chamado uma vez em main.tsx.
export function aplicarTema() {
  const atualizar = () => {
    const { tema } = usePreferencias.getState();
    const escuro = tema === "escuro" || (tema === "sistema" && consultaEscuro.matches);
    document.documentElement.classList.toggle("dark", escuro);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#0b140f" : "#203c2a");
  };
  atualizar();
  usePreferencias.subscribe(atualizar);
  consultaEscuro.addEventListener("change", atualizar);
}
