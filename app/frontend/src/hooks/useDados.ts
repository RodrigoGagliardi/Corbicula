import { useQuery } from "@tanstack/react-query";
import { avaliacoesApi, coloniasApi, especiesApi, fotosApi, parametrosApi } from "../services/api/endpoints";

// Chaves de cache centralizadas — usadas também para invalidar após mutações.
export const chaves = {
  colonias: ["colonias"] as const,
  colonia: (id: string) => ["colonias", id] as const,
  avaliacoes: (coloniaId: string) => ["colonias", coloniaId, "avaliacoes"] as const,
  avaliacao: (coloniaId: string, id: string) => ["colonias", coloniaId, "avaliacoes", id] as const,
  parametros: ["parametros"] as const,
  especies: ["especies"] as const,
  fotos: (filtro: object) => ["fotos", filtro] as const,
};

export const useColonias = () => useQuery({ queryKey: chaves.colonias, queryFn: coloniasApi.listar });

export const useColonia = (id: string) =>
  useQuery({ queryKey: chaves.colonia(id), queryFn: () => coloniasApi.buscar(id), enabled: Boolean(id) });

export const useAvaliacoes = (coloniaId: string) =>
  useQuery({
    queryKey: chaves.avaliacoes(coloniaId),
    queryFn: () => avaliacoesApi.listar(coloniaId),
    enabled: Boolean(coloniaId),
  });

export const useAvaliacao = (coloniaId: string, id: string) =>
  useQuery({ queryKey: chaves.avaliacao(coloniaId, id), queryFn: () => avaliacoesApi.buscar(coloniaId, id) });

export const useParametros = () => useQuery({ queryKey: chaves.parametros, queryFn: parametrosApi.listar });

// Catálogo fixo: praticamente nunca muda durante a sessão.
export const useEspecies = () =>
  useQuery({ queryKey: chaves.especies, queryFn: especiesApi.listar, staleTime: Infinity });

export const useFotos = (filtro: { coloniaId?: string; avaliacaoId?: string }) =>
  useQuery({ queryKey: chaves.fotos(filtro), queryFn: () => fotosApi.listar(filtro) });
