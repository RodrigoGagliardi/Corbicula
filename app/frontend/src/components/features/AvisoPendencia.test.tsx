import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pendenciaDoRegistro } from "../../services/offline/decisoes";
import type { OperacaoFila } from "../../services/offline/tipos";
import { AvisoPendencia } from "./AvisoPendencia";

vi.mock("../../services/offline/decisoes", () => ({ pendenciaDoRegistro: vi.fn() }));

function renderizar() {
  const { container } = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AvisoPendencia entidadeId="c1" />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return container;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AvisoPendencia", () => {
  it("sem pendência: nada", async () => {
    vi.mocked(pendenciaDoRegistro).mockResolvedValue(null);
    const container = renderizar();
    await vi.waitFor(() => expect(pendenciaDoRegistro).toHaveBeenCalledWith("c1"));
    expect(container).toBeEmptyDOMElement();
  });

  it("conflito: texto do conflito e link para resolver", async () => {
    vi.mocked(pendenciaDoRegistro).mockResolvedValue({ estado: "conflito" } as OperacaoFila);
    renderizar();
    expect(await screen.findByText(/alterado aqui e em outro lugar/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resolver pendência" })).toHaveAttribute("href", "/app/configuracoes/sync");
  });

  it("recusa: mostra a mensagem do servidor", async () => {
    vi.mocked(pendenciaDoRegistro).mockResolvedValue({ estado: "erro", ultimoErro: "A espécie deve ser a mesma" } as OperacaoFila);
    renderizar();
    expect(await screen.findByText(/O servidor recusou .* A espécie deve ser a mesma/)).toBeInTheDocument();
  });
});
