// Chips de escolha única e opcional (motivos dos vocabulários fechados).
// Um toque marca; tocar de novo no marcado desmarca (nada escolhido = null).
export function SeletorMotivo<C extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
  compacto = false,
}: {
  rotulo: string;
  opcoes: readonly { codigo: C; rotulo: string }[];
  valor: C | null;
  onChange: (codigo: C | null) => void;
  compacto?: boolean;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const marcado = valor === o.codigo;
        return (
          <button
            key={o.codigo}
            type="button"
            aria-pressed={marcado}
            onClick={() => onChange(marcado ? null : o.codigo)}
            className={`rounded-full border text-left font-medium transition-colors ${
              compacto ? "min-h-8 px-2.5 py-1 text-xs" : "min-h-10 px-3 py-1.5 text-sm"
            } ${
              marcado
                ? "border-sidebar bg-sidebar text-sidebar-primary"
                : "border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
