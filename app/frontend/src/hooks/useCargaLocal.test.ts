import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResultadoPull } from "../services/offline/sincronizacao";
import { useAuth } from "../store/auth";
import type { Usuario } from "../types/api";

const estado = vi.hoisted(() => ({ online: true, visibilidade: "visible" as DocumentVisibilityState }));
const sinc = vi.hoisted(() => ({
  puxarAlteracoes: vi.fn<(usuarioId: string) => Promise<ResultadoPull>>(),
  pedirArmazenamentoPersistente: vi.fn(async () => true),
}));

vi.mock("./useOnline", () => ({ useOnline: () => estado.online }));
vi.mock("../services/offline/sincronizacao", () => sinc);

const { useCargaLocal } = await import("./useCargaLocal");

const OK: ResultadoPull = { ok: true, servidorEm: "2026-11-05T10:00:00.000Z", cargaCompleta: true };
const FALHA: ResultadoPull = { ok: false, motivo: "sem-conexao", mensagem: "Sem conexão com o servidor." };

const usuario = (id: string) => ({ id, email: `${id}@x.app`, name: id, createdAt: "", meliponario: null }) as Usuario;

// Espera o `.then` do pull rodar (o hook marca o usuário como carregado ali).
const terminarPull = () => act(async () => {});

// Simula a conexão caindo e voltando.
async function reconectar(rerender: () => void) {
  estado.online = false;
  rerender();
  estado.online = true;
  rerender();
  await terminarPull();
}

// Simula o usuário saindo do app e voltando para ele.
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => estado.visibilidade });
async function mudarVisibilidade(visibilidade: DocumentVisibilityState) {
  estado.visibilidade = visibilidade;
  document.dispatchEvent(new Event("visibilitychange"));
  await terminarPull();
}

beforeEach(() => {
  vi.clearAllMocks();
  estado.online = true;
  estado.visibilidade = "visible";
  sinc.puxarAlteracoes.mockResolvedValue(OK);
  useAuth.setState({ token: "t", usuario: usuario("u1") });
});

// Sem `globals`, o Testing Library não desmonta sozinho entre os testes.
afterEach(() => cleanup());

describe("useCargaLocal", () => {
  it("sem usuário logado: não faz nada", async () => {
    useAuth.setState({ token: null, usuario: null });
    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.puxarAlteracoes).not.toHaveBeenCalled();
    expect(sinc.pedirArmazenamentoPersistente).not.toHaveBeenCalled();
  });

  it("offline: não faz nada", async () => {
    estado.online = false;
    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.puxarAlteracoes).not.toHaveBeenCalled();
    expect(sinc.pedirArmazenamentoPersistente).not.toHaveBeenCalled();
  });

  it("online ao montar: dispara o pull e o pedido de persistência", async () => {
    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.puxarAlteracoes).toHaveBeenCalledExactlyOnceWith("u1");
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenCalledExactlyOnceWith("u1");
  });

  it("aberto offline: dispara quando fica online", async () => {
    estado.online = false;
    const { rerender } = renderHook(() => useCargaLocal());
    expect(sinc.puxarAlteracoes).not.toHaveBeenCalled();

    estado.online = true;
    rerender();
    await terminarPull();
    expect(sinc.puxarAlteracoes).toHaveBeenCalledExactlyOnceWith("u1");
  });

  it("após ok: não repete para o mesmo usuário ao reconectar", async () => {
    const { rerender } = renderHook(() => useCargaLocal());
    await terminarPull();
    await reconectar(rerender);
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(1);
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenCalledTimes(1);
  });

  it("após falha: tenta de novo ao ficar online outra vez", async () => {
    sinc.puxarAlteracoes.mockResolvedValueOnce(FALHA);
    const { rerender } = renderHook(() => useCargaLocal());
    await terminarPull();

    await reconectar(rerender);
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(2);

    // A segunda deu ok: a próxima reconexão já não repete.
    await reconectar(rerender);
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(2);
    // A persistência não é pedida de novo a cada tentativa.
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenCalledTimes(1);
  });

  it("após falha: tenta de novo quando o layout remonta", async () => {
    sinc.puxarAlteracoes.mockResolvedValueOnce(FALHA);
    const primeiro = renderHook(() => useCargaLocal());
    await terminarPull();
    primeiro.unmount();

    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(2);
  });

  it("outro usuário: dispara a carga dele", async () => {
    renderHook(() => useCargaLocal());
    await terminarPull();

    act(() => useAuth.setState({ token: "t2", usuario: usuario("u2") }));
    await waitFor(() => expect(sinc.puxarAlteracoes).toHaveBeenLastCalledWith("u2"));
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(2);
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenLastCalledWith("u2");
  });

  it("ao voltar para o app (aba visível): puxa de novo, mesmo depois de ok", async () => {
    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(1);

    await mudarVisibilidade("hidden");
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(1);

    await mudarVisibilidade("visible");
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(2);
    expect(sinc.puxarAlteracoes).toHaveBeenLastCalledWith("u1");
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenCalledTimes(1);
  });

  it("ao voltar para o app: retenta uma falha com a rede ligada (5xx)", async () => {
    sinc.puxarAlteracoes.mockResolvedValueOnce({ ok: false, motivo: "servidor", mensagem: "Erro 503" });
    renderHook(() => useCargaLocal());
    await terminarPull();

    await mudarVisibilidade("hidden");
    await mudarVisibilidade("visible");
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(2);
  });

  it("ao voltar para o app offline ou sem usuário: não puxa", async () => {
    estado.online = false;
    const offline = renderHook(() => useCargaLocal());
    await mudarVisibilidade("visible");
    expect(sinc.puxarAlteracoes).not.toHaveBeenCalled();
    offline.unmount();

    estado.online = true;
    useAuth.setState({ token: null, usuario: null });
    renderHook(() => useCargaLocal());
    await mudarVisibilidade("visible");
    expect(sinc.puxarAlteracoes).not.toHaveBeenCalled();
  });

  it("depois de desmontar: voltar para o app não puxa", async () => {
    const { unmount } = renderHook(() => useCargaLocal());
    await terminarPull();
    unmount();
    await mudarVisibilidade("visible");
    expect(sinc.puxarAlteracoes).toHaveBeenCalledTimes(1);
  });
});
