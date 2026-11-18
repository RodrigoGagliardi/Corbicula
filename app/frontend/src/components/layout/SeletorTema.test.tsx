import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "../../store/auth";
import { usePreferencias } from "../../store/preferencias";
import { LayoutPublico } from "./LayoutPublico";
import { SeletorTema } from "./SeletorTema";

beforeEach(() => {
  usePreferencias.setState({ tema: "sistema" });
  useAuth.setState({ token: null, usuario: null });
});
afterEach(cleanup);

describe("SeletorTema", () => {
  it("Claro, Escuro e Sistema lado a lado; marca o atual e troca a preferência", () => {
    render(<SeletorTema variante="pagina" />);
    const grupo = screen.getByRole("radiogroup", { name: "Tema" });
    const opcoes = within(grupo).getAllByRole("radio");
    expect(opcoes.map((o) => o.textContent)).toEqual(["Claro", "Escuro", "Sistema"]);
    expect(within(grupo).getByRole("radio", { name: "Sistema" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(grupo).getByRole("radio", { name: "Escuro" }));
    expect(usePreferencias.getState().tema).toBe("escuro");
    expect(within(grupo).getByRole("radio", { name: "Escuro" })).toHaveAttribute("aria-checked", "true");
    expect(within(grupo).getByRole("radio", { name: "Sistema" })).toHaveAttribute("aria-checked", "false");
  });

  it("aparece no cabeçalho das páginas públicas, sem estar logado", () => {
    render(
      <MemoryRouter>
        <LayoutPublico />
      </MemoryRouter>
    );
    const cabecalho = screen.getByRole("navigation", { name: "Site" });
    expect(within(cabecalho).getByRole("radiogroup", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toBeInTheDocument();
  });
});
