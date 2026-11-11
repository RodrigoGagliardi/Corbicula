import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sincronizar } from "../../services/offline/sincronizacao";
import { useAuth } from "../../store/auth";
import { useSincronizacao } from "../../store/sincronizacao";
import { IndicadorConexao } from "./IndicadorConexao";

const conexao = vi.hoisted(() => ({ online: true }));
vi.mock("../../hooks/useOnline", () => ({ useOnline: () => conexao.online }));
vi.mock("../../services/offline/sincronizacao", () => ({ sincronizar: vi.fn(async () => ({})) }));

const ESTADO_INICIAL = useSincronizacao.getState();
function renderizar(compacto = false) {
  render(
    <MemoryRouter>
      <IndicadorConexao compacto={compacto} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  conexao.online = true;
  useAuth.setState({ token: "t", usuario: { id: "u1" } as never });
  useSincronizacao.setState(ESTADO_INICIAL, true);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("IndicadorConexao", () => {
  it("online sem pendências: botão que sincroniza", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Online. Sincronizar agora" }));
    expect(sincronizar).toHaveBeenCalledWith("u1");
  });

  it("contador de não enviados (fila + fotos), o mesmo no compacto (mobile)", () => {
    useSincronizacao.setState({ naFila: 2, fotosPendentes: 1 });
    renderizar();
    expect(screen.getByRole("button", { name: /Online · 3 não enviados/ })).toBeInTheDocument();
    cleanup();
    renderizar(true);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("offline: status sem botão", () => {
    conexao.online = false;
    useSincronizacao.setState({ naFila: 1 });
    renderizar();
    expect(screen.getByRole("status")).toHaveTextContent("Offline · 1 não enviado");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sincronizando com progresso; servidor inacessível", () => {
    useSincronizacao.setState({ sincronizando: true, progresso: { feitas: 1, total: 4 } });
    renderizar();
    expect(screen.getByRole("button", { name: "Sincronizando 1/4" })).toBeDisabled();
    cleanup();
    useSincronizacao.setState({ sincronizando: false, progresso: null, servidorInacessivel: true });
    renderizar();
    expect(screen.getByRole("button", { name: /Servidor inacessível/ })).toBeInTheDocument();
  });

  it("decisões pendentes: atalho para a tela de Sincronização, fora do contador de envio", () => {
    useSincronizacao.setState({ decisoes: 2, naFila: 3 });
    renderizar();
    expect(screen.getByRole("button", { name: /Online · 1 não enviado\./ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2 pendências de decisão" })).toHaveAttribute("href", "/app/configuracoes/sync");
  });
});
