import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apagarDadosLocais, pendenciasDoAparelho } from "../../services/offline/sessao";
import { sincronizar } from "../../services/offline/sincronizacao";
import { useAuth } from "../../store/auth";
import { DialogoSair, descreverPendencias, useSair } from "./DialogoSair";

const conexao = vi.hoisted(() => ({ online: true }));
vi.mock("../../hooks/useOnline", () => ({ useOnline: () => conexao.online }));
vi.mock("../../services/offline/sessao", () => ({ apagarDadosLocais: vi.fn(async () => undefined), pendenciasDoAparelho: vi.fn() }));
vi.mock("../../services/offline/sincronizacao", () => ({ sincronizar: vi.fn(async () => ({})) }));

function BotaoSair() {
  const sair = useSair();
  return (
    <button type="button" onClick={() => void sair()}>
      sair
    </button>
  );
}

function renderizar() {
  render(
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route
          path="/app"
          element={
            <>
              <BotaoSair />
              <DialogoSair />
            </>
          }
        />
        <Route path="/login" element={<p>login</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const confirmar = vi.fn(() => true);
beforeEach(() => {
  conexao.online = true;
  window.confirm = confirmar;
  useAuth.setState({ token: "t", usuario: { id: "u1" } as never });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Sair da conta", () => {
  it("sem pendências: apaga os dados locais e vai ao login, sem perguntar", async () => {
    vi.mocked(pendenciasDoAparelho).mockResolvedValue({ operacoes: 0, fotos: 0, decisoes: 0 });
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "sair" }));
    expect(await screen.findByText("login")).toBeInTheDocument();
    expect(apagarDadosLocais).toHaveBeenCalledWith("u1");
    expect(useAuth.getState().usuario).toBeNull();
  });

  it("com pendências: aviso com a contagem e as três opções; cancelar não sai", async () => {
    vi.mocked(pendenciasDoAparelho).mockResolvedValue({ operacoes: 3, fotos: 1, decisoes: 0 });
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "sair" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("3 mudanças e 1 foto");
    expect(screen.getByRole("button", { name: "Sincronizar agora" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apagarDadosLocais).not.toHaveBeenCalled();
    expect(useAuth.getState().usuario).not.toBeNull();
  });

  it("sincronizar agora: se a fila esvaziar, sai sem descartar; se sobrar, mostra a nova contagem", async () => {
    vi.mocked(pendenciasDoAparelho)
      .mockResolvedValueOnce({ operacoes: 2, fotos: 0, decisoes: 0 })
      .mockResolvedValueOnce({ operacoes: 1, fotos: 0, decisoes: 0 })
      .mockResolvedValueOnce({ operacoes: 0, fotos: 0, decisoes: 0 });
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "sair" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sincronizar agora" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("1 mudança"));
    expect(sincronizar).toHaveBeenCalledWith("u1");

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar agora" }));
    expect(await screen.findByText("login")).toBeInTheDocument();
  });

  it("offline: sem 'Sincronizar agora'; sair e descartar pede confirmação", async () => {
    conexao.online = false;
    vi.mocked(pendenciasDoAparelho).mockResolvedValue({ operacoes: 1, fotos: 0, decisoes: 0 });
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "sair" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Sincronizar agora" })).not.toBeInTheDocument();

    confirmar.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Sair e descartar" }));
    expect(apagarDadosLocais).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sair e descartar" }));
    expect(await screen.findByText("login")).toBeInTheDocument();
    expect(apagarDadosLocais).toHaveBeenCalledWith("u1");
  });

  it("a sessão termina antes de apagar (uma sincronização em andamento não recria o banco)", async () => {
    vi.mocked(pendenciasDoAparelho).mockResolvedValue({ operacoes: 0, fotos: 0, decisoes: 0 });
    let usuarioAoApagar: unknown = "não chamado";
    vi.mocked(apagarDadosLocais).mockImplementationOnce(async () => {
      usuarioAoApagar = useAuth.getState().usuario;
    });
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "sair" }));
    expect(await screen.findByText("login")).toBeInTheDocument();
    await waitFor(() => expect(usuarioAoApagar).toBeNull());
  });

  it("401 com o aviso aberto: o aviso não reaparece para a próxima conta", async () => {
    vi.mocked(pendenciasDoAparelho).mockResolvedValue({ operacoes: 1, fotos: 0, decisoes: 0 });
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "sair" }));
    await screen.findByRole("dialog");

    act(() => useAuth.getState().sair());
    act(() => useAuth.setState({ token: "t2", usuario: { id: "u2" } as never }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apagarDadosLocais).not.toHaveBeenCalled();
  });

  it("mudanças esperando decisão: avisa e leva à Sincronização; só decisões, sem 'Sincronizar agora'", async () => {
    vi.mocked(pendenciasDoAparelho).mockResolvedValue({ operacoes: 2, fotos: 0, decisoes: 2 });
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "sair" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent("2 mudanças esperam uma decisão sua");
    expect(screen.getByRole("link", { name: "resolver em Sincronização" })).toHaveAttribute("href", "/app/configuracoes/sync");
    expect(screen.queryByRole("button", { name: "Sincronizar agora" })).not.toBeInTheDocument();
  });

  it("descrição das pendências", () => {
    expect(descreverPendencias({ operacoes: 1, fotos: 0, decisoes: 0 })).toBe("1 mudança");
    expect(descreverPendencias({ operacoes: 0, fotos: 2, decisoes: 0 })).toBe("2 fotos");
  });
});
