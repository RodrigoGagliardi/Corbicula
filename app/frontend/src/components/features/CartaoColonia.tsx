import { ClipboardCheck } from "lucide-react";
import { Link } from "react-router";
import type { Colonia } from "../../types/api";
import { ROTULO_STATUS_COLONIA, tempoRelativo } from "../../utils/format";
import { Selo } from "../ui/Cartao";
import { BarraScore, SeloScore } from "./SeloScore";

const COR_STATUS_COLONIA = {
  ativa: "bg-green-50 text-green-800",
  inativa: "bg-stone-100 text-stone-600",
  morta: "bg-stone-800 text-white",
} as const;

export function CartaoColonia({ colonia }: { colonia: Colonia }) {
  const ultima = colonia.ultimaAvaliacao;
  return (
    <article className="group relative flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-mono text-base font-semibold text-stone-900">
            {/* link cobre o cartão inteiro; o botão "Avaliar" fica acima dele */}
            <Link to={`/colonias/${colonia.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
              {colonia.codigo}
            </Link>
          </h3>
          <p className="truncate text-sm text-stone-600">
            {colonia.especie ? (
              <>
                {colonia.especie.nomePopular} · <i>{colonia.especie.nomeCientifico}</i>
              </>
            ) : (
              "Espécie não identificada"
            )}
          </p>
        </div>
        <Selo className={COR_STATUS_COLONIA[colonia.status]}>{ROTULO_STATUS_COLONIA[colonia.status]}</Selo>
      </div>

      {ultima ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SeloScore score={ultima.scoreGeral} status={ultima.statusGeral} />
            <span className="text-xs text-stone-500">{tempoRelativo(ultima.dataAvaliacao)}</span>
          </div>
          <BarraScore score={ultima.scoreGeral} status={ultima.statusGeral} />
        </div>
      ) : (
        <p className="text-sm text-stone-500">Ainda sem avaliações</p>
      )}

      {colonia.status === "ativa" && (
        <Link
          to={`/avaliacoes/nova?colonia=${colonia.id}`}
          className="relative z-10 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-sm font-medium text-mel-800 hover:bg-mel-50"
        >
          <ClipboardCheck className="size-4" aria-hidden /> Avaliar
        </Link>
      )}
    </article>
  );
}
