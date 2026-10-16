import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

export const CLASSE_ENTRADA =
  "block w-full rounded-xl border border-input bg-card px-3 py-2.5 text-base text-foreground " +
  "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 " +
  "disabled:bg-muted md:text-sm";

interface PropsCampo {
  rotulo: string;
  erro?: string | undefined;
  ajuda?: ReactNode;
  obrigatorio?: boolean;
  children: (id: string) => ReactNode;
}

// Rótulo + controle + ajuda/erro, com ids ligados para acessibilidade.
export function Campo({ rotulo, erro, ajuda, obrigatorio, children }: PropsCampo) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {rotulo}
        {obrigatorio && <span className="text-destructive"> *</span>}
      </label>
      {children(id)}
      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : (
        ajuda && <p className="text-sm text-muted-foreground">{ajuda}</p>
      )}
    </div>
  );
}

export function Entrada({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CLASSE_ENTRADA} ${className}`} {...props} />;
}

export function Selecao({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${CLASSE_ENTRADA} ${className}`} {...props} />;
}

export function AreaTexto({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CLASSE_ENTRADA} min-h-24 ${className}`} {...props} />;
}
