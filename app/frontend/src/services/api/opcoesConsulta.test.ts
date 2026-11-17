import { onlineManager, QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroApi } from "./client";
import { deveRetentar, opcoesConsulta } from "./opcoesConsulta";

const conexao = { online: true };
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => conexao.online });
afterAll(() => {
  delete (navigator as { onLine?: boolean }).onLine;
});

beforeEach(() => {
  conexao.online = true;
});
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

const semConexao = () => new ErroApi(0, "Sem conexão com o servidor.");

describe("deveRetentar", () => {
  it("erro de conexão sem rede: não retenta", () => {
    conexao.online = false;
    expect(deveRetentar(0, semConexao())).toBe(false);
  });

  it("erro de conexão com rede (servidor fora): retenta até 2 vezes", () => {
    expect(deveRetentar(0, semConexao())).toBe(true);
    expect(deveRetentar(1, semConexao())).toBe(true);
    expect(deveRetentar(2, semConexao())).toBe(false);
  });

  it("4xx não retenta; 5xx retenta", () => {
    expect(deveRetentar(0, new ErroApi(404, "Colônia não encontrada"))).toBe(false);
    expect(deveRetentar(0, new ErroApi(500, "Erro interno"))).toBe(true);
  });
});

describe("opcoesConsulta", () => {
  it("refaz as queries ao reconectar e não pausa mutações sem rede", () => {
    expect(opcoesConsulta.queries?.refetchOnReconnect).toBe("always");
    expect(opcoesConsulta.queries?.networkMode).toBe("always");
    expect(opcoesConsulta.mutations?.networkMode).toBe("always");
  });

  it("sem rede, uma useQuery com estas opções roda o queryFn (não fica pausada)", async () => {
    conexao.online = false;
    onlineManager.setOnline(false);
    const client = new QueryClient({ defaultOptions: opcoesConsulta });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const queryFn = vi.fn(async () => "da cópia local");

    const { result } = renderHook(() => useQuery({ queryKey: ["teste"], queryFn }), { wrapper });

    await waitFor(() => expect(result.current.data).toBe("da cópia local"));
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(result.current.fetchStatus).toBe("idle");
  });
});
