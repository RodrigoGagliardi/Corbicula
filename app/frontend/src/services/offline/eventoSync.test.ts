import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import { ErroApi } from "../api/client";
import type { OperacaoSync, RespostaAlteracoes } from "./tipos";

// Evento `sync` do Service Worker com as ligações reais (eventoSync.ts) e o ciclo
// real de sincronização; só a API é simulada.
const apis = vi.hoisted(() => ({
  syncApi: { enviar: vi.fn(), alteracoes: vi.fn() },
  especiesApi: { listar: vi.fn(async () => []) },
  fotosApi: { enviar: vi.fn() },
}));
vi.mock("../api/endpoints", () => apis);

const banco = await import("./banco");
const { dependenciasDoServiceWorker } = await import("./eventoSync");
const { sincronizarEmSegundoPlano } = await import("./segundoPlano");
const { espelharSessao, lerSessaoEspelhada } = await import("./sessaoSegundoPlano");
const { cancelarNovaTentativa } = await import("./sincronizacao");

const PULL: RespostaAlteracoes = {
  servidorEm: "2026-11-12T12:00:00.000Z",
  desde: null,
  colonias: [],
  avaliacoes: [],
  producoes: [],
  parametros: [],
  idsAtuais: { colonias: [], avaliacoes: [], producoes: [], parametros: [] },
};

// Contexto do SW: sessão só na cópia espelhada (o useAuth dele começa vazio) e
// uma operação feita offline na fila do usuário.
async function swComPendencia(usuarioId: string) {
  useAuth.setState({ token: null, usuario: null });
  await espelharSessao({ usuarioId, token: `token-${usuarioId}` });
  const db = await banco.abrirBanco(usuarioId);
  await banco.aplicarPull(db, PULL, new Set(), []);
  await banco.enfileirar(db, { id: `op-${usuarioId}`, tipo: "colonia", operacao: "update", entidadeId: "c1", dados: {}, criadoEm: "", estado: "pendente", tentativas: 0, relacionadas: [] }, []);
  return db;
}

const evento = (haJanela = false) => sincronizarEmSegundoPlano(dependenciasDoServiceWorker(async () => haJanela));

beforeEach(() => {
  vi.clearAllMocks();
  cancelarNovaTentativa();
  apis.syncApi.alteracoes.mockResolvedValue(PULL);
  apis.syncApi.enviar.mockImplementation(async (ops: OperacaoSync[]) => ({
    servidorEm: PULL.servidorEm,
    processadas: ops.length,
    aplicadas: ops.length,
    duplicadas: 0,
    conflitos: 0,
    erros: 0,
    resultados: ops.map((o) => ({ id: o.id, entidadeId: o.entidadeId, status: "aplicado" })),
  }));
});

describe("evento sync do Service Worker (ciclo real)", () => {
  it("app fechado: assume a sessão espelhada, envia a fila e faz o pull", async () => {
    const db = await swComPendencia("sw-ok");
    expect(await evento()).toBe("sincronizado");
    expect(useAuth.getState()).toMatchObject({ token: "token-sw-ok", usuario: { id: "sw-ok" } });
    expect(apis.syncApi.enviar).toHaveBeenCalledTimes(1);
    expect(await banco.contarFila(db)).toBe(0);
    expect(apis.syncApi.alteracoes).toHaveBeenCalled();
  });

  it("servidor fora (503): rejeita para o navegador tentar de novo; fila e cópia da sessão intactas", async () => {
    const db = await swComPendencia("sw-503");
    apis.syncApi.enviar.mockRejectedValue(new ErroApi(503, "Erro 503"));
    await expect(evento()).rejects.toThrow("tentará de novo");
    expect(await banco.contarFila(db)).toBe(1);
    expect(await lerSessaoEspelhada()).toEqual({ usuarioId: "sw-503", token: "token-sw-503" });
  });

  it("token expirado (401): encerra sem nova tentativa, fila intacta e a cópia da sessão sai", async () => {
    const db = await swComPendencia("sw-401");
    // Como o client.ts: 401 encerra a sessão (no SW, só a da memória).
    apis.syncApi.enviar.mockImplementation(async () => {
      useAuth.getState().sair();
      throw new ErroApi(401, "Token inválido");
    });
    await expect(evento()).resolves.toBe("sincronizado");
    expect(await banco.contarFila(db)).toBe(1);
    expect(await lerSessaoEspelhada()).toBeNull();
  });

  it("401 depois de um novo login no app: a cópia nova (outro token) não é apagada", async () => {
    await swComPendencia("sw-relogin");
    apis.syncApi.enviar.mockImplementation(async () => {
      // O app gravou outra sessão enquanto o SW enviava com o token antigo.
      await espelharSessao({ usuarioId: "sw-relogin", token: "token-novo" });
      useAuth.getState().sair();
      throw new ErroApi(401, "Token inválido");
    });
    await evento();
    expect(await lerSessaoEspelhada()).toEqual({ usuarioId: "sw-relogin", token: "token-novo" });
  });

  it("janela aberta: não envia nada e rejeita (o registro continua valendo)", async () => {
    const db = await swComPendencia("sw-janela");
    await expect(evento(true)).rejects.toThrow("App aberto");
    expect(apis.syncApi.enviar).not.toHaveBeenCalled();
    expect(await banco.contarFila(db)).toBe(1);
  });
});
