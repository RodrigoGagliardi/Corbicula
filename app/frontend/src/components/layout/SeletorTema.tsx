import { Monitor, Moon, Sun } from "lucide-react";
import { usePreferencias, type Tema } from "../../store/preferencias";

const TEMAS: { valor: Tema; rotulo: string; icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", icone: Sun },
  { valor: "escuro", rotulo: "Escuro", icone: Moon },
  { valor: "sistema", rotulo: "Sistema", icone: Monitor },
];

// Cores de cada lugar onde o seletor aparece: no menu do app, sobre a sidebar
// verde-escura; no cabeçalho das páginas públicas, sobre o fundo da página.
const ESTILO = {
  sidebar: { grupo: "bg-black/20", ativo: "bg-sidebar-primary text-sidebar-primary-foreground", inativo: "opacity-70 hover:opacity-100" },
  pagina: { grupo: "bg-muted", ativo: "bg-sidebar text-sidebar-primary", inativo: "text-muted-foreground hover:text-foreground" },
} as const;

// Claro, Escuro e Sistema lado a lado. A preferência é deste navegador e vale
// também sem estar logado (store/preferencias.ts).
export function SeletorTema({ variante = "sidebar", className = "" }: { variante?: keyof typeof ESTILO; className?: string }) {
  const { tema, definirTema } = usePreferencias();
  const estilo = ESTILO[variante];
  return (
    <div className={`flex rounded-lg p-0.5 ${estilo.grupo} ${className}`} role="radiogroup" aria-label="Tema">
      {TEMAS.map(({ valor, rotulo, icone: Icone }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          title={rotulo}
          onClick={() => definirTema(valor)}
          className={`flex flex-1 items-center justify-center rounded-md p-1.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
            tema === valor ? estilo.ativo : estilo.inativo
          }`}
        >
          <Icone className="size-4" aria-hidden />
          <span className="sr-only">{rotulo}</span>
        </button>
      ))}
    </div>
  );
}
