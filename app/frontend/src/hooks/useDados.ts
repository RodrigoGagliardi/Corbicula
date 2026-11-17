import { useQuery } from "@tanstack/react-query";
import { alertasApi, authApi, avaliacoesApi, coloniasApi, especiesApi, fotosApi, parametrosApi, producoesApi } from "../services/api/endpoints";
import { comFallback, comFallbackLocal, leiturasLocais } from "../services/offline/leituraLocal";
import { useAuth } from "../store/auth";
import { usePreferencias } from "../store/preferencias";
import type { FiltrosAvaliacoes, FiltrosProducao } from "../types/api";

// Leituras com cópia no banco local (colônias, avaliações, parâmetros, espécies,
// produções) caem para ele sem conexão (`comFallbackLocal`); online, a fonte é a
// API. Alertas, resumo de produção, templates e fotos vêm só do servidor.

// Chaves de cache centralizadas — usadas também para invalidar após mutações.
export const chaves = {
  eu: ["eu"] as const,
  colonias: ["colonias"] as const,
  colonia: (id: string) => ["colonias", id] as const,
  avaliacoes: (coloniaId: string) => ["colonias", coloniaId, "avaliacoes"] as const,
  avaliacao: (coloniaId: string, id: string) => ["colonias", coloniaId, "avaliacoes", id] as const,
  // Sob "colonias" de propósito: toda mutação que invalida as colônias
  // (nova avaliação, edição, exclusão, código da colônia) atualiza o histórico.
  historicoAvaliacoes: (filtros: FiltrosAvaliacoes) => ["colonias", "historico-avaliacoes", filtros] as const,
  parametros: ["parametros"] as const,
  // Sob "colonias": nova avaliação, edição ou exclusão recalculam os alertas.
  alertas: (filtros: object) => ["colonias", "alertas", filtros] as const,
  templatesParametros: ["parametros", "templates"] as const,
  especies: ["especies"] as const,
  fotos: (filtro: object) => ["fotos", filtro] as const,
  producoes: ["producoes"] as const,
  listaProducoes: (filtros: FiltrosProducao) => ["producoes", "lista", filtros] as const,
  resumoProducao: (filtros: FiltrosProducao) => ["producoes", "resumo", filtros] as const,
  producao: (id: string) => ["producoes", id] as const,
};

// Perfil + meliponário. Mantém a sessão (store) em dia, já que o layout e o
// dashboard leem o nome do usuário e do meliponário de lá. Sem conexão, vale o
// perfil guardado na sessão.
export const useEu = () =>
  useQuery({
    queryKey: chaves.eu,
    queryFn: () =>
      comFallback(
        async () => {
          const usuario = await authApi.eu();
          useAuth.getState().atualizarUsuario(usuario);
          return usuario;
        },
        async (erro) => {
          const usuario = useAuth.getState().usuario;
          if (!usuario) throw erro;
          return usuario;
        }
      ),
  });

export const useColonias = () =>
  useQuery({ queryKey: chaves.colonias, queryFn: () => comFallbackLocal(coloniasApi.listar, leiturasLocais.colonias) });

export const useColonia = (id: string) =>
  useQuery({
    queryKey: chaves.colonia(id),
    queryFn: () => comFallbackLocal(() => coloniasApi.buscar(id), (db) => leiturasLocais.colonia(db, id)),
    enabled: Boolean(id),
  });

export const useAvaliacoes = (coloniaId: string) =>
  useQuery({
    queryKey: chaves.avaliacoes(coloniaId),
    queryFn: () => comFallbackLocal(() => avaliacoesApi.listar(coloniaId), (db) => leiturasLocais.avaliacoes(db, coloniaId)),
    enabled: Boolean(coloniaId),
  });

export const useHistoricoAvaliacoes = (filtros: FiltrosAvaliacoes = {}) =>
  useQuery({
    queryKey: chaves.historicoAvaliacoes(filtros),
    queryFn: () =>
      comFallbackLocal(() => avaliacoesApi.historico(filtros), (db) => leiturasLocais.historicoAvaliacoes(db, filtros)),
  });

export const useAvaliacao = (coloniaId: string, id: string) =>
  useQuery({
    queryKey: chaves.avaliacao(coloniaId, id),
    queryFn: () =>
      comFallbackLocal(() => avaliacoesApi.buscar(coloniaId, id), (db) => leiturasLocais.avaliacao(db, coloniaId, id)),
  });

export const useParametros = () =>
  useQuery({ queryKey: chaves.parametros, queryFn: () => comFallbackLocal(parametrosApi.listar, leiturasLocais.parametros) });

// Templates são estáticos no servidor (mudam só com nova versão do app).
export const useTemplatesParametros = () =>
  useQuery({ queryKey: chaves.templatesParametros, queryFn: parametrosApi.templates, staleTime: Infinity });

// Catálogo fixo: praticamente nunca muda durante a sessão.
export const useEspecies = () =>
  useQuery({
    queryKey: chaves.especies,
    queryFn: () => comFallbackLocal(especiesApi.listar, leiturasLocais.especies),
    staleTime: Infinity,
  });

// Fotos não têm cópia local: sem conexão, a query falha com o erro de conexão.
export const useFotos = (filtro: { coloniaId?: string; avaliacaoId?: string; producaoId?: string }) =>
  useQuery({ queryKey: chaves.fotos(filtro), queryFn: () => fotosApi.listar(filtro) });

export const useProducoes = (filtros: FiltrosProducao = {}) =>
  useQuery({
    queryKey: chaves.listaProducoes(filtros),
    queryFn: () => comFallbackLocal(() => producoesApi.listar(filtros), (db) => leiturasLocais.producoes(db, filtros)),
  });

// Agregação do servidor: não é recalculada offline (uma metodologia só).
export const useResumoProducao = (filtros: FiltrosProducao = {}) =>
  useQuery({ queryKey: chaves.resumoProducao(filtros), queryFn: () => producoesApi.resumo(filtros) });

export const useProducao = (id: string) =>
  useQuery({
    queryKey: chaves.producao(id),
    queryFn: () => comFallbackLocal(() => producoesApi.buscar(id), (db) => leiturasLocais.producao(db, id)),
    enabled: Boolean(id),
  });

// Alertas calculados no servidor com a preferência de "inspeção atrasada"
// deste navegador (a frequência de cada colônia tem prioridade). Sem conexão,
// fica o último resultado da sessão, se houver.
export const useAlertas = (incluirResolvidos = false) => {
  const diasSemInspecao = usePreferencias((s) => s.diasInspecaoAtrasada);
  const filtros = { diasSemInspecao, incluirResolvidos };
  return useQuery({ queryKey: chaves.alertas(filtros), queryFn: () => alertasApi.listar(filtros) });
};
