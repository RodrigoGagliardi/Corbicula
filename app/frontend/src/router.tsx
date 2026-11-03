import type { ReactNode } from "react";
import { createBrowserRouter, Navigate, useLocation, useParams } from "react-router";
import { AppLayout } from "./components/layout/AppLayout";
import { LayoutPublico } from "./components/layout/LayoutPublico";
import { Cadastro } from "./pages/Cadastro";
import { Dashboard } from "./pages/Dashboard";
import { EmConstrucao } from "./pages/EmConstrucao";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { NaoEncontrado } from "./pages/NaoEncontrado";
import { RecuperarSenha } from "./pages/RecuperarSenha";
import { Sobre } from "./pages/Sobre";
import { TELAS_PLANEJADAS } from "./pages/telasPlanejadas";
import { DetalheAvaliacao } from "./pages/avaliacoes/DetalheAvaliacao";
import { EditarAvaliacao } from "./pages/avaliacoes/EditarAvaliacao";
import { HistoricoAvaliacoes } from "./pages/avaliacoes/HistoricoAvaliacoes";
import { NovaAvaliacao } from "./pages/avaliacoes/NovaAvaliacao";
import { DetalheColonia } from "./pages/colonias/DetalheColonia";
import { FormColonia } from "./pages/colonias/FormColonia";
import { ListaColonias } from "./pages/colonias/ListaColonias";
import { FormParametro } from "./pages/parametros/FormParametro";
import { ListaParametros } from "./pages/parametros/ListaParametros";
import { FormColheita } from "./pages/producao/FormColheita";
import { HistoricoProducao } from "./pages/producao/HistoricoProducao";
import { RelatorioProducao } from "./pages/producao/RelatorioProducao";
import { useAuth } from "./store/auth";

function Protegida({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const local = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ de: local.pathname + local.search }} />;
  return children;
}

function SoVisitante({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  return token ? <Navigate to="/app" replace /> : children;
}

// Endereços antigos (antes do prefixo /app) continuam funcionando.
function RedirecionarParaApp() {
  const { pathname, search } = useLocation();
  return <Navigate to={`/app${pathname === "/dashboard" ? "" : pathname}${search}`} replace />;
}

function TelaPlanejada({ chave }: { chave: string }) {
  return <EmConstrucao {...TELAS_PLANEJADAS[chave]!} />;
}

function AnaliseColonia() {
  const { id } = useParams();
  return (
    <EmConstrucao
      {...TELAS_PLANEJADAS["analises"]!}
      titulo="Análise individual"
      descricao={`Análise detalhada da colônia ${id ?? ""}.`}
      previsto={["Evolução do score e de cada parâmetro", "Relação com clima e produção", "Estimativas rotuladas como aproximações"]}
    />
  );
}

const telasPlanejadas = Object.keys(TELAS_PLANEJADAS).map((chave) => ({
  path: chave,
  element: <TelaPlanejada chave={chave} />,
}));

export const router = createBrowserRouter([
  {
    element: <LayoutPublico />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/login", element: <SoVisitante><Login /></SoVisitante> },
      { path: "/cadastro", element: <SoVisitante><Cadastro /></SoVisitante> },
      { path: "/recuperar-senha", element: <SoVisitante><RecuperarSenha /></SoVisitante> },
      { path: "/sobre", element: <Sobre /> },
      { path: "*", element: <div className="mx-auto w-full max-w-3xl px-4 py-12"><NaoEncontrado /></div> },
    ],
  },
  {
    path: "/app",
    element: <Protegida><AppLayout /></Protegida>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "colonias", element: <ListaColonias /> },
      { path: "colonias/nova", element: <FormColonia /> },
      { path: "colonias/:id", element: <DetalheColonia /> },
      { path: "colonias/:id/editar", element: <FormColonia /> },
      { path: "colonias/:coloniaId/avaliacoes/:id", element: <DetalheAvaliacao /> },
      { path: "colonias/:coloniaId/avaliacoes/:id/editar", element: <EditarAvaliacao /> },
      { path: "avaliacoes", element: <HistoricoAvaliacoes /> },
      { path: "avaliacoes/nova", element: <NovaAvaliacao /> },
      { path: "parametros", element: <ListaParametros /> },
      { path: "parametros/novo", element: <FormParametro /> },
      { path: "parametros/:id/editar", element: <FormParametro /> },
      { path: "producao", element: <HistoricoProducao /> },
      { path: "producao/nova", element: <FormColheita /> },
      { path: "producao/relatorio", element: <RelatorioProducao /> },
      { path: "producao/:id/editar", element: <FormColheita /> },
      { path: "analises/colonia/:id", element: <AnaliseColonia /> },
      ...telasPlanejadas,
      { path: "*", element: <NaoEncontrado /> },
    ],
  },
  ...["/dashboard", "/colonias/*", "/avaliacoes/*", "/parametros/*"].map((path) => ({ path, element: <RedirecionarParaApp /> })),
]);
