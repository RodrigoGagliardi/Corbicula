import type { ReactNode } from "react";
import { Link } from "react-router";

export function LayoutPublico({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-mel-50 to-stone-50 px-4 py-10">
      <Link to="/" className="mb-8 flex flex-col items-center gap-3">
        <img src="/icons/favicon.svg" alt="" className="size-16" />
        <span className="text-2xl font-bold tracking-tight text-mel-950">Corbicula</span>
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-stone-900">{titulo}</h1>
        <p className="mt-1 mb-6 text-sm text-stone-500">{subtitulo}</p>
        {children}
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-stone-500">
        Coleta e análise de dados de colônias de abelhas sem ferrão do Rio Grande do Sul.{" "}
        <Link to="/sobre" className="underline hover:text-stone-700">
          Sobre o projeto
        </Link>
      </p>
    </div>
  );
}
