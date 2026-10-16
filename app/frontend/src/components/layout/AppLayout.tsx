import { Ellipsis, Info, LogOut, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun, User, Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useOnline } from "../../hooks/useOnline";
import { useAuth } from "../../store/auth";
import { usePreferencias, type Tema } from "../../store/preferencias";
import { Marca } from "./Marca";
import { ACAO_PRINCIPAL, ITENS_BARRA_INFERIOR, ITENS_NAV, type ItemNav } from "./navegacao";

// Layout único e responsivo (breakpoint md = 768px):
//  - desktop: sidebar verde-escura fixa à esquerda, recolhível (64px ↔ 256px)
//  - mobile: barra superior compacta + navegação inferior com ação central e "Mais"
// O conteúdo (<Outlet/>) é o mesmo nos dois casos.
export function AppLayout() {
  return (
    <div className="min-h-dvh md:flex">
      <BarraLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperiorMobile />
        <main className="pb-nav mx-auto w-full max-w-5xl flex-1 animate-fade-in px-4 pt-4 md:px-8 md:pt-8">
          <Outlet />
        </main>
      </div>
      <BarraInferior />
    </div>
  );
}

function IndicadorConexao({ compacto = false, className = "" }: { compacto?: boolean; className?: string }) {
  const online = useOnline();
  const Icone = online ? Wifi : WifiOff;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}
      role="status"
      title={online ? "Conectado" : "Sem conexão — os dados exibidos podem estar desatualizados"}
    >
      <Icone className="size-4 shrink-0" aria-hidden />
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

const TEMAS: { valor: Tema; rotulo: string; icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", icone: Sun },
  { valor: "escuro", rotulo: "Escuro", icone: Moon },
  { valor: "sistema", rotulo: "Sistema", icone: Monitor },
];

function SeletorTema() {
  const { tema, definirTema } = usePreferencias();
  return (
    <div className="flex rounded-lg bg-black/20 p-0.5" role="radiogroup" aria-label="Tema">
      {TEMAS.map(({ valor, rotulo, icone: Icone }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          title={rotulo}
          onClick={() => definirTema(valor)}
          className={`flex flex-1 items-center justify-center rounded-md p-1.5 ${
            tema === valor ? "bg-sidebar-primary text-sidebar-primary-foreground" : "opacity-70 hover:opacity-100"
          }`}
        >
          <Icone className="size-4" aria-hidden />
          <span className="sr-only">{rotulo}</span>
        </button>
      ))}
    </div>
  );
}

const iniciais = (nome?: string) =>
  (nome ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

// Avatar + menu (Perfil, Preferências, tema, Sair) no rodapé da sidebar.
function MenuUsuario({ recolhida }: { recolhida: boolean }) {
  const usuario = useAuth((s) => s.usuario);
  const sair = useSair();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      {aberto && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-56 space-y-1 rounded-xl border border-sidebar-border bg-sidebar p-2 shadow-lg animate-fade-in">
          <Link to="/app/configuracoes/perfil" onClick={() => setAberto(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-sidebar-accent">
            <User className="size-4" aria-hidden /> Perfil
          </Link>
          <Link to="/app/configuracoes/preferencias" onClick={() => setAberto(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-sidebar-accent">
            <Settings className="size-4" aria-hidden /> Preferências
          </Link>
          <Link to="/sobre" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-sidebar-accent">
            <Info className="size-4" aria-hidden /> Sobre o projeto
          </Link>
          <div className="px-2 py-1">
            <SeletorTema />
          </div>
          <button onClick={sair} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-sidebar-accent">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-sidebar-accent"
        title={usuario?.email}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
          {iniciais(usuario?.name)}
        </span>
        {!recolhida && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{usuario?.name}</span>
            <span className="block truncate text-xs opacity-70">{usuario?.email}</span>
          </span>
        )}
      </button>
    </div>
  );
}

const classeItem = (ativo: boolean, recolhida: boolean) =>
  `flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${recolhida ? "justify-center px-0" : "px-3"} ${
    ativo ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
  }`;

function BarraLateral() {
  const usuario = useAuth((s) => s.usuario);
  const { sidebarRecolhida: recolhida, alternarSidebar } = usePreferencias();
  const { icone: IconeAcao } = ACAO_PRINCIPAL;
  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar px-3 py-5 text-sidebar-foreground transition-[width] duration-200 md:flex ${
        recolhida ? "w-16" : "w-64"
      }`}
    >
      <div className={`flex items-center ${recolhida ? "flex-col gap-3" : "justify-between px-1"}`}>
        <Link to="/app" className="min-w-0">
          <Marca compacta={recolhida} claro />
        </Link>
        <button
          type="button"
          onClick={alternarSidebar}
          className="rounded-lg p-1.5 opacity-70 hover:bg-sidebar-accent hover:opacity-100"
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
        >
          {recolhida ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
        </button>
      </div>
      {!recolhida && usuario?.meliponario && <p className="mt-1 truncate px-1 text-xs opacity-70">{usuario.meliponario.nome}</p>}

      <NavLink
        to={ACAO_PRINCIPAL.rota}
        title={recolhida ? "Nova avaliação" : undefined}
        className={`mt-6 flex items-center justify-center gap-2 rounded-xl border-2 border-black bg-sidebar-primary py-2.5 text-sm font-semibold text-sidebar-primary-foreground hover:bg-mel-500 ${
          recolhida ? "px-0" : "px-3"
        }`}
      >
        <IconeAcao className="size-5" aria-hidden />
        {!recolhida && "Nova avaliação"}
      </NavLink>

      <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Principal">
        {ITENS_NAV.map(({ rota, rotulo, icone: Icone, exata }) => (
          <NavLink key={rota} to={rota} end={exata} title={recolhida ? rotulo : undefined} className={({ isActive }) => classeItem(isActive, recolhida)}>
            <Icone className="size-5 shrink-0" aria-hidden />
            {!recolhida && rotulo}
          </NavLink>
        ))}
      </nav>

      <div className="mt-3 space-y-2 border-t border-sidebar-border pt-3">
        <IndicadorConexao compacto={recolhida} className={`px-2 opacity-80 ${recolhida ? "w-full justify-center" : ""}`} />
        <MenuUsuario recolhida={recolhida} />
      </div>
    </aside>
  );
}

function BarraSuperiorMobile() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-sidebar px-4 py-2.5 text-sidebar-foreground md:hidden">
      <Link to="/app">
        <Marca claro />
      </Link>
      <IndicadorConexao compacto className="opacity-80" />
    </header>
  );
}

const classeAba = (ativo: boolean) =>
  `flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${ativo ? "font-semibold text-primary" : "text-muted-foreground"}`;

function Aba({ item }: { item: ItemNav | undefined }) {
  if (!item) return null;
  const { rota, rotulo, icone: Icone, exata } = item;
  return (
    <NavLink to={rota} end={exata} className={({ isActive }) => classeAba(isActive)}>
      <Icone className="size-6" aria-hidden />
      {rotulo}
    </NavLink>
  );
}

function BarraInferior() {
  const [maisAberto, setMaisAberto] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMaisAberto(false), [pathname]);

  const fixos = ITENS_NAV.filter((i) => ITENS_BARRA_INFERIOR.includes(i.rota));
  const restantes = ITENS_NAV.filter((i) => !ITENS_BARRA_INFERIOR.includes(i.rota));
  const restanteAtivo = restantes.some((i) => pathname.startsWith(i.rota));
  const [inicio, colonias, producao] = fixos;
  const { icone: IconeAcao } = ACAO_PRINCIPAL;

  return (
    <>
      {maisAberto && <MenuMais itens={restantes} fechar={() => setMaisAberto(false)} />}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Principal"
      >
        <ul className="grid grid-cols-5">
          <li>
            <Aba item={inicio} />
          </li>
          <li>
            <Aba item={colonias} />
          </li>
          <li>
            <NavLink to={ACAO_PRINCIPAL.rota} className={({ isActive }) => classeAba(isActive)}>
              <span className="-mt-6 flex size-12 items-center justify-center rounded-2xl border-2 border-black bg-accent text-accent-foreground shadow-md">
                <IconeAcao className="size-6" aria-hidden />
              </span>
              {ACAO_PRINCIPAL.rotulo}
            </NavLink>
          </li>
          <li>
            <Aba item={producao} />
          </li>
          <li>
            <button type="button" onClick={() => setMaisAberto((a) => !a)} aria-expanded={maisAberto} className={classeAba(maisAberto || restanteAtivo)}>
              <Ellipsis className="size-6" aria-hidden />
              Mais
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

// Folha inferior do mobile com o restante da navegação, tema e sair.
function MenuMais({ itens, fechar }: { itens: typeof ITENS_NAV; fechar: () => void }) {
  const sair = useSair();
  const usuario = useAuth((s) => s.usuario);
  return (
    <div className="fixed inset-0 z-10 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fechar" onClick={fechar} />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-sidebar px-4 pt-4 text-sidebar-foreground animate-fade-in"
        style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{usuario?.name}</p>
            {usuario?.meliponario && <p className="truncate text-xs opacity-70">{usuario.meliponario.nome}</p>}
          </div>
          <button type="button" onClick={fechar} className="rounded-lg p-2 hover:bg-sidebar-accent" aria-label="Fechar">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {itens.map(({ rota, rotulo, icone: Icone, exata }) => (
            <li key={rota}>
              <NavLink
                to={rota}
                end={exata}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium ${
                    isActive ? "bg-sidebar-accent text-sidebar-primary" : "hover:bg-sidebar-accent"
                  }`
                }
              >
                <Icone className="size-6" aria-hidden />
                {rotulo}
              </NavLink>
            </li>
          ))}
          <li>
            <Link to="/sobre" className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium hover:bg-sidebar-accent">
              <Info className="size-6" aria-hidden />
              Sobre
            </Link>
          </li>
        </ul>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <SeletorTema />
          </div>
          <button onClick={sair} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
