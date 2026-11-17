import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroApi } from "../../services/api/client";
import { escritas } from "../../services/offline/escrita";
import { anexarFoto } from "../../services/offline/fotos";
import type { Colonia, Parametro } from "../../types/api";
import { FormularioAvaliacao } from "./NovaAvaliacao";

// Foto anexada a uma avaliação: vai depois do registro, por `anexarFoto` (sobe
// na hora ou fica guardada no aparelho). O detalhe recebe o aviso certo.
vi.mock("../../hooks/useDados", () => ({ chaves: { colonias: ["colonias"] }, useColonias: vi.fn(), useParametros: vi.fn() }));
vi.mock("../../services/offline/escrita", () => ({ escritas: { criarAvaliacao: vi.fn(), atualizarAvaliacao: vi.fn() } }));
vi.mock("../../services/offline/fotos", () => ({ anexarFoto: vi.fn() }));

const criar = vi.mocked(escritas.criarAvaliacao);
const anexar = vi.mocked(anexarFoto);

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

async function salvar(comFoto = true) {
  renderizar();
  fireEvent.click(screen.getByRole("radio", { name: "Bom" }));
  if (comFoto) {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));
  await screen.findByText("detalhe");
}

beforeEach(() => {
  estadoNavegado = undefined;
  criar.mockResolvedValue({ id: "a1", offline: true });
  // A prévia da foto usa object URLs, ausentes no jsdom.
  URL.createObjectURL = vi.fn(() => "blob:previa");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FormularioAvaliacao: foto depois do registro", () => {
  it("foto guardada no aparelho: o detalhe avisa que ela sobe depois", async () => {
    anexar.mockResolvedValue({ pendente: true });
    await salvar();
    expect(anexar).toHaveBeenCalledWith(expect.any(File), { avaliacaoId: "a1" });
    expect(estadoNavegado).toEqual({ nova: true, fotoFalhou: false, fotoPendente: true });
  });

  it("avaliação e foto enviadas na hora: nenhum aviso", async () => {
    criar.mockResolvedValue({ id: "a1", offline: false });
    anexar.mockResolvedValue({ pendente: false });
    await salvar();
    expect(estadoNavegado).toEqual({ nova: true, fotoFalhou: false, fotoPendente: false });
  });

  it("foto recusada: a avaliação continua salva e o detalhe avisa", async () => {
    anexar.mockRejectedValue(new ErroApi(400, "Formato não suportado. Envie JPEG, PNG ou WebP."));
    await salvar();
    expect(estadoNavegado).toEqual({ nova: true, fotoFalhou: true, fotoPendente: false });
  });

  it("sem foto: anexarFoto não é chamada", async () => {
    await salvar(false);
    expect(anexar).not.toHaveBeenCalled();
  });
});
