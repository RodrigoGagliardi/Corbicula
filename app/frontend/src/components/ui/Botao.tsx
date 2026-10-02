import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { Loader2 } from "lucide-react";

type Variante = "primario" | "secundario" | "fantasma" | "perigo";
type Tamanho = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mel-600 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-mel-700 text-white hover:bg-mel-800 active:bg-mel-900",
  secundario: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100",
  fantasma: "text-stone-700 hover:bg-stone-100",
  perigo: "bg-red-600 text-white hover:bg-red-700",
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
