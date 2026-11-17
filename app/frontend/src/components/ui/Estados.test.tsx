import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { ErroApi } from "../../services/api/client";
import { AvisoSemConexao, ErroCarregamento } from "./Estados";

const conexao = { online: true };
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => conexao.online });
afterAll(() => {
  delete (navigator as { onLine?: boolean }).onLine;
});
afterEach(() => {
  cleanup();
  conexao.online = true;
});

const semConexao = () => new ErroApi(0, "Sem conexão com o servidor.");

describe("ErroCarregamento", () => {
  it("erro de conexão sem rede: diz que a informação precisa de conexão", () => {
    conexao.online = false;
    render(<ErroCarregamento erro={semConexao()} />);
    expect(screen.getByText("Sem conexão com o servidor")).toBeInTheDocument();
    expect(screen.getByText(/precisa de conexão para carregar/)).toBeInTheDocument();
  });

  it("erro de conexão com o navegador online: o servidor não respondeu", () => {
    render(<ErroCarregamento erro={semConexao()} />);
    expect(screen.getByText("Servidor indisponível")).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível falar com o servidor/)).toBeInTheDocument();
    expect(screen.queryByText(/quando o app estiver online/)).not.toBeInTheDocument();
  });

  it("outros erros: a mensagem da API", () => {
    render(<ErroCarregamento erro={new ErroApi(404, "Colônia não encontrada")} />);
    expect(screen.getByText("Colônia não encontrada")).toBeInTheDocument();
  });
});

describe("AvisoSemConexao", () => {
  it("aparece só sem rede", () => {
    const { rerender } = render(<AvisoSemConexao>exige conexão</AvisoSemConexao>);
    expect(screen.queryByText("exige conexão")).not.toBeInTheDocument();
    conexao.online = false;
    rerender(<AvisoSemConexao>exige conexão</AvisoSemConexao>);
    expect(screen.getByText("exige conexão")).toBeInTheDocument();
  });
});
