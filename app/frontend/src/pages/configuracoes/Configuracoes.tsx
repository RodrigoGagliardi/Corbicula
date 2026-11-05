import { ArrowLeft, ChevronRight, Database, RefreshCw, Settings, User, Warehouse, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { CabecalhoPagina } from "../../components/ui/Cartao";

interface ItemConfiguracao {
  rota: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  emConstrucao?: boolean;
}

const ITENS: ItemConfiguracao[] = [
  { rota: "perfil", titulo: "Perfil", descricao: "Nome, e-mail, senha e exclusão da conta.", icone: User },
  {
    rota: "meliponario",
    titulo: "Meliponário",
    descricao: "Endereço, bioma e coordenadas (usadas no clima automático).",
    icone: Warehouse,
  },
  { rota: "preferencias", titulo: "Preferências", descricao: "Tema e frequência de inspeção sugerida.", icone: Settings },
  { rota: "dados", titulo: "Exportar dados", descricao: "CSV e JSON para análise e backup completo.", icone: Database },
  {
    rota: "sync",
    titulo: "Sincronização offline",
    descricao: "Fila de dados registrados sem conexão.",
    icone: RefreshCw,
    emConstrucao: true,
  },
];

export function Configuracoes() {
  return (
    <>
      <CabecalhoPagina titulo="Configurações" subtitulo="Conta, meliponário e preferências." />
      <ul className="grid gap-3 md:grid-cols-2">
        {ITENS.map(({ rota, titulo, descricao, icone: Icone, emConstrucao }) => (
          <li key={rota}>
            <Link
              to={rota}
              className="flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                <Icone className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  {titulo}
                  {emConstrucao && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      em construção
                    </span>
                  )}
                </span>
                <span className="block text-sm text-muted-foreground">{descricao}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function VoltarConfiguracoes() {
  return (
    <Link to="/app/configuracoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden /> Configurações
    </Link>
  );
}
