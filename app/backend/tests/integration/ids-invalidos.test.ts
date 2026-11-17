import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp, criarColonia, novoUsuario, type Cliente, type Resposta } from "../helpers";

// Id que não é UUID na URL deve dar 404 (registro não encontrado), não 500.
// Antes, o Postgres recusava a consulta ("invalid input syntax for type uuid")
// e o erro escapava como "Erro interno do servidor".

let app: FastifyInstance;
let api: Cliente;
let coloniaId: string;

beforeAll(async () => {
  app = await criarApp();
  ({ api } = await novoUsuario(app));
  coloniaId = (await criarColonia(api)).id;
});
afterAll(async () => {
  await app.close();
});

const criterios = { criterioBom: "b", criterioMedio: "m", criterioRuim: "r" };

describe("ids malformados na URL → 404", () => {
  const rotas: [string, (api: Cliente) => Promise<Resposta>][] = [
    ["GET /colonias/abc", (a) => a.get("/colonias/abc")],
    ["PATCH /colonias/abc", (a) => a.patch("/colonias/abc", { localizacao: "x" })],
    ["DELETE /colonias/abc", (a) => a.delete("/colonias/abc")],
    ["GET /colonias/abc/avaliacoes", (a) => a.get("/colonias/abc/avaliacoes")],
    ["GET /colonias/:id/avaliacoes/abc", (a) => a.get(`/colonias/${coloniaId}/avaliacoes/abc`)],
    ["PATCH /colonias/:id/avaliacoes/abc", (a) => a.patch(`/colonias/${coloniaId}/avaliacoes/abc`, { observacoes: "x" })],
    ["DELETE /colonias/:id/avaliacoes/abc", (a) => a.delete(`/colonias/${coloniaId}/avaliacoes/abc`)],
    ["GET /fotos/abc", (a) => a.get("/fotos/abc")],
    ["PATCH /fotos/abc", (a) => a.patch("/fotos/abc", { legenda: "x" })],
    ["DELETE /fotos/abc", (a) => a.delete("/fotos/abc")],
    ["GET /parametros/abc", (a) => a.get("/parametros/abc")],
    ["PATCH /parametros/abc", (a) => a.patch("/parametros/abc", { nome: "Novo nome" })],
    ["DELETE /parametros/abc", (a) => a.delete("/parametros/abc")],
    ["PUT /parametros/abc/especies/abc", (a) => a.put("/parametros/abc/especies/abc", criterios)],
    ["DELETE /parametros/abc/especies/abc", (a) => a.delete("/parametros/abc/especies/abc")],
    ["GET /producoes/abc", (a) => a.get("/producoes/abc")],
    ["PATCH /producoes/abc", (a) => a.patch("/producoes/abc", { quantidade: 1 })],
    ["DELETE /producoes/abc", (a) => a.delete("/producoes/abc")],
  ];

  it.each(rotas)("%s", async (_rota, chamar) => {
    const res = await chamar(api);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("um parâmetro válido com especieId malformado também dá 404", async () => {
    const p = await api.post("/parametros", { nome: "Atividade", ...criterios });
    expect((await api.put(`/parametros/${p.body.id}/especies/abc`, criterios)).status).toBe(404);
  });

  it("UUID válido inexistente continua 404 com a mensagem do módulo", async () => {
    const res = await api.get("/colonias/00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/colônia/i);
  });

  it("UUID de outro usuário continua 404 (isolamento)", async () => {
    const outro = await novoUsuario(app);
    expect((await outro.api.get(`/colonias/${coloniaId}`)).status).toBe(404);
  });
});
