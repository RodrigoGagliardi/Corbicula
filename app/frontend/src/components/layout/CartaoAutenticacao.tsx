import type { ReactNode } from "react";

// Cartão centralizado das telas de login, cadastro e recuperação de senha
// (renderizado dentro do LayoutPublico).
export function CartaoAutenticacao({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold text-foreground">{titulo}</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitulo}</p>
        {children}
      </div>
    </div>
  );
}
