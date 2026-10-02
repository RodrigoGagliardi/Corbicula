import type { ReactNode } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { Cadastro } from "./pages/Cadastro";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { NaoEncontrado } from "./pages/NaoEncontrado";
import { Sobre } from "./pages/Sobre";
import { DetalheAvaliacao } from "./pages/avaliacoes/DetalheAvaliacao";
import { NovaAvaliacao } from "./pages/avaliacoes/NovaAvaliacao";
import { DetalheColonia } from "./pages/colonias/DetalheColonia";
import { FormColonia } from "./pages/colonias/FormColonia";
import { ListaColonias } from "./pages/colonias/ListaColonias";
import { FormParametro } from "./pages/parametros/FormParametro";
import { ListaParametros } from "./pages/parametros/ListaParametros";
import { useAuth } from "./store/auth";

function Protegida({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const local = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ de: local.pathname + local.search }} />;
  return children;
}

function SoVisitante({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  return token ? <Navigate to="/dashboard" replace /> : children;
}

function Inicio() {
  const token = useAuth((s) => s.token);
  return <Navigate to={token ? "/dashboard" : "/login"} replace />;
}

export const router = createBrowserRouter([
  { path: "/", element: <Inicio /> },
  { path: "/login", element: <SoVisitante><Login /></SoVisitante> },
  { path: "/cadastro", element: <SoVisitante><Cadastro /></SoVisitante> },
  {
    element: <Protegida><AppLayout /></Protegida>,
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/colonias", element: <ListaColonias /> },
      { path: "/colonias/nova", element: <FormColonia /> },
      { path: "/colonias/:id", element: <DetalheColonia /> },
      { path: "/colonias/:id/editar", element: <FormColonia /> },
      { path: "/avaliacoes/nova", element: <NovaAvaliacao /> },
      { path: "/colonias/:coloniaId/avaliacoes/:id", element: <DetalheAvaliacao /> },
      { path: "/parametros", element: <ListaParametros /> },
      { path: "/parametros/novo", element: <FormParametro /> },
      { path: "/parametros/:id/editar", element: <FormParametro /> },
      { path: "/sobre", element: <Sobre /> },
      { path: "*", element: <NaoEncontrado /> },
    ],
  },
]);
