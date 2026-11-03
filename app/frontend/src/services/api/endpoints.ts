import type {
  AvaliacaoDetalhada,
  AvaliacaoHistorico,
  AvaliacaoInput,
  AvaliacaoLista,
  Colonia,
  ColoniaDetalhada,
  ColoniaInput,
  Especie,
  FiltrosAvaliacoes,
  FiltrosProducao,
  Foto,
  Parametro,
  ParametroInput,
  Producao,
  ProducaoInput,
  RespostaAuth,
  ResumoProducao,
  Usuario,
} from "../../types/api";
import { api, baixarArquivo } from "./client";

// Query string só com os filtros preenchidos.
const consulta = (filtros: object) => {
  const qs = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v !== undefined && v !== "") as [string, string][]
  ).toString();
  return qs ? `?${qs}` : "";
};

export const authApi = {
  entrar: (email: string, password: string) => api.post<RespostaAuth>("/auth/login", { email, password }),
  cadastrar: (dados: { name: string; email: string; password: string; meliponario?: { nome: string } }) =>
    api.post<RespostaAuth>("/auth/register", dados),
  eu: () => api.get<Usuario>("/users/me"),
};

export const especiesApi = {
  listar: () => api.get<Especie[]>("/especies"),
};

export const coloniasApi = {
  listar: () => api.get<Colonia[]>("/colonias"),
  buscar: (id: string) => api.get<ColoniaDetalhada>(`/colonias/${id}`),
  criar: (dados: ColoniaInput) => api.post<ColoniaDetalhada>("/colonias", dados),
  atualizar: (id: string, dados: Partial<ColoniaInput>) => api.patch<ColoniaDetalhada>(`/colonias/${id}`, dados),
  excluir: (id: string) => api.delete(`/colonias/${id}`),
};

export const avaliacoesApi = {
  historico: (filtros: FiltrosAvaliacoes = {}) => api.get<AvaliacaoHistorico[]>(`/avaliacoes${consulta(filtros)}`),
  listar: (coloniaId: string) => api.get<AvaliacaoLista[]>(`/colonias/${coloniaId}/avaliacoes`),
  buscar: (coloniaId: string, id: string) =>
    api.get<AvaliacaoDetalhada>(`/colonias/${coloniaId}/avaliacoes/${id}`),
  criar: (coloniaId: string, dados: AvaliacaoInput) =>
    api.post<AvaliacaoDetalhada>(`/colonias/${coloniaId}/avaliacoes`, dados),
  // Só nos primeiros 7 dias após o registro (o servidor responde 409 depois).
  atualizar: (coloniaId: string, id: string, dados: Partial<AvaliacaoInput>) =>
    api.patch<AvaliacaoDetalhada>(`/colonias/${coloniaId}/avaliacoes/${id}`, dados),
  excluir: (coloniaId: string, id: string) => api.delete(`/colonias/${coloniaId}/avaliacoes/${id}`),
};

export const parametrosApi = {
  listar: () => api.get<Parametro[]>("/parametros"),
  criar: (dados: ParametroInput) => api.post<Parametro>("/parametros", dados),
  atualizar: (id: string, dados: Partial<ParametroInput>) => api.patch<Parametro>(`/parametros/${id}`, dados),
  excluir: (id: string) => api.delete(`/parametros/${id}`),
};

export const fotosApi = {
  listar: (filtro: { coloniaId?: string; avaliacaoId?: string; producaoId?: string }) => {
    const qs = new URLSearchParams(filtro as Record<string, string>).toString();
    return api.get<Foto[]>(`/fotos?${qs}`);
  },
  enviar: (arquivo: Blob, vinculo: Record<string, string>, legenda?: string) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(vinculo)) form.append(k, v);
    if (legenda) form.append("legenda", legenda);
    form.append("arquivo", arquivo, "foto.jpg");
    return api.post<Foto>("/fotos", form);
  },
};

export const producoesApi = {
  listar: (filtros: FiltrosProducao = {}) => api.get<Producao[]>(`/producoes${consulta(filtros)}`),
  resumo: (filtros: FiltrosProducao = {}) => api.get<ResumoProducao>(`/producoes/resumo${consulta(filtros)}`),
  buscar: (id: string) => api.get<Producao>(`/producoes/${id}`),
  criar: (dados: ProducaoInput) => api.post<Producao>("/producoes", dados),
  atualizar: (id: string, dados: Partial<Omit<ProducaoInput, "coloniaId">>) => api.patch<Producao>(`/producoes/${id}`, dados),
  excluir: (id: string) => api.delete(`/producoes/${id}`),
};

export const exportacaoApi = {
  // A exportação aceita colônia, status e período (não o filtro por parâmetro).
  avaliacoes: ({ parametroId: _p, classificacao: _c, ...filtros }: FiltrosAvaliacoes, formato: "csv" | "json" = "csv") =>
    baixarArquivo(`/exportacao/avaliacoes${consulta({ ...filtros, formato })}`, `corbicula_avaliacoes.${formato}`),
  producoes: (filtros: FiltrosProducao, formato: "csv" | "json" = "csv") =>
    baixarArquivo(`/exportacao/producoes${consulta({ ...filtros, formato })}`, `corbicula_producoes.${formato}`),
};
