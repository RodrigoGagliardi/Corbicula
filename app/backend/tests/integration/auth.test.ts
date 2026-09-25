import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cliente, criarApp } from "../helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});
afterAll(async () => {
  await app.close();
});

const emailNovo = () => `auth-${randomUUID()}@corbicula.test`;

describe("auth", () => {
  it("registra, devolve token e nunca expõe a senha", async () => {
    const res = await cliente(app).post("/auth/register", {
      name: "Rodrigo",
      email: emailNovo(),
      password: "senha123",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.texto).not.toContain("password");
    expect(res.texto).not.toContain("senha123");
  });

  it("cria o meliponário junto quando enviado no registro", async () => {
    const res = await cliente(app).post("/auth/register", {
      name: "Rodrigo",
      email: emailNovo(),
      password: "senha123",
      meliponario: { nome: "Meliponário Sul", cidade: "Pelotas", estado: "RS" },
    });
    expect(res.status).toBe(201);
    expect(res.body.user.meliponario).toMatchObject({ nome: "Meliponário Sul", cidade: "Pelotas" });

    const me = await cliente(app, res.body.token).get("/users/me");
    expect(me.body.meliponario?.nome).toBe("Meliponário Sul");
  });

  it("recusa e-mail duplicado (409) e dados inválidos (400)", async () => {
    const email = emailNovo();
    await cliente(app).post("/auth/register", { name: "A B", email, password: "senha123" });
    const dup = await cliente(app).post("/auth/register", { name: "A B", email, password: "senha123" });
    expect(dup.status).toBe(409);

    const invalido = await cliente(app).post("/auth/register", { name: "A", email: "x", password: "1" });
    expect(invalido.status).toBe(400);
    expect(invalido.body.detalhes.map((d: { campo: string }) => d.campo)).toEqual(
      expect.arrayContaining(["name", "email", "password"])
    );
  });

  it("faz login com a senha certa e recusa a errada sem revelar qual campo falhou", async () => {
    const email = emailNovo();
    await cliente(app).post("/auth/register", { name: "A B", email, password: "senha123" });

    const ok = await cliente(app).post("/auth/login", { email, password: "senha123" });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));

    const senhaErrada = await cliente(app).post("/auth/login", { email, password: "errada" });
    const emailInexistente = await cliente(app).post("/auth/login", { email: emailNovo(), password: "senha123" });
    expect(senhaErrada.status).toBe(401);
    expect(emailInexistente.status).toBe(401);
    expect(senhaErrada.body.error).toBe(emailInexistente.body.error);
  });

  it("rotas protegidas exigem token válido", async () => {
    expect((await cliente(app).get("/colonias")).status).toBe(401);
    expect((await cliente(app, "token-invalido").get("/colonias")).status).toBe(401);
    expect((await cliente(app).get("/exportacao/backup")).status).toBe(401);
    expect((await cliente(app).post("/sync", { operacoes: [] })).status).toBe(401);
  });
});
