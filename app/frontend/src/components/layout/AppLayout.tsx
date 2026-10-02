import { LogOut, Wifi, WifiOff } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { useOnline } from "../../hooks/useOnline";
import { useAuth } from "../../store/auth";
import { ITENS_NAV } from "./navegacao";

// Layout único e responsivo (breakpoint md = 768px):
//  - desktop: sidebar fixa à esquerda
//  - mobile: barra superior compacta + navegação inferior com ação central
// O conteúdo (<Outlet/>) é o mesmo nos dois casos.
export function AppLayout() {
  return (
    <div className="min-h-dvh md:flex">
      <BarraLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperiorMobile />
        <main className="pb-nav mx-auto w-full max-w-5xl flex-1 px-4 pt-4 md:px-8 md:pt-8">
          <Outlet />
        </main>
      </div>
      <BarraInferior />
    </div>
  );
}

function Marca() {
  return (
    <div className="flex items-center gap-2">
      <img src="/icons/favicon.svg" alt="" className="size-8" />
      <span className="text-lg font-bold tracking-tight text-mel-950">Corbicula</span>
    </div>
  );
}

function IndicadorConexao({ compacto = false }: { compacto?: boolean }) {
  const online = useOnline();
  const Icone = online ? Wifi : WifiOff;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${online ? "text-green-700" : "text-mel-800"}`}
      role="status"
      title={online ? "Conectado" : "Sem conexão — os dados exibidos podem estar desatualizados"}
    >
      <Icone className="size-4" aria-hidden />
      {compacto ? <span className="sr-only">{online ? "Online" : "Offline"}</span> : online ? "Online" : "Offline"}
    </span>
  );
}

function useSair() {
  const sair = useAuth((s) => s.sair);
  const navegar = useNavigate();
  return () => {
    sair();
    navegar("/login", { replace: true });
  };
}

function BarraLateral() {
  const usuario = useAuth((s) => s.usuario);
  const sair = useSair();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-stone-200 bg-white px-4 py-6 md:flex">
      <div className="px-2">
        <Marca />
        {usuario?.meliponario && <p className="mt-1 truncate text-sm text-stone-500">{usuario.meliponario.nome}</p>}
      </div>

      <nav className="mt-8 flex flex-col gap-1" aria-label="Principal">
        {ITENS_NAV.map(({ rota, rotulo, icone: Icone, destaque }) => (
          <NavLink
            key={rota}
            to={rota}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-mel-100 text-mel-900"
                  : destaque
                    ? "text-mel-800 hover:bg-mel-50"
                    : "text-stone-600 hover:bg-stone-100"
              }`
            }
          >
            <Icone className="size-5" aria-hidden />
            {rotulo}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 border-t border-stone-200 px-2 pt-4">
        <IndicadorConexao />
        <p className="truncate text-sm text-stone-700" title={usuario?.email}>
          {usuario?.name}
        </p>
        <button onClick={sair} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800">
          <LogOut className="size-4" aria-hidden /> Sair
        </button>
      </div>
    </aside>
  );
}

function BarraSuperiorMobile() {
  const sair = useSair();
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-2.5 backdrop-blur md:hidden">
      <Marca />
      <div className="flex items-center gap-3">
        <IndicadorConexao compacto />
        <button onClick={sair} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Sair">
          <LogOut className="size-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}

function BarraInferior() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Principal"
    >
      <ul className="grid grid-cols-5">
        {ITENS_NAV.map(({ rota, rotulo, icone: Icone, destaque }) => (
          <li key={rota}>
            <NavLink
              to={rota}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? "text-mel-800" : "text-stone-500"
                }`
              }
            >
              {({ isActive }) =>
                destaque ? (
                  <>
                    <span
                      className={`-mt-6 flex size-12 items-center justify-center rounded-2xl shadow-md ${
                        isActive ? "bg-mel-800" : "bg-mel-700"
                      } text-white`}
                    >
                      <Icone className="size-6" aria-hidden />
                    </span>
                    {rotulo}
                  </>
                ) : (
                  <>
                    <Icone className="size-6" aria-hidden />
                    {rotulo}
                  </>
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
