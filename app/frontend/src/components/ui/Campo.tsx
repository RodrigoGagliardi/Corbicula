import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";

export const CLASSE_ENTRADA =
  "block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 " +
  "placeholder:text-stone-400 focus:border-mel-600 focus:outline-none focus:ring-2 focus:ring-mel-200 " +
  "disabled:bg-stone-100 md:text-sm";

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
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {rotulo}
        {obrigatorio && <span className="text-mel-700"> *</span>}
      </label>
      {children(id)}
      {erro ? (
        <p className="text-sm text-red-600" role="alert">
          {erro}
        </p>
      ) : (
        ajuda && <p className="text-sm text-stone-500">{ajuda}</p>
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
