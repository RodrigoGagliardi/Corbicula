import { CloudUpload, TriangleAlert } from "lucide-react";
import { useRegistrosNaFila } from "../../hooks/useRegistrosNaFila";

// Marca de um registro que ainda não chegou ao servidor ("Não enviado") ou cuja
// mudança parou esperando decisão ("Precisa de decisão"). Nada quando está em dia.
export function SeloEnvio({ id, className = "" }: { id: string; className?: string }) {
  const estado = useRegistrosNaFila().get(id);
  if (!estado) return null;
  const parada = estado === "parada";
  const Icone = parada ? TriangleAlert : CloudUpload;
  return (
    <span
      className={`relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        parada ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
      } ${className}`}
      title={parada ? "A mudança parou: decida na tela de Sincronização" : "Salvo neste aparelho; ainda não chegou ao servidor"}
    >
      <Icone className="size-3" aria-hidden />
      {parada ? "Precisa de decisão" : "Não enviado"}
    </span>
  );
}
