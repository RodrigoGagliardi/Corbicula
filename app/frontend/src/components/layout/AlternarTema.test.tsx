import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "../../store/auth";
import { usePreferencias } from "../../store/preferencias";
import { AlternarTema } from "./AlternarTema";
import { LayoutPublico } from "./LayoutPublico";

beforeEach(() => {
  usePreferencias.setState({ tema: "sistema" });
  useAuth.setState({ token: null, usuario: null });
});
afterEach(cleanup);

describe("AlternarTema", () => {
  it("alterna Sistema → Claro → Escuro → Sistema, anunciando o atual e o próximo", () => {
    render(<AlternarTema />);
    const botao = () => screen.getByRole("button", { name: /^Tema:/ });
    expect(botao()).toHaveAccessibleName("Tema: Sistema. Mudar para claro");

    fireEvent.click(botao());
    expect(usePreferencias.getState().tema).toBe("claro");
    expect(botao()).toHaveAccessibleName("Tema: Claro. Mudar para escuro");

    fireEvent.click(botao());
    expect(usePreferencias.getState().tema).toBe("escuro");

    fireEvent.click(botao());
    expect(usePreferencias.getState().tema).toBe("sistema");
  });

  it("aparece no cabeçalho das páginas públicas, sem estar logado", () => {
    render(
      <MemoryRouter>
        <LayoutPublico />
      </MemoryRouter>
    );
    const cabecalho = screen.getByRole("navigation", { name: "Site" });
    expect(cabecalho).toContainElement(screen.getByRole("button", { name: /^Tema:/ }));
    expect(screen.getByRole("link", { name: "Entrar" })).toBeInTheDocument();
  });
});
