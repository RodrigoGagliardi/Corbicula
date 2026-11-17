import type { DefaultOptions } from "@tanstack/react-query";
import { ehErroDeConexao, semRede } from "../offline/leituraLocal";
import { ErroApi } from "./client";

// Erros 4xx não melhoram com nova tentativa; falhas de rede sim, mas não sem
// rede (o erro de conexão aí já é a resposta: não há cópia local).
export function deveRetentar(tentativas: number, erro: unknown): boolean {
  return (
    tentativas < 2 &&
    !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) &&
    !(ehErroDeConexao(erro) && semRede())
  );
}

// Opções padrão do QueryClient (main.tsx).
export const opcoesConsulta: DefaultOptions = {
  queries: {
    staleTime: 30_000,
    // As queries rodam também sem rede: as leituras com cópia local respondem
    // do banco local (hooks/useDados.ts), em vez de ficarem pausadas.
    networkMode: "always",
    // Com networkMode "always" o TanStack desliga o refetch ao reconectar; ao
    // voltar a rede, os dados da cópia local e as telas de erro de conexão
    // precisam vir de novo da API.
    refetchOnReconnect: "always",
    retry: deveRetentar,
  },
  mutations: {
    // Escritas sem rede falham na hora com ErroApi(0), em vez de ficarem
    // pausadas e dispararem depois sozinhas (ex.: excluir a conta).
    networkMode: "always",
  },
};
