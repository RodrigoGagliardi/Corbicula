import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify/types/instance";
import { buildApp } from "../src/app";

// PNG 1×1 válido — suficiente para testar upload sem arquivos de fixture.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

export async function criarApp(): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface Resposta<T = any> {
  status: number;
  body: T;
  texto: string;
  headers: Record<string, unknown>;
}

// Cliente HTTP autenticado sobre app.inject (sem rede, sem porta aberta).
export function cliente(app: FastifyInstance, token?: string) {
  async function req<T = any>(metodo: Metodo, url: string, payload?: unknown): Promise<Resposta<T>> {
    const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    const res = await app.inject({
      method: metodo,
      url,
      headers,
      ...(payload !== undefined && { payload: payload as never }),
    });
    let body: any = res.body;
    try {
      body = res.json();
    } catch {
      // resposta não-JSON (CSV, 204 etc.)
    }
    return { status: res.statusCode, body, texto: res.body, headers: res.headers };
  }

  return {
    get: <T = any>(url: string) => req<T>("GET", url),
    post: <T = any>(url: string, body?: unknown) => req<T>("POST", url, body),
    patch: <T = any>(url: string, body?: unknown) => req<T>("PATCH", url, body),
    put: <T = any>(url: string, body?: unknown) => req<T>("PUT", url, body),
    delete: <T = any>(url: string) => req<T>("DELETE", url),
  };
}

export type Cliente = ReturnType<typeof cliente>;

// Cria um usuário novo (e-mail único) e devolve um cliente autenticado.
// Cada teste/arquivo trabalha com seus próprios usuários → isolamento de dados.
export async function novoUsuario(app: FastifyInstance) {
  const email = `teste-${randomUUID()}@corbicula.test`;
  const res = await cliente(app).post("/auth/register", {
    name: "Usuária de Teste",
    email,
    password: "senha123",
  });
  if (res.status !== 201) throw new Error(`register falhou: ${res.status} ${res.texto}`);
  return { api: cliente(app, res.body.token), userId: res.body.user.id as string, email };
}

export async function criarParametros(api: Cliente, quantidade = 3) {
  const ids: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    const res = await api.post("/parametros", {
      nome: `Parâmetro ${i + 1}`,
      ordem: i,
      criterioBom: "bom",
      criterioMedio: "médio",
      criterioRuim: "ruim",
    });
    if (res.status !== 201) throw new Error(`parametro falhou: ${res.status} ${res.texto}`);
    ids.push(res.body.id);
  }
  return ids;
}

export async function idEspecie(api: Cliente, codigo: string): Promise<string> {
  const res = await api.get(`/especies/${codigo}`);
  if (res.status !== 200) throw new Error(`espécie ${codigo} não encontrada`);
  return res.body.id;
}

export async function criarColonia(api: Cliente, dados: Record<string, unknown> = {}) {
  const res = await api.post("/colonias", {
    dataEntrada: "2026-01-10T12:00:00.000Z",
    origem: "compra",
    tipoCaixa: "INPA",
    ...dados,
  });
  if (res.status !== 201) throw new Error(`colonia falhou: ${res.status} ${res.texto}`);
  return res.body;
}

export async function criarAvaliacao(
  api: Cliente,
  coloniaId: string,
  classificacoes: { parametroId: string; classificacao: "bom" | "medio" | "ruim" }[],
  extra: Record<string, unknown> = {}
) {
  return api.post(`/colonias/${coloniaId}/avaliacoes`, {
    dataAvaliacao: "2026-02-01T10:00:00.000Z",
    parametros: classificacoes,
    ...extra,
  });
}

// Monta um corpo multipart para POST /fotos.
export function formFoto(
  campos: Record<string, string>,
  arquivo: { conteudo: Buffer; tipo: string; nome?: string } | null = { conteudo: PNG, tipo: "image/png" }
): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.append(k, v);
  if (arquivo) {
    form.append("arquivo", new Blob([new Uint8Array(arquivo.conteudo)], { type: arquivo.tipo }), arquivo.nome ?? "foto");
  }
  return form;
}
