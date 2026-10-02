import type {
  AvaliacaoDetalhada,
  AvaliacaoInput,
  AvaliacaoLista,
  Colonia,
  ColoniaDetalhada,
  ColoniaInput,
  Especie,
  Foto,
  Parametro,
  ParametroInput,
  RespostaAuth,
  Usuario,
} from "../../types/api";
import { api } from "./client";

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
  listar: (coloniaId: string) => api.get<AvaliacaoLista[]>(`/colonias/${coloniaId}/avaliacoes`),
  buscar: (coloniaId: string, id: string) =>
    api.get<AvaliacaoDetalhada>(`/colonias/${coloniaId}/avaliacoes/${id}`),
  criar: (coloniaId: string, dados: AvaliacaoInput) =>
    api.post<AvaliacaoDetalhada>(`/colonias/${coloniaId}/avaliacoes`, dados),
  excluir: (coloniaId: string, id: string) => api.delete(`/colonias/${coloniaId}/avaliacoes/${id}`),
};

export const parametrosApi = {
  listar: () => api.get<Parametro[]>("/parametros"),
  criar: (dados: ParametroInput) => api.post<Parametro>("/parametros", dados),
  atualizar: (id: string, dados: Partial<ParametroInput>) => api.patch<Parametro>(`/parametros/${id}`, dados),
  excluir: (id: string) => api.delete(`/parametros/${id}`),
};

export const fotosApi = {
  listar: (filtro: { coloniaId?: string; avaliacaoId?: string }) => {
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
