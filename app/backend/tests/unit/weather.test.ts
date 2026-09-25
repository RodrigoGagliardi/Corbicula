import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarClima } from "../../src/services/weather.service";

// A Open-Meteo nunca é chamada de verdade nos testes: `fetch` é substituído.
// O cache do serviço é global ao módulo, por isso cada teste usa uma coordenada
// diferente (lat/lon variam na 2ª casa decimal = chave de cache diferente).

function respostaOpenMeteo(horaIso: string, temp: number, umid: number, code: number) {
  const hora = horaIso.slice(0, 13); // "2026-09-20T10"
  return {
    ok: true,
    json: async () => ({
      hourly: {
        time: [`${hora.slice(0, 11)}09:00`, `${hora}:00`],
        temperature_2m: [0, temp],
        relative_humidity_2m: [0, umid],
        weather_code: [0, code],
      },
    }),
  };
}

function mockFetch(impl: (url: string) => unknown) {
  const fn = vi.fn(async (url: string) => impl(url));
  vi.stubGlobal("fetch", fn);
  return fn;
}

let coord = 0;
const novaCoord = () => {
  coord += 1;
  return { lat: -30 - coord / 100, lon: -51 - coord / 100 };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buscarClima", () => {
  it("usa a Forecast API para datas recentes e arredonda os valores", async () => {
    const quando = new Date(Date.now() - 60 * 60 * 1000);
    const fetch = mockFetch(() => respostaOpenMeteo(quando.toISOString(), 17.46, 78.4, 0));
    const { lat, lon } = novaCoord();

    const clima = await buscarClima(lat, lon, quando);

    expect(clima).toEqual({ temperatura: 17.5, umidade: 78, condicaoClimatica: "ensolarado" });
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0]![0])).toContain("api.open-meteo.com/v1/forecast");
  });

  it("usa a Archive API (ERA5) para datas com mais de 5 dias", async () => {
    const quando = new Date("2024-01-15T10:30:00.000Z");
    const fetch = mockFetch(() => respostaOpenMeteo(quando.toISOString(), 25, 60, 61));
    const { lat, lon } = novaCoord();

    const clima = await buscarClima(lat, lon, quando);

    expect(clima?.condicaoClimatica).toBe("chuvoso");
    const url = String(fetch.mock.calls[0]![0]);
    expect(url).toContain("archive-api.open-meteo.com/v1/archive");
    expect(url).toContain("start_date=2024-01-15");
  });

  it.each([
    [0, "ensolarado"],
    [1, "ensolarado"],
    [2, "nublado"],
    [3, "nublado"],
    [45, "nublado"], // neblina
    [71, "nublado"], // neve
    [51, "chuvoso"], // garoa
    [63, "chuvoso"], // chuva
    [81, "chuvoso"], // pancadas
    [95, "chuvoso"], // trovoada
  ])("código WMO %i → %s", async (code, esperado) => {
    const quando = new Date("2023-06-01T12:00:00.000Z");
    mockFetch(() => respostaOpenMeteo(quando.toISOString(), 20, 50, code));
    const { lat, lon } = novaCoord();

    expect((await buscarClima(lat, lon, quando))?.condicaoClimatica).toBe(esperado);
  });

  it("cacheia por (lat, lon, hora): várias inspeções na mesma hora = 1 chamada", async () => {
    const fetch = mockFetch(() => respostaOpenMeteo("2023-07-01T08:00:00.000Z", 12, 90, 3));
    const { lat, lon } = novaCoord();

    await buscarClima(lat, lon, new Date("2023-07-01T08:05:00.000Z"));
    await buscarClima(lat, lon, new Date("2023-07-01T08:50:00.000Z"));
    await buscarClima(lat + 0.001, lon, new Date("2023-07-01T08:20:00.000Z")); // mesma célula (~1 km)

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("retorna null (sem lançar) quando a API falha, responde erro ou não tem a hora", async () => {
    const quando = new Date("2023-08-01T12:00:00.000Z");

    mockFetch(() => {
      throw new Error("sem rede");
    });
    let c = novaCoord();
    await expect(buscarClima(c.lat, c.lon, quando)).resolves.toBeNull();

    mockFetch(() => ({ ok: false, json: async () => ({}) }));
    c = novaCoord();
    await expect(buscarClima(c.lat, c.lon, quando)).resolves.toBeNull();

    mockFetch(() => respostaOpenMeteo("2023-08-02T12:00:00.000Z", 20, 50, 0)); // outro dia
    c = novaCoord();
    await expect(buscarClima(c.lat, c.lon, quando)).resolves.toBeNull();
  });
});
