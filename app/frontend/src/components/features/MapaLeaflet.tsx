import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { CENTRO_PADRAO, CLASSE_MARCADOR, piorStatus, statusMapa, type ColoniaComCoordenadas, type StatusMapa } from "../../utils/mapa";

// Mapa base: OpenStreetMap (gratuito, sem chave). Satélite: Esri World Imagery.
// Ambos exigem atribuição, que o Leaflet mostra no canto do mapa. Os blocos do
// mapa não são guardados para uso offline (política de uso do OSM); sem conexão
// os pontos continuam aparecendo sobre o fundo vazio.
const CAMADAS = {
  mapa: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    opcoes: {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    },
  },
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    opcoes: {
      maxZoom: 19,
      maxNativeZoom: 18,
      attribution: "Imagens &copy; Esri, Maxar, Earthstar Geographics e comunidade de usuários GIS",
    },
  },
} satisfies Record<string, { url: string; opcoes: L.TileLayerOptions }>;

export type Camada = keyof typeof CAMADAS;

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function iconeColonia(status: StatusMapa, selecionada: boolean) {
  const tamanho = selecionada ? 34 : 26;
  return L.divIcon({
    className: "",
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    html: `<span class="block size-full rounded-full shadow-md ${CLASSE_MARCADOR[status]} ${
      selecionada ? "border-[3px] border-black ring-4 ring-accent" : "border-2 border-white"
    }"></span>`,
  });
}

// Meliponário: hexágono amarelo da marca, fora dos grupos. Maior que os
// marcadores de propósito: quando colônias estão no mesmo ponto (caso comum), o
// hexágono aparece como moldura atrás delas em vez de sumir.
const ICONE_MELIPONARIO = L.divIcon({
  className: "",
  iconSize: [50, 50],
  iconAnchor: [25, 25],
  html: `<span class="block size-full bg-black p-[3px] [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]"><span class="block size-full bg-accent [clip-path:polygon(25%_5%,75%_5%,100%_50%,75%_95%,25%_95%,0_50%)]"></span></span>`,
});

interface MarcadorColonia extends L.Marker {
  statusMapa: StatusMapa;
}

interface Props {
  colonias: ColoniaComCoordenadas[];
  meliponario: { nome: string; latitude: number; longitude: number } | null;
  camada: Camada;
  selecionadaId: string | null;
  aoSelecionar: (id: string | null) => void;
}

export function MapaLeaflet({ colonias, meliponario, camada, selecionadaId, aoSelecionar }: Props) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const grupo = useRef<L.MarkerClusterGroup | null>(null);
  const fundo = useRef<L.TileLayer | null>(null);
  const marcadores = useRef(new Map<string, MarcadorColonia>());
  const pontoMeliponario = useRef<L.Marker | null>(null);
  const selecionadaAtual = useRef(selecionadaId);
  const aoSelecionarAtual = useRef(aoSelecionar);
  const [semFundo, setSemFundo] = useState(false);

  useEffect(() => {
    aoSelecionarAtual.current = aoSelecionar;
  });

  // Cria o mapa uma única vez.
  useEffect(() => {
    if (!elemento.current) return;
    // maxZoom explícito: o agrupamento (markercluster) exige o valor já na
    // criação, antes de existir qualquer camada de fundo.
    const m = L.map(elemento.current, { zoomControl: false, center: CENTRO_PADRAO, zoom: 7, maxZoom: 19 });
    L.control.zoom({ position: "topright", zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(m);
    m.attributionControl.setPrefix(false);
    m.on("click", () => aoSelecionarAtual.current(null));
    grupo.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      // Colônias no mesmo ponto (ex.: coordenada do meliponário copiada para
      // todas) se abrem em leque no zoom máximo.
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const filhos = cluster.getAllChildMarkers() as MarcadorColonia[];
        const status = piorStatus(filhos.map((f) => f.statusMapa));
        return L.divIcon({
          className: "",
          iconSize: [38, 38],
          html: `<span class="flex size-full items-center justify-center rounded-full border-2 border-white text-sm font-bold shadow-md ${CLASSE_MARCADOR[status]}">${filhos.length}</span>`,
        });
      },
    }).addTo(m);
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
      grupo.current = null;
      fundo.current = null;
      pontoMeliponario.current = null;
      marcadores.current.clear();
    };
  }, []);

  // Fundo: mapa ou satélite.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    fundo.current?.remove();
    setSemFundo(false);
    const { url, opcoes } = CAMADAS[camada];
    const t = L.tileLayer(url, opcoes);
    t.on("tileerror", () => setSemFundo(true));
    t.on("load", () => setSemFundo(false));
    t.addTo(m);
    fundo.current = t;
  }, [camada]);

  // Marcadores das colônias e do meliponário; reenquadra quando o conjunto muda.
  const assinatura = colonias.map((c) => `${c.id}:${c.latitude}:${c.longitude}:${statusMapa(c)}`).join("|");
  const assinaturaMeliponario = meliponario ? `${meliponario.latitude}:${meliponario.longitude}:${meliponario.nome}` : "";
  useEffect(() => {
    const m = mapa.current;
    const g = grupo.current;
    if (!m || !g) return;
    g.clearLayers();
    marcadores.current.clear();
    for (const c of colonias) {
      const status = statusMapa(c);
      const marcador = L.marker([c.latitude, c.longitude], {
        icon: iconeColonia(status, c.id === selecionadaAtual.current),
        title: c.codigo,
        alt: c.codigo,
        riseOnHover: true,
      }) as MarcadorColonia;
      marcador.statusMapa = status;
      marcador.on("click", () => aoSelecionarAtual.current(c.id));
      marcadores.current.set(c.id, marcador);
    }
    g.addLayers([...marcadores.current.values()]);

    pontoMeliponario.current?.remove();
    pontoMeliponario.current = meliponario
      ? L.marker([meliponario.latitude, meliponario.longitude], {
          icon: ICONE_MELIPONARIO,
          title: `Meliponário: ${meliponario.nome}`,
          alt: "Meliponário",
          zIndexOffset: -1000,
        })
          .bindTooltip(`Meliponário: ${escapar(meliponario.nome)}`)
          .addTo(m)
      : null;

    const pontos: L.LatLngExpression[] = colonias.map((c) => [c.latitude, c.longitude]);
    if (meliponario) pontos.push([meliponario.latitude, meliponario.longitude]);
    if (pontos.length === 1) m.setView(pontos[0]!, 17);
    else if (pontos.length > 1) m.fitBounds(L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 18 });

    const sel = selecionadaAtual.current && marcadores.current.get(selecionadaAtual.current);
    if (sel) g.zoomToShowLayer(sel);
    // As assinaturas resumem colonias e meliponario: o mapa só é refeito
    // quando um ponto muda, não a cada nova referência do array.
  }, [assinatura, assinaturaMeliponario]);

  // Destaque da colônia selecionada (sem reenquadrar o mapa).
  useEffect(() => {
    const anterior = selecionadaAtual.current;
    selecionadaAtual.current = selecionadaId;
    for (const id of [anterior, selecionadaId]) {
      const marcador = id && marcadores.current.get(id);
      if (marcador) marcador.setIcon(iconeColonia(marcador.statusMapa, id === selecionadaId));
    }
    const sel = selecionadaId && marcadores.current.get(selecionadaId);
    if (sel && grupo.current && !mapa.current?.getBounds().contains(sel.getLatLng())) grupo.current.zoomToShowLayer(sel);
  }, [selecionadaId]);

  return (
    <div className="relative isolate size-full">
      <div ref={elemento} className="size-full bg-muted" role="region" aria-label="Mapa das colônias" />
      {semFundo && (
        <p className="pointer-events-none absolute top-3 left-3 z-[1000] max-w-[70%] rounded-lg bg-card/95 px-3 py-1.5 text-xs text-foreground shadow">
          O mapa de fundo não carregou (sem conexão?). Os pontos das colônias continuam corretos.
        </p>
      )}
    </div>
  );
}
