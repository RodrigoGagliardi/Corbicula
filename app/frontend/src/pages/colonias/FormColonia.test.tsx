import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useColonia } from "../../hooks/useDados";
import { coloniasApi } from "../../services/api/endpoints";
import type { ColoniaDetalhada } from "../../types/api";
import { FormColonia } from "./FormColonia";

// useDados e a store de preferências carregam matchMedia (ausente no jsdom).
vi.mock("../../hooks/useDados", () => ({
  chaves: { colonias: ["colonias"] },
  useColonia: vi.fn(),
  useColonias: () => ({ data: [] }),
  useEspecies: () => ({ data: [] }),
}));
vi.mock("../../store/preferencias", () => ({
  usePreferencias: (seletor: (s: { diasInspecaoAtrasada: number }) => unknown) => seletor({ diasInspecaoAtrasada: 30 }),
}));
vi.mock("../../services/api/endpoints", () => ({ coloniasApi: { criar: vi.fn(), atualizar: vi.fn() } }));

const criar = vi.mocked(coloniasApi.criar);
const atualizar = vi.mocked(coloniasApi.atualizar);

const COLONIA = {
  id: "c1",
  codigo: "TETRANGU-001",
  dataEntrada: "2026-10-01T12:00:00.000Z",
  origem: "captura",
  tipoCaixa: "INPA",
  dimensoesCaixa: null,
  localizacao: null,
  latitude: null,
  longitude: null,
  observacoes: null,
  status: "ativa",
  statusDesde: null,
  motivoStatus: null,
  motivoStatusDetalhe: null,
  frequenciaInspecaoDias: null,
  especieId: null,
  coloniaMaeId: null,
  coloniaDoadoraCampeirasId: null,
  coloniaMae: null,
  coloniasFilhas: [],
  coloniaDoadoraCampeiras: null,
  coloniasReceptorasCampeiras: [],
} as unknown as ColoniaDetalhada;

function renderizar(caminho: string) {
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route path="/app/colonias/nova" element={<FormColonia />} />
          <Route path="/app/colonias/:id/editar" element={<FormColonia />} />
          <Route path="/app/colonias/:id" element={<p>detalhe</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const status = () => screen.getByLabelText("Status");

beforeEach(() => {
  vi.mocked(useColonia).mockReturnValue({ data: COLONIA, isLoading: false, error: null } as unknown as ReturnType<typeof useColonia>);
  criar.mockResolvedValue({ id: "nova" } as ColoniaDetalhada);
  atualizar.mockResolvedValue({ id: "c1" } as ColoniaDetalhada);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FormColonia: status, data e motivo", () => {
  it("criação com 'Morta': envia status morta, sem data nem motivo", async () => {
    renderizar("/app/colonias/nova");
    fireEvent.change(status(), { target: { value: "morta" } });
    expect(screen.queryByLabelText("Data em que percebi")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar colônia" }));

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    const dados = criar.mock.calls[0]![0];
    expect(dados.status).toBe("morta");
    expect(dados).not.toHaveProperty("statusDesde");
    expect(dados).not.toHaveProperty("motivoStatus");
  });

  it("frequência de inspeção em dias: aceita um inteiro e envia o número", async () => {
    renderizar("/app/colonias/nova");
    fireEvent.change(screen.getByLabelText("Frequência de inspeção (dias)"), { target: { value: "30" } });
    expect(screen.queryByText("Use um número inteiro de dias.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar colônia" }));

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    expect(criar.mock.calls[0]![0].frequenciaInspecaoDias).toBe(30);
  });

  it("edição mudando o status: status, statusDesde e motivo", async () => {
    renderizar("/app/colonias/c1/editar");
    fireEvent.change(status(), { target: { value: "morta" } });
    expect(screen.getByLabelText("Data em que percebi")).toBeInTheDocument();
    // Só os motivos de "morta" (e outro); os de ativa não aparecem.
    expect(screen.queryByRole("button", { name: "Voltou a ser ativa" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fome / falta de alimento" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1));
    const [id, dados] = atualizar.mock.calls[0]!;
    expect(id).toBe("c1");
    expect(dados).toMatchObject({ status: "morta", motivoStatus: "fome_escassez" });
    expect(typeof dados.statusDesde).toBe("string");
    expect(new Date(dados.statusDesde!).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("edição com o status igual: nenhum campo de status", async () => {
    renderizar("/app/colonias/c1/editar");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1));
    const dados = atualizar.mock.calls[0]![1];
    for (const campo of ["status", "statusDesde", "motivoStatus", "motivoStatusDetalhe"]) {
      expect(dados).not.toHaveProperty(campo);
    }
  });

  it("data da mudança anterior à entrada da colônia: não salva e mostra o erro", async () => {
    renderizar("/app/colonias/c1/editar");
    fireEvent.change(status(), { target: { value: "inativa" } });
    fireEvent.change(screen.getByLabelText("Data em que percebi"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("A data não pode ser anterior à entrada da colônia.")).toBeInTheDocument();
    expect(atualizar).not.toHaveBeenCalled();
  });
});
