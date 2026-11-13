import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import { api, ErroApi, TIMEOUT_LONGO_MS, TIMEOUT_PADRAO_MS } from "./client";
import { fotosApi, syncApi } from "./endpoints";

// Prazo das requisições: sem resposta, vira o erro de conexão (status 0), que
// manda a escrita para a fila offline e a leitura para a cópia local.

// fetch que só responde quando o teste manda, e respeita o AbortSignal como o navegador.
function fetchPendurado() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  useAuth.setState({ token: "tok", usuario: null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function estadoApos<T>(promessa: Promise<T>, ms: number) {
  let estado: "pendente" | "ok" | ErroApi = "pendente";
  promessa.then(
    () => (estado = "ok"),
    (e: ErroApi) => (estado = e)
  );
  await vi.advanceTimersByTimeAsync(ms);
  return estado as "pendente" | "ok" | ErroApi;
}

describe("timeout das requisições", () => {
  it("sem resposta em 30 s: ErroApi status 0", async () => {
    vi.stubGlobal("fetch", fetchPendurado());
    const pedido = api.get("/colonias");
    expect(await estadoApos(pedido, TIMEOUT_PADRAO_MS - 1)).toBe("pendente");
    const erro = await estadoApos(pedido, 1);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(0);
  });

  it("corpo interrompido pelo prazo também vira ErroApi status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => ({
        status: 200,
        ok: true,
        json: () =>
          new Promise((_r, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))),
      }))
    );
    const erro = await estadoApos(api.get("/colonias"), TIMEOUT_PADRAO_MS);
    expect((erro as ErroApi).status).toBe(0);
  });

  it("resposta a tempo: o prazo é cancelado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 })));
    await expect(api.get("/x")).resolves.toEqual({ ok: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("POST /sync, upload de foto e pull usam o prazo longo", async () => {
    for (const pedir of <(() => Promise<unknown>)[]>[
      () => syncApi.enviar([]),
      () => fotosApi.enviar(new Blob(["x"]), { avaliacaoId: "a1" }),
      () => syncApi.alteracoes(),
    ]) {
      vi.stubGlobal("fetch", fetchPendurado());
      const pedido = pedir();
      expect(await estadoApos(pedido, TIMEOUT_PADRAO_MS)).toBe("pendente");
      expect(((await estadoApos(pedido, TIMEOUT_LONGO_MS - TIMEOUT_PADRAO_MS)) as ErroApi).status).toBe(0);
    }
  });
});
