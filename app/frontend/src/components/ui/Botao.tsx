import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { Loader2 } from "lucide-react";

// primario = verde floresta (ações comuns); destaque = amarelo do logo com borda
// preta (a ação principal da tela, ex.: Nova avaliação).
type Variante = "primario" | "destaque" | "secundario" | "fantasma" | "perigo";
type Tamanho = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
  destaque: "border-2 border-black bg-accent text-accent-foreground hover:bg-mel-500 active:bg-mel-600",
  secundario: "border border-input bg-card text-foreground hover:bg-muted",
  fantasma: "text-foreground hover:bg-muted",
  perigo: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const TAMANHOS: Record<Tamanho, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-14 px-6 text-base", // alvo de toque confortável no campo
};

export function classesBotao(variante: Variante = "primario", tamanho: Tamanho = "md", extra = "") {
  return `${BASE} ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${extra}`;
}

interface PropsBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
}

export function Botao({ variante, tamanho, carregando, disabled, className = "", children, ...resto }: PropsBotao) {
  return (
    <button className={classesBotao(variante, tamanho, className)} disabled={disabled || carregando} {...resto}>
      {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

interface PropsLinkBotao extends LinkProps {
  variante?: Variante;
  tamanho?: Tamanho;
  children: ReactNode;
}

export function LinkBotao({ variante, tamanho, className = "", ...resto }: PropsLinkBotao) {
  return <Link className={classesBotao(variante, tamanho, className as string)} {...resto} />;
}
