import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { descartarPendencia, listarPendencias, manterAparelho, manterServidor, type Pendencia } from "../../services/offline/decisoes";
import type { OperacaoFila } from "../../services/offline/tipos";
import { formatarValorCampo, rotuloCampo } from "../../utils/pendencias";
import { Sincronizacao } from "./Sincronizacao";

vi.mock("../../hooks/useDados", () => ({ useEspecies: () => ({ data: [{ id: "e-jatai", nomePopular: "Jataí" }] }) }));
vi.mock("../../services/offline/decisoes", () => ({
  listarPendencias: vi.fn(),
  manterServidor: vi.fn(async () => undefined),
  manterAparelho: vi.fn(async () => undefined),
  descartarPendencia: vi.fn(async () => undefined),
}));
vi.mock("../../services/offline/banco", () => ({ indexedDbDisponivel: () => false, abrirBanco: vi.fn() }));
vi.mock("./Configuracoes", () => ({ VoltarConfiguracoes: () => null }));

const op = (parcial: Partial<OperacaoFila>): OperacaoFila => ({
  id: "op1",
  tipo: "colonia",
  operacao: "update",
  entidadeId: "c1",
  dados: {},
  criadoEm: "",
  ordem: 1,
  estado: "conflito",
  tentativas: 1,
  relacionadas: [],
  ...parcial,
});

const pendencia = (parcial: Partial<Pendencia> = {}): Pendencia => ({
  op: op({ conflitos: [{ campo: "observacoes", local: "do aparelho", servidor: "do servidor" }] }),
  rotulo: "Colônia TETRANGU-001",
  rotaEdicao: "/app/colonias/c1/editar?pendencia=op1",
  rotaDetalhe: "/app/colonias/c1",
  seguintes: 0,
  dependentes: { operacoes: 0, fotos: 0 },
  ...parcial,
});

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Sincronizacao />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const confirmar = vi.fn(() => true);
beforeEach(() => {
  window.confirm = confirmar;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Sincronização: pendências", () => {
  it("sem pendências: mensagem de tudo em ordem", async () => {
    vi.mocked(listarPendencias).mockResolvedValue([]);
    renderizar();
    expect(await screen.findByText(/Nenhuma pendência/)).toBeInTheDocument();
  });

  it("conflito: mostra as duas versões e as três opções", async () => {
    vi.mocked(listarPendencias).mockResolvedValue([pendencia({ seguintes: 2 })]);
    renderizar();
    const linha = (await screen.findByRole("rowheader", { name: "Observações" })).closest("tr")!;
    expect(within(linha).getByText("do aparelho")).toBeInTheDocument();
    expect(within(linha).getByText("do servidor")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar manualmente" })).toHaveAttribute("href", "/app/colonias/c1/editar?pendencia=op1");
    expect(screen.queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manter a do servidor" }));
    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining("2 outras edições"));
    await waitFor(() => expect(manterServidor).toHaveBeenCalledWith("op1"));

    fireEvent.click(screen.getByRole("button", { name: "Manter a deste aparelho" }));
    await waitFor(() => expect(manterAparelho).toHaveBeenCalledWith("op1"));
  });

  it("recusa: mensagem do servidor, editar ou descartar (com o que sai junto)", async () => {
    vi.mocked(listarPendencias).mockResolvedValue([
      pendencia({ op: op({ estado: "erro", operacao: "create", ultimoErro: "A espécie deve ser a mesma da colônia mãe" }), dependentes: { operacoes: 1, fotos: 2 } }),
    ]);
    renderizar();
    expect(await screen.findByText("A espécie deve ser a mesma da colônia mãe")).toBeInTheDocument();
    expect(screen.getByText("Recusada pelo servidor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manter a do servidor" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(confirmar).toHaveBeenCalledWith(expect.stringMatching(/1 outra mudança ligada a ela e 2 fotos guardadas/));
    await waitFor(() => expect(descartarPendencia).toHaveBeenCalledWith("op1"));
  });

  it("cancelar a confirmação não decide nada", async () => {
    confirmar.mockReturnValueOnce(false);
    vi.mocked(listarPendencias).mockResolvedValue([pendencia()]);
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: "Manter a do servidor" }));
    expect(manterServidor).not.toHaveBeenCalled();
  });
});

describe("rótulos e valores dos campos", () => {
  it("campos conhecidos em pt-BR; valores legíveis", () => {
    expect(rotuloCampo("parametros")).toBe("Parâmetros avaliados");
    expect(rotuloCampo("desconhecido")).toBe("desconhecido");
    const ctx = { nomes: { p1: "Fluxo", "e-jatai": "Jataí" } };
    expect(formatarValorCampo("parametros", [{ parametroId: "p1", classificacao: "bom" }], ctx)).toBe("Fluxo: Bom");
    expect(formatarValorCampo("especieId", "e-jatai", ctx)).toBe("Jataí");
    expect(formatarValorCampo("status", "morta")).toBe("Morta");
    expect(formatarValorCampo("observacoes", null)).toBe("—");
    expect(formatarValorCampo("dimensoesCaixa", { altura: 10, largura: 20, profundidade: null })).toBe("10 × 20 × ? cm");
  });
});
