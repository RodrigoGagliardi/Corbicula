import { ClipboardCheck, Eye, Hexagon, List, MapPinOff, Plus, Search, X } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { SeloScore } from "../../components/features/SeloScore";
import type { Camada } from "../../components/features/MapaLeaflet";
import { LinkBotao } from "../../components/ui/Botao";
import { CLASSE_ENTRADA, Selecao } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, EstadoVazio } from "../../components/ui/Estados";
import { useColonias, useEu } from "../../hooks/useDados";
import { useAuth } from "../../store/auth";
import type { Colonia, StatusColonia } from "../../types/api";
import { ROTULO_STATUS_COLONIA, tempoRelativo } from "../../utils/format";
import {
  CLASSE_MARCADOR,
  especiesPresentes,
  FILTROS_MAPA_PADRAO,
  filtrarColonias,
  ROTULO_STATUS_MAPA,
  separarPorCoordenadas,
  STATUS_MAPA,
  type FiltrosMapa,
  type StatusMapa,
} from "../../utils/mapa";

// Leaflet só é baixado quando o mapa abre (fica fora do pacote principal).
const MapaLeaflet = lazy(() => import("../../components/features/MapaLeaflet").then((m) => ({ default: m.MapaLeaflet })));

const FILTROS_STATUS: (StatusColonia | "todas")[] = ["ativa", "inativa", "morta", "todas"];

const CLASSE_LINK =
  "font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground";

export function MapaColonias() {
  const { data: colonias, isLoading, error, refetch } = useColonias();
  useEu(); // mantém as coordenadas do meliponário em dia
  const meliponario = useAuth((s) => s.usuario?.meliponario ?? null);

  // Filtros, camada e colônia selecionada ficam na URL: sobrevivem ao voltar do
  // detalhe e o detalhe da colônia pode abrir o mapa já nela (?colonia=<id>).
  const [params, setParams] = useSearchParams();
  const filtros: FiltrosMapa = {
    status: (params.get("status") as FiltrosMapa["status"] | null) ?? FILTROS_MAPA_PADRAO.status,
    especie: params.get("especie") ?? "",
    score: (params.get("score") as StatusMapa | null) ?? "",
    busca: "",
  };
  const camada: Camada = params.get("camada") === "satelite" ? "satelite" : "mapa";
  const selecionadaId = params.get("colonia");
  const [busca, setBusca] = useState("");

  const alterarParam = (chave: string, valor: string | null) =>
    setParams(
      (p) => {
        if (valor) p.set(chave, valor);
        else p.delete(chave);
        return p;
      },
      { replace: true }
    );

  const { noMapa, semCoordenadas } = useMemo(
    () => separarPorCoordenadas(filtrarColonias(colonias ?? [], { ...filtros, busca })),
    [colonias, filtros.status, filtros.especie, filtros.score, busca]
  );
  const especies = useMemo(() => especiesPresentes(colonias ?? []), [colonias]);
  const algumaSemEspecie = (colonias ?? []).some((c) => !c.especie);
  const selecionada = noMapa.find((c) => c.id === selecionadaId) ?? null;

  const pontoMeliponario =
    meliponario && meliponario.latitude !== null && meliponario.longitude !== null
      ? { nome: meliponario.nome, latitude: meliponario.latitude, longitude: meliponario.longitude }
      : null;

  const acoes = (
    <LinkBotao to="/app/colonias" variante="secundario">
      <List className="size-4" aria-hidden /> Ver em lista
    </LinkBotao>
  );

  if (isLoading) return <><CabecalhoPagina titulo="Mapa de colônias" acoes={acoes} /><Carregando /></>;
  if (error || !colonias) {
    return <><CabecalhoPagina titulo="Mapa de colônias" /><ErroCarregamento erro={error} tentarDeNovo={() => refetch()} /></>;
  }
  if (colonias.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Mapa de colônias" />
        <EstadoVazio
          icone={<Hexagon className="size-10" />}
          titulo="Nenhuma colônia cadastrada"
          descricao="Cadastre uma colônia com latitude e longitude para vê-la no mapa."
          acao={<LinkBotao to="/app/colonias/nova"><Plus className="size-4" aria-hidden /> Nova colônia</LinkBotao>}
        />
      </>
    );
  }

  const total = noMapa.length + semCoordenadas.length;

  return (
    <>
      <CabecalhoPagina
        titulo="Mapa de colônias"
        subtitulo={`${noMapa.length} de ${total} ${total === 1 ? "colônia filtrada" : "colônias filtradas"} no mapa`}
        acoes={acoes}
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            placeholder="Buscar por código, espécie ou localização"
            aria-label="Buscar colônias"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${CLASSE_ENTRADA} pl-9`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filtrar por status da colônia">
            {FILTROS_STATUS.map((s) => (
              <button
                key={s}
                onClick={() => alterarParam("status", s)}
                aria-pressed={filtros.status === s}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  filtros.status === s
                    ? "border-sidebar bg-sidebar text-sidebar-primary"
                    : "border-input bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {s === "todas" ? "Todas" : `${ROTULO_STATUS_COLONIA[s]}s`}
              </button>
            ))}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-1 sm:justify-end">
            <Selecao aria-label="Filtrar por espécie" value={filtros.especie} onChange={(e) => alterarParam("especie", e.target.value)} className="min-w-0 sm:!w-auto">
              <option value="">Todas as espécies</option>
              {especies.map((e) => (
                <option key={e.codigo} value={e.codigo}>{e.nomePopular}</option>
              ))}
              {algumaSemEspecie && <option value="sem">Sem espécie identificada</option>}
            </Selecao>
            <Selecao aria-label="Filtrar pelo score da última avaliação" value={filtros.score} onChange={(e) => alterarParam("score", e.target.value)} className="min-w-0 sm:!w-auto">
              <option value="">Qualquer score</option>
              {STATUS_MAPA.map((s) => (
                <option key={s} value={s}>{ROTULO_STATUS_MAPA[s]}</option>
              ))}
            </Selecao>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-2">
          <div className="flex justify-end">
            <div className="inline-flex rounded-xl border border-input bg-card p-1" role="group" aria-label="Fundo do mapa">
              {(["mapa", "satelite"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => alterarParam("camada", c === "mapa" ? null : c)}
                  aria-pressed={camada === c}
                  className={`rounded-lg px-3 py-1 text-sm font-medium ${
                    camada === c ? "bg-sidebar text-sidebar-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {c === "mapa" ? "Mapa" : "Satélite"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[55vh] min-h-80 overflow-hidden rounded-2xl border border-border lg:h-[calc(100dvh-19rem)]">
            <Suspense fallback={<Carregando texto="Carregando mapa…" />}>
              <MapaLeaflet
                colonias={noMapa}
                meliponario={pontoMeliponario}
                camada={camada}
                selecionadaId={selecionada?.id ?? null}
                aoSelecionar={(id) => alterarParam("colonia", id)}
              />
            </Suspense>
          </div>
        </div>

        <aside className="space-y-4">
          {selecionada ? (
            <PainelColonia colonia={selecionada} aoFechar={() => alterarParam("colonia", null)} />
          ) : (
            <p className="rounded-2xl border border-dashed border-input px-4 py-3 text-sm text-muted-foreground">
              Toque em um ponto para ver a colônia. Números indicam grupos de colônias próximas.
            </p>
          )}
          <Legenda />
          <SemCoordenadas colonias={semCoordenadas} meliponarioSemCoordenadas={!pontoMeliponario} />
        </aside>
      </div>
    </>
  );
}

function PainelColonia({ colonia, aoFechar }: { colonia: Colonia; aoFechar: () => void }) {
  const ultima = colonia.ultimaAvaliacao;
  return (
    <Cartao className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/app/colonias/${colonia.id}`} className={`text-lg ${CLASSE_LINK}`}>{colonia.codigo}</Link>
          {colonia.especie ? (
            <p className="text-sm text-foreground">
              {colonia.especie.nomePopular} · <i className="text-muted-foreground">{colonia.especie.nomeCientifico}</i>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Espécie não identificada</p>
          )}
        </div>
        <button onClick={aoFechar} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {ultima ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <SeloScore score={ultima.scoreGeral} status={ultima.statusGeral} />
          <span>{tempoRelativo(ultima.dataAvaliacao)}</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Ainda sem avaliações.</p>
      )}
      {colonia.localizacao && <p className="text-sm text-muted-foreground">{colonia.localizacao}</p>}
      <div className="flex flex-wrap gap-2">
        <LinkBotao to={`/app/colonias/${colonia.id}`} variante="secundario" tamanho="sm">
          <Eye className="size-4" aria-hidden /> Ver detalhes
        </LinkBotao>
        {colonia.status === "ativa" && (
          <LinkBotao to={`/app/avaliacoes/nova?colonia=${colonia.id}`} tamanho="sm">
            <ClipboardCheck className="size-4" aria-hidden /> Avaliar
          </LinkBotao>
        )}
      </div>
    </Cartao>
  );
}

function Legenda() {
  return (
    <Cartao>
      <h2 className="mb-2 text-sm font-semibold text-foreground">Legenda (última avaliação)</h2>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-foreground">
        {STATUS_MAPA.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`size-3.5 shrink-0 rounded-full border border-black/20 ${CLASSE_MARCADOR[s]}`} aria-hidden />
            {ROTULO_STATUS_MAPA[s]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="size-3.5 shrink-0 bg-black p-px [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]" aria-hidden>
            <span className="block size-full bg-accent [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]" />
          </span>
          Meliponário
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Um grupo assume a cor do pior status entre as colônias que contém.</p>
    </Cartao>
  );
}

function SemCoordenadas({ colonias, meliponarioSemCoordenadas }: { colonias: Colonia[]; meliponarioSemCoordenadas: boolean }) {
  if (colonias.length === 0 && !meliponarioSemCoordenadas) return null;
  return (
    <Cartao className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPinOff className="size-4" aria-hidden /> Fora do mapa
      </h2>
      {meliponarioSemCoordenadas && (
        <p className="text-sm text-muted-foreground">
          O meliponário não tem coordenadas.{" "}
          <Link to="/app/configuracoes/meliponario" className={CLASSE_LINK}>Adicionar</Link>
        </p>
      )}
      {colonias.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {colonias.length === 1 ? "1 colônia filtrada não tem" : `${colonias.length} colônias filtradas não têm`} latitude e
            longitude. Elas não são posicionadas no meliponário para não criar um ponto inventado.
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {colonias.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <Link to={`/app/colonias/${c.id}`} className={CLASSE_LINK}>{c.codigo}</Link>
                <Link to={`/app/colonias/${c.id}/editar`} className="text-xs text-muted-foreground hover:text-foreground">
                  Adicionar coordenadas
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Cartao>
  );
}
