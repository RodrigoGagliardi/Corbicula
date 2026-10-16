import { Construction, type LucideIcon } from "lucide-react";
import { CabecalhoPagina, Cartao } from "../components/ui/Cartao";

export interface TelaPlanejada {
  titulo: string;
  descricao: string;
  previsto: string[]; // o que a tela vai mostrar (docs/telas.md)
  icone?: LucideIcon;
}

// Tela ainda não implementada: a rota já existe na navegação e mostra o que
// está planejado, em vez de um 404.
export function EmConstrucao({ titulo, descricao, previsto, icone: Icone = Construction }: TelaPlanejada) {
  return (
    <>
      <CabecalhoPagina titulo={titulo} subtitulo={descricao} />
      <Cartao className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-primary">
            <Icone className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">Em construção</h2>
            <p className="text-sm text-muted-foreground">Esta tela ainda não foi implementada nesta versão.</p>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">O que está previsto</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-primary">
            {previsto.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Cartao>
    </>
  );
}
