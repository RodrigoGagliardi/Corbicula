import type { StatusAvaliacao } from "../../types/api";
import { COR_STATUS, ROTULO_STATUS } from "../../utils/score";

export function SeloScore({ score, status }: { score: number; status: StatusAvaliacao }) {
  const cor = COR_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${cor.fundo} ${cor.texto}`}>
      {score}
      <span className="font-medium">· {ROTULO_STATUS[status]}</span>
    </span>
  );
}

// Barra horizontal 0–100 com a cor da faixa.
export function BarraScore({ score, status }: { score: number; status: StatusAvaliacao }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-stone-100"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label={`Score ${score} de 100`}
    >
      <div className={`h-full rounded-full ${COR_STATUS[status].barra}`} style={{ width: `${score}%` }} />
    </div>
  );
}
