import { useQuery } from "@tanstack/react-query";
import { avaliacoesApi, coloniasApi, especiesApi, fotosApi, parametrosApi, producoesApi } from "../services/api/endpoints";
import type { FiltrosProducao } from "../types/api";

// Chaves de cache centralizadas — usadas também para invalidar após mutações.
export const chaves = {
  colonias: ["colonias"] as const,
  colonia: (id: string) => ["colonias", id] as const,
  avaliacoes: (coloniaId: string) => ["colonias", coloniaId, "avaliacoes"] as const,
  avaliacao: (coloniaId: string, id: string) => ["colonias", coloniaId, "avaliacoes", id] as const,
  parametros: ["parametros"] as const,
  especies: ["especies"] as const,
  fotos: (filtro: object) => ["fotos", filtro] as const,
  producoes: ["producoes"] as const,
  listaProducoes: (filtros: FiltrosProducao) => ["producoes", "lista", filtros] as const,
  resumoProducao: (filtros: FiltrosProducao) => ["producoes", "resumo", filtros] as const,
  producao: (id: string) => ["producoes", id] as const,
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

export const useFotos = (filtro: { coloniaId?: string; avaliacaoId?: string; producaoId?: string }) =>
  useQuery({ queryKey: chaves.fotos(filtro), queryFn: () => fotosApi.listar(filtro) });

export const useProducoes = (filtros: FiltrosProducao = {}) =>
  useQuery({ queryKey: chaves.listaProducoes(filtros), queryFn: () => producoesApi.listar(filtros) });

export const useResumoProducao = (filtros: FiltrosProducao = {}) =>
  useQuery({ queryKey: chaves.resumoProducao(filtros), queryFn: () => producoesApi.resumo(filtros) });

export const useProducao = (id: string) =>
  useQuery({ queryKey: chaves.producao(id), queryFn: () => producoesApi.buscar(id), enabled: Boolean(id) });
