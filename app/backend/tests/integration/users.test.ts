import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cliente, criarApp, criarAvaliacao, criarColonia, criarParametros, formFoto, novoUsuario } from "../helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});
afterAll(async () => {
  await app.close();
});

const login = (email: string, password: string) => cliente(app).post("/auth/login", { email, password });

describe("users — perfil e meliponário", () => {
  it("devolve o perfil sem a senha e atualiza nome e e-mail", async () => {
    const { api } = await novoUsuario(app);
    const me = await api.get("/users/me");
    expect(me.status).toBe(200);
    expect(me.texto).not.toContain("password");

    const email = `novo-${me.body.id}@corbicula.test`;
    const res = await api.patch("/users/me", { name: "Nome Novo", email });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Nome Novo", email });
    expect((await login(email, "senha123")).status).toBe(200);
  });

  it("recusa e-mail que já pertence a outra conta (409), mas aceita o próprio", async () => {
    const a = await novoUsuario(app);
    const b = await novoUsuario(app);
    expect((await a.api.patch("/users/me", { email: b.email })).status).toBe(409);
    expect((await a.api.patch("/users/me", { email: a.email })).status).toBe(200);
  });

  it("cria e depois atualiza o meliponário (PUT 1:1) e valida coordenadas", async () => {
    const { api } = await novoUsuario(app);
    const criado = await api.put("/users/me/meliponario", { nome: "Sítio", latitude: -30.03, longitude: -51.23, bioma: "Pampa" });
    expect(criado.status).toBe(200);
    const atualizado = await api.put("/users/me/meliponario", { nome: "Sítio Novo", latitude: -30.03, longitude: -51.23 });
    expect(atualizado.body.id).toBe(criado.body.id);
    expect(atualizado.body).toMatchObject({ nome: "Sítio Novo", bioma: null });

    expect((await api.put("/users/me/meliponario", { nome: "Sítio", latitude: -91 })).status).toBe(400);
  });
});

describe("users — senha", () => {
  it("altera a senha só com a senha atual correta; senha errada é 400 (não encerra a sessão)", async () => {
    const { api, email } = await novoUsuario(app);
    const errada = await api.put("/users/me/senha", { senhaAtual: "errada", novaSenha: "outra123" });
    expect(errada.status).toBe(400);

    const curta = await api.put("/users/me/senha", { senhaAtual: "senha123", novaSenha: "123" });
    expect(curta.status).toBe(400);

    expect((await api.put("/users/me/senha", { senhaAtual: "senha123", novaSenha: "outra123" })).status).toBe(204);
    expect((await login(email, "senha123")).status).toBe(401);
    expect((await login(email, "outra123")).status).toBe(200);
  });
});

describe("users — excluir conta (LGPD)", () => {
  it("exige a senha e não apaga nada se ela estiver errada", async () => {
    const { api } = await novoUsuario(app);
    expect((await api.delete("/users/me", { senha: "errada" })).status).toBe(400);
    expect((await api.delete("/users/me", {})).status).toBe(400);
    expect((await api.get("/users/me")).status).toBe(200);
  });

  it("apaga a conta, os dados e os arquivos de fotos; outras contas não são afetadas", async () => {
    const dono = await novoUsuario(app);
    const outro = await novoUsuario(app);
    const coloniaOutro = await criarColonia(outro.api);

    const colonia = await criarColonia(dono.api);
    const [p1] = await criarParametros(dono.api, 1);
    await criarAvaliacao(dono.api, colonia.id, [{ parametroId: p1!, classificacao: "bom" }]);
    const foto = (await dono.api.post("/fotos", formFoto({ coloniaId: colonia.id }))).body;
    expect((await app.inject({ method: "GET", url: foto.url })).statusCode).toBe(200);

    expect((await dono.api.delete("/users/me", { senha: "senha123" })).status).toBe(204);

    expect((await login(dono.email, "senha123")).status).toBe(401);
    expect((await app.inject({ method: "GET", url: foto.url })).statusCode).toBe(404);
    expect((await dono.api.get("/users/me")).status).toBe(404);
    expect((await outro.api.get(`/colonias/${coloniaOutro.id}`)).status).toBe(200);
  });
});
