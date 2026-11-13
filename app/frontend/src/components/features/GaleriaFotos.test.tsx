import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFotos } from "../../hooks/useDados";
import { anexarFoto, fotosGuardadas } from "../../services/offline/fotos";
import type { FotoPendente } from "../../services/offline/tipos";
import { GaleriaFotos } from "./GaleriaFotos";

// Galeria: fotos do servidor + as guardadas no aparelho esperando envio.
vi.mock("../../hooks/useDados", () => ({ useFotos: vi.fn() }));
vi.mock("../../services/offline/fotos", () => ({ anexarFoto: vi.fn(), fotosGuardadas: vi.fn(), idDoVinculo: () => "c1" }));

const guardada = (parcial: Partial<FotoPendente> = {}): FotoPendente => ({
  id: "f1",
  vinculo: { coloniaId: "c1" },
  entidadeId: "c1",
  bytes: new Uint8Array([1, 2, 3]).buffer,
  tipo: "image/jpeg",
  criadoEm: "2026-11-10T12:00:00.000Z",
  estado: "pendente",
  tentativas: 0,
  ...parcial,
});

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <GaleriaFotos vinculo={{ coloniaId: "c1" }} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.mocked(useFotos).mockReturnValue({ data: [], error: null } as never);
  URL.createObjectURL = vi.fn(() => "blob:guardada");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GaleriaFotos", () => {
  it("mostra as fotos guardadas como aguardando envio, ou paradas", async () => {
    vi.mocked(fotosGuardadas).mockResolvedValue([guardada(), guardada({ id: "f2", estado: "erro", ultimoErro: "Formato não suportado." })]);
    renderizar();
    expect(await screen.findByText("Aguardando envio")).toBeInTheDocument();
    expect(screen.getByText("Não enviada")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma foto.")).not.toBeInTheDocument();
  });

  it("sem fotos: 'Nenhuma foto.'; adicionar offline usa anexarFoto e a foto guardada aparece", async () => {
    vi.mocked(fotosGuardadas).mockResolvedValueOnce([]).mockResolvedValue([guardada()]);
    vi.mocked(anexarFoto).mockResolvedValue({ pendente: true });
    renderizar();
    expect(await screen.findByText("Nenhuma foto.")).toBeInTheDocument();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(anexarFoto).toHaveBeenCalledWith(expect.any(File), { coloniaId: "c1" }));
    expect(await screen.findByText("Aguardando envio")).toBeInTheDocument();
  });

  it("releitura da galeria não refaz a prévia de uma foto que já estava na tela", async () => {
    vi.mocked(fotosGuardadas).mockResolvedValue([guardada()]);
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={cliente}>
        <GaleriaFotos vinculo={{ coloniaId: "c1" }} />
      </QueryClientProvider>
    );
    await screen.findByText("Aguardando envio");
    await cliente.invalidateQueries({ queryKey: ["fotos"] });
    await waitFor(() => expect(fotosGuardadas).toHaveBeenCalledTimes(2));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });
});
