import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Usuario } from "../types/api";

interface EstadoAuth {
  token: string | null;
  usuario: Usuario | null;
  entrar: (token: string, usuario: Usuario) => void;
  atualizarUsuario: (usuario: Usuario) => void;
  sair: () => void;
}

// Sessão persistida no localStorage: o app reabre logado (inclusive offline).
export const useAuth = create<EstadoAuth>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      entrar: (token, usuario) => set({ token, usuario }),
      atualizarUsuario: (usuario) => set({ usuario }),
      sair: () => set({ token: null, usuario: null }),
    }),
    { name: "corbicula-auth" }
  )
);
