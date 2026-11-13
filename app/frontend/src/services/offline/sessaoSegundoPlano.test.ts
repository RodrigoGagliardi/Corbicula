import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import type { Usuario } from "../../types/api";
import { espelharSessao, lerSessaoEspelhada, observarSessao } from "./sessaoSegundoPlano";

describe("sessão espelhada para o Service Worker", () => {
  it("grava, troca e apaga a sessão", async () => {
    expect(await lerSessaoEspelhada()).toBeNull();

    await espelharSessao({ usuarioId: "u1", token: "a" });
    expect(await lerSessaoEspelhada()).toEqual({ usuarioId: "u1", token: "a" });

    // Outra conta (ou token renovado) substitui a anterior.
    await espelharSessao({ usuarioId: "u2", token: "b" });
    expect(await lerSessaoEspelhada()).toEqual({ usuarioId: "u2", token: "b" });

    // Logout ou 401: a cópia sai e o SW deixa de sincronizar.
    await espelharSessao(null);
    expect(await lerSessaoEspelhada()).toBeNull();
  });

  it("observarSessao: espelha a sessão já salva, o login, o token renovado e o fim da sessão", async () => {
    const usuario = (id: string) => ({ id }) as Usuario;
    // Logado antes desta versão: a sessão do localStorage é espelhada na carga.
    useAuth.setState({ token: "antigo", usuario: usuario("u1") });
    const parar = observarSessao();
    await vi.waitFor(async () => expect(await lerSessaoEspelhada()).toEqual({ usuarioId: "u1", token: "antigo" }));

    useAuth.setState({ token: "renovado" });
    await vi.waitFor(async () => expect(await lerSessaoEspelhada()).toEqual({ usuarioId: "u1", token: "renovado" }));

    useAuth.getState().entrar("t2", usuario("u2"));
    await vi.waitFor(async () => expect(await lerSessaoEspelhada()).toEqual({ usuarioId: "u2", token: "t2" }));

    // Logout ou 401 (o client.ts chama o mesmo sair()).
    useAuth.getState().sair();
    await vi.waitFor(async () => expect(await lerSessaoEspelhada()).toBeNull());
    parar();
  });
});
