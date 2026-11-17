import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { pendenciaDoRegistro } from "../../services/offline/decisoes";

// Aviso no detalhe de um registro cuja mudança parou na fila (conflito ou
// recusa do servidor), com link para decidir na tela de Sincronização.
export function AvisoPendencia({ entidadeId }: { entidadeId: string }) {
  // Começa com "sincronizacao": as invalidações depois de sincronizar e de decidir relêem.
  const { data: op } = useQuery({
    queryKey: ["sincronizacao", "pendencia", entidadeId],
    queryFn: () => pendenciaDoRegistro(entidadeId),
  });
  if (!op) return null;
  const texto =
    op.estado === "conflito"
      ? "Este registro foi alterado aqui e em outro lugar ao mesmo tempo. Escolha qual versão vale."
      : `O servidor recusou uma mudança deste registro: ${op.ultimoErro ?? "motivo não informado"}`;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-foreground" role="status">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <p>
        {texto}{" "}
        <Link to="/app/configuracoes/sync" className="font-medium underline decoration-accent decoration-2 underline-offset-2">
          Resolver pendência
        </Link>
      </p>
    </div>
  );
}

// Nota no formulário aberto por "Editar manualmente".
export function NotaResolvendoPendencia() {
  return (
    <p className="mb-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground" role="status">
      Você está resolvendo uma pendência: ao salvar, estes dados substituem a mudança que ficou parada e são enviados ao
      servidor. Para desistir, volte sem salvar.
    </p>
  );
}
