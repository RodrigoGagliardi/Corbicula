import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { estadoDosRegistros } from "../../services/offline/decisoes";
import { useAuth } from "../../store/auth";
import { SeloEnvio } from "./SeloEnvio";

vi.mock("../../services/offline/decisoes", () => ({ estadoDosRegistros: vi.fn() }));

function renderizar(id: string) {
  useAuth.setState({ token: "t", usuario: { id: "u1" } as never });
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <SeloEnvio id={id} />
    </QueryClientProvider>
  );
  return container;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SeloEnvio", () => {
  it("pendente: 'Não enviado'; parada: 'Precisa de decisão'; em dia: nada", async () => {
    vi.mocked(estadoDosRegistros).mockResolvedValue(new Map([["a", "pendente"], ["b", "parada"]]));
    renderizar("a");
    expect(await screen.findByText("Não enviado")).toBeInTheDocument();
    cleanup();
    renderizar("b");
    expect(await screen.findByText("Precisa de decisão")).toBeInTheDocument();
    cleanup();
    vi.mocked(estadoDosRegistros).mockClear();
    let resolver!: (m: Map<string, "pendente" | "parada">) => void;
    vi.mocked(estadoDosRegistros).mockReturnValue(new Promise((r) => (resolver = r)));
    const vazio = renderizar("c");
    await vi.waitFor(() => expect(estadoDosRegistros).toHaveBeenCalledTimes(1));
    resolver(new Map([["a", "pendente"]]));
    // Depois de os dados chegarem, o registro em dia continua sem marca.
    await new Promise((r) => setTimeout(r, 0));
    expect(vazio).toBeEmptyDOMElement();
  });
});
