import type { AvaliacaoLista } from "../../types/api";
import { formatarData } from "../../utils/format";

// Evolução do score (0–100) ao longo das inspeções, em SVG puro.
// Eixo X ordinal (uma posição por avaliação), para leitura simples no celular.
export function GraficoScore({ avaliacoes }: { avaliacoes: AvaliacaoLista[] }) {
  const pontos = [...avaliacoes].sort((a, b) => a.dataAvaliacao.localeCompare(b.dataAvaliacao));
  if (pontos.length < 2) return null;

  const L = 600;
  const A = 160;
  const M = { esq: 28, dir: 8, topo: 8, base: 20 };
  const x = (i: number) => M.esq + (i * (L - M.esq - M.dir)) / (pontos.length - 1);
  const y = (score: number) => M.topo + ((100 - score) * (A - M.topo - M.base)) / 100;
  const caminho = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.scoreGeral).toFixed(1)}`).join(" ");

  return (
    <figure>
      <svg viewBox={`0 0 ${L} ${A}`} className="h-40 w-full" role="img" aria-label="Evolução do score ao longo das avaliações">
        {/* faixas de status: 80 excelente, 60 boa, 40 atenção */}
        {[80, 60, 40].map((v) => (
          <g key={v}>
            <line x1={M.esq} x2={L - M.dir} y1={y(v)} y2={y(v)} stroke="#e7e5e4" strokeDasharray="4 4" />
            <text x={M.esq - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#a8a29e">
              {v}
            </text>
          </g>
        ))}
        <path d={caminho} fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinejoin="round" />
        {pontos.map((p, i) => (
          <circle key={p.id} cx={x(i)} cy={y(p.scoreGeral)} r="4" fill="#b45309">
            <title>{`${formatarData(p.dataAvaliacao)}: ${p.scoreGeral}`}</title>
          </circle>
        ))}
        <text x={M.esq} y={A - 4} fontSize="11" fill="#a8a29e">
          {formatarData(pontos[0]!.dataAvaliacao)}
        </text>
        <text x={L - M.dir} y={A - 4} fontSize="11" fill="#a8a29e" textAnchor="end">
          {formatarData(pontos[pontos.length - 1]!.dataAvaliacao)}
        </text>
      </svg>
    </figure>
  );
}
