import type {
  ArquivoParametros,
  RespostaAlertas,
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
  Meliponario,
  MeliponarioInput,
  ModoAplicacao,
  Parametro,
  ParametroInput,
  Producao,
  ProducaoInput,
  RespostaAuth,
  ResumoAplicacao,
  ResumoProducao,
  TemplateParametros,
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

export const usuariosApi = {
  atualizarPerfil: (dados: { name?: string; email?: string }) => api.patch<Usuario>("/users/me", dados),
  // PUT: cria o meliponário na primeira vez, atualiza depois (relação 1:1).
  salvarMeliponario: (dados: MeliponarioInput) => api.put<Meliponario>("/users/me/meliponario", dados),
  alterarSenha: (senhaAtual: string, novaSenha: string) => api.put<void>("/users/me/senha", { senhaAtual, novaSenha }),
  // Apaga a conta e todos os dados (LGPD). Senha errada → 400.
  excluirConta: (senha: string) => api.delete("/users/me", { senha }),
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
  templates: () => api.get<TemplateParametros[]>("/parametros/templates"),
  aplicarTemplate: (id: string, modo: ModoAplicacao) =>
    api.post<ResumoAplicacao>(`/parametros/templates/${id}/aplicar`, { modo }),
  importar: (dados: ArquivoParametros, modo: ModoAplicacao) =>
    api.post<ResumoAplicacao>("/parametros/importar", { modo, dados }),
  exportar: () => baixarArquivo("/parametros/exportar", "corbicula-parametros.json"),
};

export const alertasApi = {
  listar: (filtros: { diasSemInspecao: number; incluirResolvidos?: boolean }) =>
    api.get<RespostaAlertas>(
      `/alertas?diasSemInspecao=${filtros.diasSemInspecao}${filtros.incluirResolvidos ? "&incluirResolvidos=true" : ""}`
    ),
  resolver: (chave: string) => api.post<void>("/alertas/resolvidos", { chave }),
  reabrir: (chave: string) => api.delete("/alertas/resolvidos", { chave }),
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
  colonias: (formato: "csv" | "json" = "csv") =>
    baixarArquivo(`/exportacao/colonias?formato=${formato}`, `corbicula_colonias.${formato}`),
  // Todos os dados do usuário em um JSON (sem os arquivos de fotos, só as URLs).
  backup: () => baixarArquivo("/exportacao/backup", "corbicula_backup.json"),
  // A exportação aceita colônia, status e período (não o filtro por parâmetro).
  avaliacoes: ({ parametroId: _p, classificacao: _c, ...filtros }: FiltrosAvaliacoes, formato: "csv" | "json" = "csv") =>
    baixarArquivo(`/exportacao/avaliacoes${consulta({ ...filtros, formato })}`, `corbicula_avaliacoes.${formato}`),
  producoes: (filtros: FiltrosProducao, formato: "csv" | "json" = "csv") =>
    baixarArquivo(`/exportacao/producoes${consulta({ ...filtros, formato })}`, `corbicula_producoes.${formato}`),
};
