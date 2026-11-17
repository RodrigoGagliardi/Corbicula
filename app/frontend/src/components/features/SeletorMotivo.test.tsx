import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { StatusColonia } from "../../types/api";
import { MOTIVOS_STATUS, motivosDoStatus, type MotivoStatusCodigo } from "../../utils/vocabularios";
import { SeletorMotivo } from "./SeletorMotivo";

afterEach(cleanup);

function MotivoDoStatus({ status }: { status: StatusColonia }) {
  const [motivo, setMotivo] = useState<MotivoStatusCodigo | null>(null);
  return (
    <>
      <SeletorMotivo
        rotulo="Motivo"
        opcoes={motivosDoStatus(status).map((m) => ({ codigo: m, rotulo: MOTIVOS_STATUS[m].rotulo }))}
        valor={motivo}
        onChange={setMotivo}
      />
      <output>{motivo ?? "nenhum"}</output>
    </>
  );
}

describe("SeletorMotivo", () => {
  it("mostra só os motivos compatíveis com o status (ativa: recuperada, correção e outro)", () => {
    render(<MotivoDoStatus status="ativa" />);
    const opcoes = screen.getAllByRole("button").map((b) => b.textContent);
    expect(opcoes).toEqual(["Voltou a ser ativa", "Correção de registro", "Outro (texto)"]);
  });

  it("nada marcado por padrão; um toque marca, outro toque desmarca", () => {
    render(<MotivoDoStatus status="morta" />);
    const fome = screen.getByRole("button", { name: "Fome / falta de alimento" });
    expect(screen.getByRole("group", { name: "Motivo" })).toBeInTheDocument();
    expect(fome).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("nenhum")).toBeInTheDocument();

    fireEvent.click(fome);
    expect(fome).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("fome_escassez")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Frio" }));
    expect(fome).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("frio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Frio" }));
    expect(screen.getByText("nenhum")).toBeInTheDocument();
  });
});
