import { prisma } from "../config/database";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ClimaResultado {
  temperatura: number;
  umidade: number;
  condicaoClimatica: "ensolarado" | "nublado" | "chuvoso";
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  weather_code: number[];
}

interface OpenMeteoResponse {
  hourly: OpenMeteoHourly;
}

// ─── WMO 4677 → condicaoClimatica ────────────────────────────────────────────
// https://open-meteo.com/en/docs (Weather interpretation codes)

function mapearWMO(code: number): ClimaResultado["condicaoClimatica"] {
  if (code <= 1) return "ensolarado";
  if (
    code <= 3 ||
    (code >= 45 && code <= 48) ||
    (code >= 71 && code <= 77) ||
    code === 85 ||
    code === 86
  )
    return "nublado";
  // drizzle (51-57), rain (61-67), showers (80-82), thunderstorm (95-99)
  return "chuvoso";
}

// ─── Cache em memória ─────────────────────────────────────────────────────────
// Chave: lat (2 casas) + lon (2 casas) + hora UTC. ~1 km de precisão.
// TTL: 1 hora — suficiente para dados de previsão; dados de arquivo nunca mudam.

const _cache = new Map<string, { resultado: ClimaResultado; expiraEm: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function chaveCache(lat: number, lon: number, dataHora: Date): string {
  const hora = dataHora.toISOString().slice(0, 13); // "2024-01-15T10"
  return `${lat.toFixed(2)}_${lon.toFixed(2)}_${hora}`;
}

function lerCache(chave: string): ClimaResultado | null {
  const entrada = _cache.get(chave);
  if (!entrada || entrada.expiraEm < Date.now()) {
    _cache.delete(chave);
    return null;
  }
  return entrada.resultado;
}

function escreverCache(chave: string, resultado: ClimaResultado): void {
  _cache.set(chave, { resultado, expiraEm: Date.now() + CACHE_TTL_MS });
}

// ─── Parsing da resposta ──────────────────────────────────────────────────────

function extrairHora(response: OpenMeteoResponse, dataHora: Date): ClimaResultado | null {
  // Open-Meteo retorna datas no formato "2024-01-15T10:00" (sem timezone quando UTC)
  const prefixoAlvo = dataHora.toISOString().slice(0, 13); // "2024-01-15T10"
  const idx = response.hourly.time.findIndex((t) => t.startsWith(prefixoAlvo));
  if (idx === -1) return null;

  const temp = response.hourly.temperature_2m[idx];
  const umid = response.hourly.relative_humidity_2m[idx];
  const code = response.hourly.weather_code[idx];

  if (temp === undefined || umid === undefined || code === undefined) return null;

  return {
    temperatura: Math.round(temp * 10) / 10,
    umidade: Math.round(umid),
    condicaoClimatica: mapearWMO(code),
  };
}

// ─── Chamadas HTTP ────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 6000;

async function fetchComTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Forecast API: suporta até 92 dias no passado via past_days.
async function buscarPrevisao(lat: number, lon: number, dataHora: Date): Promise<ClimaResultado | null> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: "temperature_2m,relative_humidity_2m,weather_code",
    timezone: "UTC",
    past_days: "5",
    forecast_days: "1",
  });

  const res = await fetchComTimeout(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  );
  if (!res.ok) return null;

  const data = (await res.json()) as OpenMeteoResponse;
  return extrairHora(data, dataHora);
}

// Archive API (ERA5): dados desde 1940, delay de ~5 dias.
async function buscarArquivo(lat: number, lon: number, dataHora: Date): Promise<ClimaResultado | null> {
  const dataStr = dataHora.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: "temperature_2m,relative_humidity_2m,weather_code",
    timezone: "UTC",
    start_date: dataStr,
    end_date: dataStr,
  });

  const res = await fetchComTimeout(
    `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`
  );
  if (!res.ok) return null;

  const data = (await res.json()) as OpenMeteoResponse;
  return extrairHora(data, dataHora);
}

// ─── API pública ──────────────────────────────────────────────────────────────

// Usa Forecast para datas até 5 dias atrás; Archive para datas mais antigas.
// Retorna null em qualquer falha — nunca lança exceção.
export async function buscarClima(
  lat: number,
  lon: number,
  dataHora: Date
): Promise<ClimaResultado | null> {
  const chave = chaveCache(lat, lon, dataHora);
  const cached = lerCache(chave);
  if (cached) return cached;

  try {
    const diffDias = (Date.now() - dataHora.getTime()) / (1000 * 60 * 60 * 24);
    const resultado =
      diffDias <= 5
        ? await buscarPrevisao(lat, lon, dataHora)
        : await buscarArquivo(lat, lon, dataHora);

    if (resultado) escreverCache(chave, resultado);
    return resultado;
  } catch {
    return null;
  }
}

// ─── Enriquecimento pós-avaliação ─────────────────────────────────────────────
// Chamado de forma assíncrona (void) após salvar a avaliação.
// Busca coordenadas da colônia (fallback: meliponário) → chama Open-Meteo → atualiza o registro.
// Nunca lança exceção — falhas são silenciosas por design.

export async function enriquecerComClima(
  avaliacaoId: string,
  coloniaId: string,
  dataAvaliacao: Date
): Promise<void> {
  try {
    const colonia = await prisma.colonia.findUnique({
      where: { id: coloniaId },
      select: { latitude: true, longitude: true, userId: true },
    });
    if (!colonia) return;

    let lat = colonia.latitude;
    let lon = colonia.longitude;

    if (lat === null || lon === null) {
      const mel = await prisma.meliponario.findUnique({
        where: { userId: colonia.userId },
        select: { latitude: true, longitude: true },
      });
      lat = mel?.latitude ?? null;
      lon = mel?.longitude ?? null;
    }

    if (lat === null || lon === null) return;

    const clima = await buscarClima(lat, lon, dataAvaliacao);
    if (!clima) return;

    await prisma.avaliacao.update({
      where: { id: avaliacaoId },
      data: {
        temperatura: clima.temperatura,
        umidade: clima.umidade,
        condicaoClimatica: clima.condicaoClimatica,
      },
    });
  } catch {
    // Falha silenciosa: clima é enriquecimento, nunca requisito
  }
}
