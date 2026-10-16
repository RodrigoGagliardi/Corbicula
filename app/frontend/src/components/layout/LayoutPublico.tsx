import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../../store/auth";
import { classesBotao } from "../ui/Botao";
import { Marca } from "./Marca";

// Casca das páginas públicas (landing, login, cadastro, recuperar senha, sobre):
// cabeçalho fixo com a marca e as ações de conta + rodapé.
export function LayoutPublico() {
  const logado = Boolean(useAuth((s) => s.token));
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/">
            <Marca />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Site">
            <NavLink
              to="/sobre"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`
              }
            >
              Sobre
            </NavLink>
            {logado ? (
              <Link to="/app" className={classesBotao("primario", "sm")}>
                Abrir o app
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                  Entrar
                </Link>
                <Link to="/cadastro" className={classesBotao("primario", "sm", "hidden sm:inline-flex")}>
                  Começar agora
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col animate-fade-in">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <Marca />
          <p>© {new Date().getFullYear()} Corbicula · Software livre (Apache 2.0)</p>
        </div>
      </footer>
    </div>
  );
}
