import { afterEach, describe, expect, it, vi } from "vitest";
import { pedirSincronizacaoEmSegundoPlano, sincronizarEmSegundoPlano, TAG_SINCRONIZACAO, type DependenciasSegundoPlano } from "./segundoPlano";

const SESSAO = { usuarioId: "u1", token: "tok" };

function dependencias(parcial: Partial<DependenciasSegundoPlano> = {}): DependenciasSegundoPlano {
  return {
    lerSessao: vi.fn(async () => SESSAO),
    haJanelaAberta: vi.fn(async () => false),
    assumirSessao: vi.fn(),
    sincronizar: vi.fn(async () => ({ falhaTransitoria: false })),
    cancelarNovaTentativa: vi.fn(),
    ...parcial,
  };
}

describe("sincronizarEmSegundoPlano (evento sync do Service Worker)", () => {
  it("app fechado, com sessão: assume a sessão espelhada, roda o ciclo e cancela a nova tentativa por timer", async () => {
    const d = dependencias();
    expect(await sincronizarEmSegundoPlano(d)).toBe("sincronizado");
    expect(d.assumirSessao).toHaveBeenCalledWith(SESSAO);
    expect(d.sincronizar).toHaveBeenCalledWith("u1");
    expect(d.cancelarNovaTentativa).toHaveBeenCalledWith("u1");
  });

  it("janela do app aberta: não sincroniza, mas rejeita para o registro valer depois que o app fechar", async () => {
    const d = dependencias({ haJanelaAberta: vi.fn(async () => true) });
    await expect(sincronizarEmSegundoPlano(d)).rejects.toThrow("App aberto");
    expect(d.sincronizar).not.toHaveBeenCalled();
    expect(d.assumirSessao).not.toHaveBeenCalled();
  });

  it("sem sessão espelhada (logout ou 401): não envia nada", async () => {
    const d = dependencias({ lerSessao: vi.fn(async () => null) });
    expect(await sincronizarEmSegundoPlano(d)).toBe("sem-sessao");
    expect(d.sincronizar).not.toHaveBeenCalled();
  });

  it("falha transitória (servidor fora, rede): rejeita, para o navegador tentar de novo", async () => {
    const d = dependencias({ sincronizar: vi.fn(async () => ({ falhaTransitoria: true })) });
    await expect(sincronizarEmSegundoPlano(d)).rejects.toThrow("tentará de novo");
    expect(d.cancelarNovaTentativa).toHaveBeenCalledWith("u1");
  });
});
// O 401 com o ciclo real (não transitório, encerra e apaga a cópia da sessão) está em eventoSync.test.ts.

describe("pedirSincronizacaoEmSegundoPlano", () => {
  const swOriginal = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  afterEach(() => {
    delete (window as { SyncManager?: unknown }).SyncManager;
    if (swOriginal) Object.defineProperty(navigator, "serviceWorker", swOriginal);
    else delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });

  function instalarSw(registro: unknown) {
    const getRegistration = vi.fn(async () => registro);
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration } });
    return getRegistration;
  }

  it("navegador sem Background Sync (Firefox, Safari): não registra nada", async () => {
    const register = vi.fn();
    const getRegistration = instalarSw({ sync: { register } });
    await pedirSincronizacaoEmSegundoPlano();
    expect(getRegistration).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });

  it("com suporte: registra a tag no Service Worker", async () => {
    Object.assign(window, { SyncManager: class {} });
    const register = vi.fn(async () => undefined);
    instalarSw({ sync: { register } });
    await pedirSincronizacaoEmSegundoPlano();
    expect(register).toHaveBeenCalledWith(TAG_SINCRONIZACAO);
  });

  it("sem Service Worker registrado (modo dev) ou registro recusado: não lança", async () => {
    Object.assign(window, { SyncManager: class {} });
    instalarSw(undefined);
    await expect(pedirSincronizacaoEmSegundoPlano()).resolves.toBeUndefined();

    instalarSw({ sync: { register: vi.fn(async () => Promise.reject(new Error("NotAllowedError"))) } });
    await expect(pedirSincronizacaoEmSegundoPlano()).resolves.toBeUndefined();
  });
});
