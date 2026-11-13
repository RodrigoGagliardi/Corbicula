import type { Colonia, StatusAvaliacao, StatusColonia } from "../types/api";
import { correspondeBusca } from "./colonias";

// Lógica do Mapa de Colônias (tela 11) separada do Leaflet, para ser testável.

// Colônia ainda sem avaliação tem cor própria no mapa (cinza).
export type StatusMapa = StatusAvaliacao | "sem";

export type ColoniaComCoordenadas = Colonia & { latitude: number; longitude: number };

export interface FiltrosMapa {
  status: StatusColonia | "todas";
  especie: string; // código Kew, "" = todas, "sem" = sem espécie identificada
  score: StatusMapa | ""; // "" = todos
  busca: string;
}

export const FILTROS_MAPA_PADRAO: FiltrosMapa = { status: "ativa", especie: "", score: "", busca: "" };

const coordenadaValida = (v: number | null, limite: number) => v !== null && Number.isFinite(v) && Math.abs(v) <= limite;

export function temCoordenadas(c: Colonia): c is ColoniaComCoordenadas {
  return coordenadaValida(c.latitude, 90) && coordenadaValida(c.longitude, 180);
}

export const statusMapa = (c: Colonia): StatusMapa => c.ultimaAvaliacao?.statusGeral ?? "sem";

export function filtrarColonias(colonias: Colonia[], f: FiltrosMapa): Colonia[] {
  return colonias.filter(
    (c) =>
      (f.status === "todas" || c.status === f.status) &&
      (f.especie === "" || (f.especie === "sem" ? !c.especie : c.especie?.codigo === f.especie)) &&
      (f.score === "" || statusMapa(c) === f.score) &&
      correspondeBusca(c, f.busca)
  );
}

// Separa as colônias filtradas entre as que vão para o mapa e as que não têm
// coordenadas. Colônias sem coordenadas NÃO são posicionadas no meliponário:
// um ponto inventado no mapa seria um dado espacial falso.
export function separarPorCoordenadas(colonias: Colonia[]) {
  const noMapa: ColoniaComCoordenadas[] = [];
  const semCoordenadas: Colonia[] = [];
  for (const c of colonias) (temCoordenadas(c) ? noMapa : semCoordenadas).push(c);
  return { noMapa, semCoordenadas };
}

// Ordem de gravidade: um grupo de marcadores (cluster) recebe a cor do pior
// status entre as colônias que ele contém, para que um problema não fique
// escondido dentro de um grupo "verde".
const GRAVIDADE: Record<StatusMapa, number> = { critica: 4, atencao: 3, sem: 2, boa: 1, excelente: 0 };

export function piorStatus(status: StatusMapa[]): StatusMapa {
  return status.reduce<StatusMapa>((pior, s) => (GRAVIDADE[s] > GRAVIDADE[pior] ? s : pior), "excelente");
}

// Espécies presentes nas colônias (para o filtro), em ordem alfabética do nome popular.
export function especiesPresentes(colonias: Colonia[]) {
  const mapa = new Map<string, { codigo: string; nomePopular: string }>();
  for (const c of colonias) if (c.especie) mapa.set(c.especie.codigo, c.especie);
  return [...mapa.values()].sort((a, b) => a.nomePopular.localeCompare(b.nomePopular, "pt-BR"));
}

// Classes dos marcadores (cores de status definidas em index.css). Escritas por
// extenso para o Tailwind encontrá-las no código.
export const CLASSE_MARCADOR: Record<StatusMapa, string> = {
  excelente: "bg-excelente text-black",
  boa: "bg-boa text-white",
  atencao: "bg-atencao text-white",
  critica: "bg-critica text-white",
  sem: "bg-muted-foreground text-white",
};

export const ROTULO_STATUS_MAPA: Record<StatusMapa, string> = {
  excelente: "Excelente",
  boa: "Boa",
  atencao: "Atenção",
  critica: "Crítica",
  sem: "Sem avaliação",
};

export const STATUS_MAPA: StatusMapa[] = ["excelente", "boa", "atencao", "critica", "sem"];

// Centro padrão quando não há nenhuma coordenada: Porto Alegre (RS).
export const CENTRO_PADRAO: [number, number] = [-30.0346, -51.2177];
