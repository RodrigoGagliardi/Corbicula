import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avaliacoesApi } from "../../services/api/endpoints";
import type { AvaliacaoDetalhada, Colonia, Parametro } from "../../types/api";
import { FormularioAvaliacao } from "./NovaAvaliacao";

// useDados carrega a store de preferências (matchMedia, ausente no jsdom); o formulário só usa as chaves.
vi.mock("../../hooks/useDados", () => ({ chaves: { colonias: ["colonias"] }, useColonias: vi.fn(), useParametros: vi.fn() }));
vi.mock("../../services/api/endpoints", () => ({
  avaliacoesApi: { criar: vi.fn(), atualizar: vi.fn() },
  fotosApi: { enviar: vi.fn() },
}));

const criar = vi.mocked(avaliacoesApi.criar);
const atualizar = vi.mocked(avaliacoesApi.atualizar);

const COLONIA = {
  id: "c1",
  codigo: "TETRANGU-001",
  especieId: null,
  especie: null,
} as unknown as Colonia;

const PARAMETRO = {
  id: "p1",
  nome: "Fluxo de entrada",
  ordem: 1,
  criterioBom: "Muitas",
  criterioMedio: "Algumas",
  criterioRuim: "Poucas",
  ativo: true,
  criteriosEspecie: [],
  _count: { avaliacoesParametros: 0 },
} as Parametro;

// Avaliação salva com motivo da inspeção e motivo de uma ação.
const SALVA = {
  id: "a1",
  coloniaId: "c1",
  dataAvaliacao: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  duracaoMinutos: null,
  temperatura: null,
  umidade: null,
  condicaoClimatica: null,
  observacoesGerais: null,
  acoesTomadas: ["Troca de caixa"],
  motivoInspecao: "retorno_acao",
  motivoInspecaoDetalhe: null,
  motivosAcoes: { "Troca de caixa": "preventiva" },
  climaFonte: null,
  protocoloId: null,
  scoreGeral: 100,
  statusGeral: "excelente",
  parametros: [
    { id: "ap1", parametroId: "p1", classificacao: "bom", valorNumerico: null, observacoes: null, parametro: { id: "p1", nome: "Fluxo de entrada", ordem: 1 } },
  ],
} as AvaliacaoDetalhada;

function renderizar(avaliacao?: AvaliacaoDetalhada) {
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <FormularioAvaliacao colonia={COLONIA} parametros={[PARAMETRO]} {...(avaliacao && { avaliacao })} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  criar.mockResolvedValue({ id: "a1" } as AvaliacaoDetalhada);
  atualizar.mockResolvedValue({ id: "a1" } as AvaliacaoDetalhada);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FormularioAvaliacao: campos de contexto opcionais", () => {
  it("só Bom/Médio/Ruim: dois toques (classificar e salvar) e o payload de antes, sem chaves novas", async () => {
    renderizar();
    fireEvent.click(screen.getByRole("radio", { name: "Bom" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));
    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    const dados = criar.mock.calls[0]![1];
    expect(Object.keys(dados).sort()).toEqual(["acoesTomadas", "dataAvaliacao", "observacoesGerais", "parametros"]);
  });

  it("motivo da inspeção e motivo por ação: um toque cada; ação sem marca fica fora", async () => {
    renderizar();
    fireEvent.click(screen.getByRole("radio", { name: "Bom" }));
    fireEvent.click(screen.getByRole("button", { name: "Algo chamou atenção" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Alimentação artificial" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Limpeza realizada" }));
    const grupo = screen.getByRole("group", { name: "Motivo da ação Alimentação artificial" });
    fireEvent.click(within(grupo).getByRole("button", { name: "Resposta a um problema observado" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    expect(criar.mock.calls[0]![1]).toMatchObject({
      acoesTomadas: ["Alimentação artificial", "Limpeza realizada"],
      motivoInspecao: "problema_observado",
      motivosAcoes: { "Alimentação artificial": "resposta_problema" },
    });
  });

  it("edição: pré-preenche os motivos salvos", () => {
    renderizar(SALVA);
    expect(screen.getByRole("button", { name: "Retorno após uma ação" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Troca de caixa" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Preventiva (calendário, estação, rotina)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("edição: desmarcar os motivos salvos envia null para apagá-los", async () => {
    renderizar(SALVA);
    fireEvent.click(screen.getByRole("button", { name: "Retorno após uma ação" }));
    fireEvent.click(screen.getByRole("button", { name: "Preventiva (calendário, estação, rotina)" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1));
    expect(atualizar.mock.calls[0]![2]).toMatchObject({
      acoesTomadas: ["Troca de caixa"],
      motivoInspecao: null,
      motivosAcoes: null,
    });
  });
});
