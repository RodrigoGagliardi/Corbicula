import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useColonias, useProducao } from "../../hooks/useDados";
import { ErroApi } from "../../services/api/client";
import { escritas } from "../../services/offline/escrita";
import { anexarFoto } from "../../services/offline/fotos";
import type { Colonia } from "../../types/api";
import { FormColheita } from "./FormColheita";

// Foto da nova colheita: vai depois do registro, por `anexarFoto`, com o vínculo
// da colheita; o aviso depende de a foto ter subido, ficado guardada ou falhado.
vi.mock("../../hooks/useDados", () => ({
  chaves: { producoes: ["producoes"], colonias: ["colonias"] },
  useColonias: vi.fn(),
  useProducao: vi.fn(),
}));
vi.mock("../../services/offline/escrita", () => ({ escritas: { criarProducao: vi.fn(), atualizarProducao: vi.fn() } }));
vi.mock("../../services/offline/fotos", () => ({ anexarFoto: vi.fn() }));
vi.mock("../../components/features/GaleriaFotos", () => ({ GaleriaFotos: () => null }));

const COLONIA = { id: "c1", codigo: "TETRANGU-001", status: "ativa", especie: null } as unknown as Colonia;

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={["/app/producao/nova?colonia=c1"]}>
        <Routes>
          <Route path="/app/producao/nova" element={<FormColheita />} />
          <Route path="/app/producao" element={<p>historico</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function salvarComFoto() {
  renderizar();
  fireEvent.change(screen.getByLabelText(/Quantidade/), { target: { value: "120" } });
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] } });
  fireEvent.submit(document.querySelector("form")!);
  await screen.findByText("historico");
}

const alerta = vi.fn();
beforeEach(() => {
  vi.mocked(useColonias).mockReturnValue({ data: [COLONIA], isLoading: false } as never);
  vi.mocked(useProducao).mockReturnValue({ data: undefined, isLoading: false } as never);
  vi.mocked(escritas.criarProducao).mockResolvedValue({ id: "p1", offline: true });
  window.alert = alerta;
  URL.createObjectURL = vi.fn(() => "blob:previa");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FormColheita: foto depois do registro", () => {
  it("foto guardada no aparelho: liga à colheita e avisa que sobe depois", async () => {
    vi.mocked(anexarFoto).mockResolvedValue({ pendente: true });
    await salvarComFoto();
    expect(anexarFoto).toHaveBeenCalledWith(expect.any(File), { producaoId: "p1" });
    await waitFor(() => expect(alerta).toHaveBeenCalledWith(expect.stringContaining("guardada no aparelho")));
  });

  it("foto recusada: a colheita continua salva e o aviso de falha aparece", async () => {
    vi.mocked(anexarFoto).mockRejectedValue(new ErroApi(400, "Formato não suportado."));
    await salvarComFoto();
    await waitFor(() => expect(alerta).toHaveBeenCalledWith(expect.stringContaining("não pôde ser enviada")));
  });

  it("foto enviada na hora: nenhum aviso", async () => {
    vi.mocked(escritas.criarProducao).mockResolvedValue({ id: "p1", offline: false });
    vi.mocked(anexarFoto).mockResolvedValue({ pendente: false });
    await salvarComFoto();
    expect(alerta).not.toHaveBeenCalled();
  });
});
