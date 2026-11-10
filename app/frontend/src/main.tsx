import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { opcoesConsulta } from "./services/api/opcoesConsulta";
import { router } from "./router";
import { aplicarTema } from "./store/preferencias";
import { useSincronizacao } from "./store/sincronizacao";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: opcoesConsulta });

// Uma sincronização que enviou ou trouxe dados: as telas relêem (da API, se a
// fila esvaziou, ou da cópia local atualizada).
useSincronizacao.subscribe((atual, anterior) => {
  if (atual.concluidas !== anterior.concluidas) void queryClient.invalidateQueries();
});

aplicarTema();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
