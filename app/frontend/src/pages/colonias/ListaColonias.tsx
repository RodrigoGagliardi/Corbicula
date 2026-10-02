import { Hexagon, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { CartaoColonia } from "../../components/features/CartaoColonia";
import { LinkBotao } from "../../components/ui/Botao";
import { CLASSE_ENTRADA, Selecao } from "../../components/ui/Campo";
import { CabecalhoPagina } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, EstadoVazio } from "../../components/ui/Estados";
import { useColonias } from "../../hooks/useDados";
import type { Colonia, StatusColonia } from "../../types/api";
import { correspondeBusca } from "../../utils/colonias";
import { ROTULO_STATUS_COLONIA } from "../../utils/format";

type Ordem = "codigo" | "score" | "recente" | "antiga";

const ORDENADORES: Record<Ordem, (a: Colonia, b: Colonia) => number> = {
  codigo: (a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }),
  // Sem avaliação vai para o fim em ambos os sentidos.
  score: (a, b) => (b.ultimaAvaliacao?.scoreGeral ?? -1) - (a.ultimaAvaliacao?.scoreGeral ?? -1),
  recente: (a, b) => (b.ultimaAvaliacao?.dataAvaliacao ?? "").localeCompare(a.ultimaAvaliacao?.dataAvaliacao ?? ""),
  antiga: (a, b) =>
    (a.ultimaAvaliacao?.dataAvaliacao ?? "0").localeCompare(b.ultimaAvaliacao?.dataAvaliacao ?? "0"),
};

const FILTROS_STATUS: (StatusColonia | "todas")[] = ["ativa", "inativa", "morta", "todas"];

export function ListaColonias() {
  const { data: colonias, isLoading, error, refetch } = useColonias();
  // Filtros na URL: sobrevivem ao voltar do detalhe e podem ser compartilhados.
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as StatusColonia | "todas" | null) ?? "ativa";
  const ordem = (params.get("ordem") as Ordem | null) ?? "codigo";
  const [busca, setBusca] = useState("");

  const alterarParam = (chave: string, valor: string) =>
    setParams((p) => {
      p.set(chave, valor);
      return p;
    }, { replace: true });

  const visiveis = useMemo(
    () =>
      (colonias ?? [])
        .filter((c) => status === "todas" || c.status === status)
        .filter((c) => correspondeBusca(c, busca))
        .sort(ORDENADORES[ordem]),
    [colonias, status, busca, ordem]
  );

  const acoes = (
    <LinkBotao to="/colonias/nova">
      <Plus className="size-4" aria-hidden /> Nova colônia
    </LinkBotao>
  );

  if (isLoading) return <><CabecalhoPagina titulo="Colônias" acoes={acoes} /><Carregando /></>;
  if (error || !colonias) {
    return <><CabecalhoPagina titulo="Colônias" /><ErroCarregamento erro={error} tentarDeNovo={() => refetch()} /></>;
  }

  if (colonias.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Colônias" />
        <EstadoVazio
          icone={<Hexagon className="size-10" />}
          titulo="Nenhuma colônia cadastrada"
          descricao="O código de cada colônia é gerado automaticamente a partir da espécie (ex.: TETRANGU-001)."
          acao={acoes}
        />
      </>
    );
  }

  return (
    <>
      <CabecalhoPagina titulo="Colônias" subtitulo={`${colonias.length} no total`} acoes={acoes} />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            type="search"
            placeholder="Buscar por código, espécie ou localização"
            aria-label="Buscar colônias"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${CLASSE_ENTRADA} pl-9`}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filtrar por status">
            {FILTROS_STATUS.map((s) => (
              <button
                key={s}
                onClick={() => alterarParam("status", s)}
                aria-pressed={status === s}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  status === s
                    ? "border-mel-700 bg-mel-700 text-white"
                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                }`}
              >
                {s === "todas" ? "Todas" : `${ROTULO_STATUS_COLONIA[s]}s`}
              </button>
            ))}
          </div>
          <Selecao
            aria-label="Ordenar"
            value={ordem}
            onChange={(e) => alterarParam("ordem", e.target.value)}
            className="!w-auto"
          >
            <option value="codigo">Código (A–Z)</option>
            <option value="score">Maior score</option>
            <option value="recente">Avaliadas recentemente</option>
            <option value="antiga">Sem avaliação há mais tempo</option>
          </Selecao>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="py-12 text-center text-stone-500">Nenhuma colônia corresponde aos filtros.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((c) => (
            <CartaoColonia key={c.id} colonia={c} />
          ))}
        </div>
      )}
    </>
  );
}
