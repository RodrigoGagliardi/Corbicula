import { Monitor, Moon, Sun } from "lucide-react";
import { usePreferencias, type Tema } from "../../store/preferencias";

// Temas da interface, na ordem em que o botão alterna. Fonte única para o
// menu do app (AppLayout) e o cabeçalho das páginas públicas.
export const TEMAS: { valor: Tema; rotulo: string; icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", icone: Sun },
  { valor: "escuro", rotulo: "Escuro", icone: Moon },
  { valor: "sistema", rotulo: "Sistema", icone: Monitor },
];

// Botão de um ícone que alterna Claro → Escuro → Sistema (páginas públicas,
// onde o cabeçalho não tem espaço para os três). A preferência é deste
// navegador, a mesma do menu do app, e vale também sem estar logado.
export function AlternarTema({ className = "" }: { className?: string }) {
  const { tema, definirTema } = usePreferencias();
  const indice = Math.max(0, TEMAS.findIndex((t) => t.valor === tema));
  const atual = TEMAS[indice]!;
  const proximo = TEMAS[(indice + 1) % TEMAS.length]!;
  const Icone = atual.icone;
  const descricao = `Tema: ${atual.rotulo}. Mudar para ${proximo.rotulo.toLowerCase()}`;
  return (
    <button
      type="button"
      onClick={() => definirTema(proximo.valor)}
      title={descricao}
      aria-label={descricao}
      className={`inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${className}`}
    >
      <Icone className="size-5" aria-hidden />
    </button>
  );
}
