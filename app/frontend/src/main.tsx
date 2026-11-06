import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { opcoesConsulta } from "./services/api/opcoesConsulta";
import { router } from "./router";
import { aplicarTema } from "./store/preferencias";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: opcoesConsulta });

aplicarTema();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
