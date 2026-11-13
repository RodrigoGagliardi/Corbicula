import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { opcoesConsulta } from "./services/api/opcoesConsulta";
import { observarSessao } from "./services/offline/sessaoSegundoPlano";
import { router } from "./router";
import { aplicarTema } from "./store/preferencias";
import { useAuth } from "./store/auth";
import { resetarSincronizacao, useSincronizacao } from "./store/sincronizacao";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: opcoesConsulta });

// Uma sincronização que enviou ou trouxe dados: as telas relêem (da API, se a
// fila esvaziou, ou da cópia local atualizada).
useSincronizacao.subscribe((atual, anterior) => {
  if (atual.concluidas !== anterior.concluidas) void queryClient.invalidateQueries();
});

// Troca de usuário na sessão (logout, 401, outra conta): nada da conta anterior
// fica no cache das telas nem nos contadores. Os dados locais (IndexedDB) são
// por usuário e só saem no logout (services/offline/sessao.ts).
useAuth.subscribe((atual, anterior) => {
  if (atual.usuario?.id === anterior.usuario?.id) return;
  queryClient.clear();
  resetarSincronizacao();
});

// Cópia da sessão para o Service Worker (Background Sync), que não lê o
// localStorage. Sem sessão (logout, 401), a cópia sai e o SW não sincroniza.
observarSessao();

aplicarTema();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
