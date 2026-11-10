import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fotosApi } from "../../services/api/endpoints";
import { escritas } from "../../services/offline/escrita";
import type { Colonia, Parametro } from "../../types/api";
import { FormularioAvaliacao } from "./NovaAvaliacao";

// Foto anexada a uma avaliação: online sobe depois do registro; salva offline
// (na fila), a foto não é guardada e o detalhe recebe o aviso `fotoFalhou`.
vi.mock("../../hooks/useDados", () => ({ chaves: { colonias: ["colonias"] }, useColonias: vi.fn(), useParametros: vi.fn() }));
vi.mock("../../services/api/endpoints", () => ({ fotosApi: { enviar: vi.fn(async () => ({})) } }));
vi.mock("../../services/offline/escrita", () => ({ escritas: { criarAvaliacao: vi.fn(), atualizarAvaliacao: vi.fn() } }));
vi.mock("../../utils/imagem", () => ({ comprimirImagem: vi.fn(async (f: File) => f) }));

const criar = vi.mocked(escritas.criarAvaliacao);
const enviarFoto = vi.mocked(fotosApi.enviar);

const COLONIA = { id: "c1", codigo: "TETRANGU-001", especieId: null, especie: null } as unknown as Colonia;
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

let estadoNavegado: unknown;
function Detalhe() {
  estadoNavegado = useLocation().state;
  return <p>detalhe</p>;
}

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={["/nova"]}>
        <Routes>
          <Route path="/nova" element={<FormularioAvaliacao colonia={COLONIA} parametros={[PARAMETRO]} />} />
          <Route path="/app/colonias/:c/avaliacoes/:a" element={<Detalhe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function salvarComFoto() {
  renderizar();
  fireEvent.click(screen.getByRole("radio", { name: "Bom" }));
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));
  await screen.findByText("detalhe");
}

beforeEach(() => {
  estadoNavegado = undefined;
  // A prévia da foto usa object URLs, ausentes no jsdom.
  URL.createObjectURL = vi.fn(() => "blob:previa");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FormularioAvaliacao: foto e escrita offline", () => {
  it("salva offline com foto: não tenta enviar a foto e o detalhe recebe fotoFalhou", async () => {
    criar.mockResolvedValue({ id: "a1", offline: true });
    await salvarComFoto();
    expect(enviarFoto).not.toHaveBeenCalled();
    expect(estadoNavegado).toEqual({ nova: true, fotoFalhou: true });
  });

  it("salva online com foto: envia a foto ligada à avaliação", async () => {
    criar.mockResolvedValue({ id: "a1", offline: false });
    await salvarComFoto();
    await waitFor(() => expect(enviarFoto).toHaveBeenCalledWith(expect.any(File), { avaliacaoId: "a1" }));
    expect(estadoNavegado).toEqual({ nova: true, fotoFalhou: false });
  });
});
