import type { Classificacao } from "../../types/api";
import { ROTULO_CLASSIFICACAO } from "../../utils/score";

const ESTILO: Record<Classificacao, { ativo: string; inativo: string }> = {
  bom: { ativo: "border-excelente bg-excelente text-white", inativo: "border-green-200 text-green-800 hover:bg-green-50" },
  medio: { ativo: "border-atencao bg-atencao text-white", inativo: "border-amber-200 text-amber-800 hover:bg-amber-50" },
  ruim: { ativo: "border-critica bg-critica text-white", inativo: "border-red-200 text-red-800 hover:bg-red-50" },
};

// Três botões grandes (alvo de toque ≥ 48px) — o núcleo da avaliação rápida.
export function SeletorClassificacao({
  valor,
  onChange,
  rotulo,
}: {
  valor: Classificacao | undefined;
  onChange: (c: Classificacao) => void;
  rotulo: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={rotulo}>
      {(["bom", "medio", "ruim"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={valor === c}
          onClick={() => onChange(c)}
          className={`h-14 rounded-xl border-2 text-base font-semibold transition-colors ${
            valor === c ? ESTILO[c].ativo : `bg-white ${ESTILO[c].inativo}`
          }`}
        >
          {ROTULO_CLASSIFICACAO[c]}
        </button>
      ))}
    </div>
  );
}
