import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import { API_URL } from "./client";
import { syncApi } from "./endpoints";

// Contrato com o backend (GET /sync/alteracoes?desde=, app/backend/src/modules/sync).
const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ servidorEm: "x" }), { status: 200 }));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  useAuth.setState({ token: "tok", usuario: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const urlPedida = () => fetchMock.mock.calls[0]![0];

describe("syncApi.alteracoes", () => {
  it("sem desde: pede /sync/alteracoes sem query (carga completa)", async () => {
    await syncApi.alteracoes();
    expect(urlPedida()).toBe(`${API_URL}/sync/alteracoes`);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "GET", headers: { Authorization: "Bearer tok" } });
  });

  it("com desde: envia o ISO codificado em ?desde=", async () => {
    await syncApi.alteracoes("2026-11-05T10:00:00.000Z");
    expect(urlPedida()).toBe(`${API_URL}/sync/alteracoes?desde=2026-11-05T10%3A00%3A00.000Z`);
    expect(new URL(urlPedida()).searchParams.get("desde")).toBe("2026-11-05T10:00:00.000Z");
  });

  it("devolve o corpo da resposta", async () => {
    await expect(syncApi.alteracoes()).resolves.toEqual({ servidorEm: "x" });
  });
});
