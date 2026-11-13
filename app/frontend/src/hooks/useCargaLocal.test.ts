import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResultadoPull, ResultadoSincronizacao } from "../services/offline/sincronizacao";
import { useAuth } from "../store/auth";
import type { Usuario } from "../types/api";

const estado = vi.hoisted(() => ({ online: true, visibilidade: "visible" as DocumentVisibilityState }));
const sinc = vi.hoisted(() => ({
  sincronizar: vi.fn<(usuarioId: string) => Promise<ResultadoSincronizacao>>(),
  atualizarContagem: vi.fn(async () => 0),
  cancelarNovaTentativa: vi.fn(),
  pedirArmazenamentoPersistente: vi.fn(async () => true),
}));

vi.mock("./useOnline", () => ({ useOnline: () => estado.online }));
vi.mock("../services/offline/sincronizacao", () => sinc);

const { useCargaLocal } = await import("./useCargaLocal");

// Ciclo sem nada na fila; só o resultado do pull importa para o hook.
const ciclo = (pull: ResultadoPull): ResultadoSincronizacao => ({
  enviadas: 0,
  paradas: 0,
  falhaEnvio: null,
  fotosEnviadas: 0,
  fotosAlteradas: 0,
  falhaFotos: null,
  pull,
  naFila: 0,
});
const OK = ciclo({ ok: true, servidorEm: "2026-11-05T10:00:00.000Z", cargaCompleta: true, alterados: 0 });
const FALHA = ciclo({ ok: false, motivo: "sem-conexao", mensagem: "Sem conexão com o servidor." });

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
  sinc.sincronizar.mockResolvedValue(OK);
  useAuth.setState({ token: "t", usuario: usuario("u1") });
});

// Sem `globals`, o Testing Library não desmonta sozinho entre os testes.
afterEach(() => cleanup());

describe("useCargaLocal", () => {
  it("sem usuário logado: não faz nada", async () => {
    useAuth.setState({ token: null, usuario: null });
    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.sincronizar).not.toHaveBeenCalled();
    expect(sinc.pedirArmazenamentoPersistente).not.toHaveBeenCalled();
  });

  it("offline: não faz nada", async () => {
    estado.online = false;
    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.sincronizar).not.toHaveBeenCalled();
    expect(sinc.pedirArmazenamentoPersistente).not.toHaveBeenCalled();
  });

  it("online ao montar: dispara o pull e o pedido de persistência", async () => {
    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.sincronizar).toHaveBeenCalledExactlyOnceWith("u1");
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenCalledExactlyOnceWith("u1");
  });

  it("aberto offline: dispara quando fica online", async () => {
    estado.online = false;
    const { rerender } = renderHook(() => useCargaLocal());
    expect(sinc.sincronizar).not.toHaveBeenCalled();

    estado.online = true;
    rerender();
    await terminarPull();
    expect(sinc.sincronizar).toHaveBeenCalledExactlyOnceWith("u1");
  });

  it("reconectar sincroniza de novo, mesmo depois de ok (a fila pode ter crescido offline)", async () => {
    const { rerender } = renderHook(() => useCargaLocal());
    await terminarPull();
    await reconectar(rerender);
    expect(sinc.sincronizar).toHaveBeenCalledTimes(2);
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenCalledTimes(1);
  });

  it("re-render online sem reconexão não repete", async () => {
    const { rerender } = renderHook(() => useCargaLocal());
    await terminarPull();
    rerender();
    await terminarPull();
    expect(sinc.sincronizar).toHaveBeenCalledTimes(1);
  });

  it("contador da fila lido ao montar, também offline; offline cancela a nova tentativa agendada", async () => {
    estado.online = false;
    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.atualizarContagem).toHaveBeenCalledExactlyOnceWith("u1");
    expect(sinc.cancelarNovaTentativa).toHaveBeenCalledWith("u1");
    expect(sinc.sincronizar).not.toHaveBeenCalled();
  });

  it("após falha: tenta de novo ao ficar online outra vez", async () => {
    sinc.sincronizar.mockResolvedValueOnce(FALHA);
    const { rerender } = renderHook(() => useCargaLocal());
    await terminarPull();

    await reconectar(rerender);
    expect(sinc.sincronizar).toHaveBeenCalledTimes(2);

    await reconectar(rerender);
    expect(sinc.sincronizar).toHaveBeenCalledTimes(3);
    // A persistência não é pedida de novo a cada tentativa.
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenCalledTimes(1);
  });

  it("após falha: tenta de novo quando o layout remonta", async () => {
    sinc.sincronizar.mockResolvedValueOnce(FALHA);
    const primeiro = renderHook(() => useCargaLocal());
    await terminarPull();
    primeiro.unmount();

    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.sincronizar).toHaveBeenCalledTimes(2);
  });

  it("outro usuário: dispara a carga dele", async () => {
    renderHook(() => useCargaLocal());
    await terminarPull();

    act(() => useAuth.setState({ token: "t2", usuario: usuario("u2") }));
    await waitFor(() => expect(sinc.sincronizar).toHaveBeenLastCalledWith("u2"));
    expect(sinc.sincronizar).toHaveBeenCalledTimes(2);
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenLastCalledWith("u2");
  });

  it("ao voltar para o app (aba visível): puxa de novo, mesmo depois de ok", async () => {
    renderHook(() => useCargaLocal());
    await terminarPull();
    expect(sinc.sincronizar).toHaveBeenCalledTimes(1);

    await mudarVisibilidade("hidden");
    expect(sinc.sincronizar).toHaveBeenCalledTimes(1);

    await mudarVisibilidade("visible");
    expect(sinc.sincronizar).toHaveBeenCalledTimes(2);
    expect(sinc.sincronizar).toHaveBeenLastCalledWith("u1");
    expect(sinc.pedirArmazenamentoPersistente).toHaveBeenCalledTimes(1);
  });

  it("ao voltar para o app: retenta uma falha com a rede ligada (5xx)", async () => {
    sinc.sincronizar.mockResolvedValueOnce(ciclo({ ok: false, motivo: "servidor", mensagem: "Erro 503" }));
    renderHook(() => useCargaLocal());
    await terminarPull();

    await mudarVisibilidade("hidden");
    await mudarVisibilidade("visible");
    expect(sinc.sincronizar).toHaveBeenCalledTimes(2);
  });

  it("ao voltar para o app offline ou sem usuário: não puxa", async () => {
    estado.online = false;
    const offline = renderHook(() => useCargaLocal());
    await mudarVisibilidade("visible");
    expect(sinc.sincronizar).not.toHaveBeenCalled();
    offline.unmount();

    estado.online = true;
    useAuth.setState({ token: null, usuario: null });
    renderHook(() => useCargaLocal());
    await mudarVisibilidade("visible");
    expect(sinc.sincronizar).not.toHaveBeenCalled();
  });

  it("depois de desmontar: voltar para o app não puxa", async () => {
    const { unmount } = renderHook(() => useCargaLocal());
    await terminarPull();
    unmount();
    await mudarVisibilidade("visible");
    expect(sinc.sincronizar).toHaveBeenCalledTimes(1);
  });
});
