import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import type { Usuario } from "../../types/api";
import { ErroApi } from "../api/client";
import type { RespostaAlteracoes } from "./tipos";

// O jsdom não tem IndexedDB: a camada do banco é simulada; a regra do pull
// (mesclar) tem os próprios testes. Aqui se testa a orquestração.
const banco = vi.hoisted(() => ({
  indexedDbDisponivel: vi.fn(() => true),
  abrirBanco: vi.fn(async (_usuarioId: string): Promise<object> => ({})),
  lerMeta: vi.fn(async (_db: unknown) => ({ desde: null as string | null, ultimoPull: null, armazenamentoPersistente: null })),
  contarEspecies: vi.fn(async () => 0),
  aplicarPull: vi.fn(async () => 2),
  atualizarMeta: vi.fn(async () => undefined),
}));
const apis = vi.hoisted(() => ({
  alteracoes: vi.fn(),
  listarEspecies: vi.fn(),
}));

vi.mock("./banco", () => banco);
vi.mock("../api/endpoints", () => ({
  syncApi: { alteracoes: apis.alteracoes },
  especiesApi: { listar: apis.listarEspecies },
}));

const { desdeDoPedido, MARGEM_DESDE_MS, pedirArmazenamentoPersistente, puxarAlteracoes } = await import("./sincronizacao");

const RESPOSTA: RespostaAlteracoes = {
  servidorEm: "2026-11-05T10:00:00.000Z",
  desde: null,
  colonias: [],
  avaliacoes: [],
  producoes: [],
  parametros: [],
  idsAtuais: { colonias: [], avaliacoes: [], producoes: [], parametros: [] },
};

const usuario = (id: string) => ({ id, email: `${id}@x.app`, name: id, createdAt: "", meliponario: null }) as Usuario;

beforeEach(() => {
  vi.clearAllMocks();
  banco.indexedDbDisponivel.mockReturnValue(true);
  banco.abrirBanco.mockResolvedValue({});
  banco.lerMeta.mockResolvedValue({ desde: null, ultimoPull: null, armazenamentoPersistente: null });
  banco.contarEspecies.mockResolvedValue(0);
  apis.alteracoes.mockResolvedValue(RESPOSTA);
  apis.listarEspecies.mockResolvedValue([{ id: "e1" }]);
  useAuth.setState({ token: "t", usuario: usuario("u1") });
});

describe("puxarAlteracoes", () => {
  it("carga inicial: pull sem desde, espécies buscadas e plano aplicado", async () => {
    const resultado = await puxarAlteracoes("u1");

    expect(resultado).toEqual({ ok: true, servidorEm: RESPOSTA.servidorEm, cargaCompleta: true, alterados: 2 });
    expect(banco.abrirBanco).toHaveBeenCalledWith("u1");
    expect(apis.alteracoes).toHaveBeenCalledWith(undefined);
    expect(apis.listarEspecies).toHaveBeenCalledTimes(1);
    expect(banco.aplicarPull).toHaveBeenCalledWith({}, RESPOSTA, expect.any(Set), [{ id: "e1" }], expect.any(Boolean));
  });

  it("incremental: usa o desde gravado (menos a margem) e não busca espécies se já existem", async () => {
    banco.lerMeta.mockResolvedValue({ desde: "2026-11-04T00:00:00.000Z", ultimoPull: null, armazenamentoPersistente: null });
    banco.contarEspecies.mockResolvedValue(19);

    const resultado = await puxarAlteracoes("u1");

    expect(resultado).toMatchObject({ ok: true, cargaCompleta: false });
    expect(apis.alteracoes).toHaveBeenCalledWith("2026-11-03T23:55:00.000Z");
    expect(apis.listarEspecies).not.toHaveBeenCalled();
    expect(banco.aplicarPull).toHaveBeenCalledWith({}, RESPOSTA, expect.any(Set), null, expect.any(Boolean));
  });

  it("repassa as pendências para a aplicação", async () => {
    const pendentes = new Set(["c1"]);
    await puxarAlteracoes("u1", pendentes);
    expect(banco.aplicarPull).toHaveBeenCalledWith({}, RESPOSTA, pendentes, [{ id: "e1" }], expect.any(Boolean));
  });

  it("chamadas simultâneas fazem uma request só e recebem o mesmo resultado", async () => {
    const [a, b] = await Promise.all([puxarAlteracoes("u1"), puxarAlteracoes("u1")]);
    expect(apis.alteracoes).toHaveBeenCalledTimes(1);
    expect(banco.aplicarPull).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);

    // Terminado o pull, um novo disparo faz outra request.
    await puxarAlteracoes("u1");
    expect(apis.alteracoes).toHaveBeenCalledTimes(2);
  });

  it("sem conexão: resolve sem lançar e não toca no banco", async () => {
    apis.alteracoes.mockRejectedValue(new ErroApi(0, "Sem conexão com o servidor."));
    await expect(puxarAlteracoes("u1")).resolves.toMatchObject({ ok: false, motivo: "sem-conexao" });
    expect(banco.aplicarPull).not.toHaveBeenCalled();
  });

  it("5xx: resolve sem lançar e não toca no banco", async () => {
    apis.alteracoes.mockRejectedValue(new ErroApi(503, "Erro 503"));
    await expect(puxarAlteracoes("u1")).resolves.toMatchObject({ ok: false, motivo: "servidor" });
    expect(banco.aplicarPull).not.toHaveBeenCalled();
  });

  it("falha só nas espécies: aplica os dados e deixa as espécies para o próximo pull", async () => {
    apis.listarEspecies.mockRejectedValue(new ErroApi(500, "Erro 500"));
    await expect(puxarAlteracoes("u1")).resolves.toMatchObject({ ok: true });
    expect(banco.aplicarPull).toHaveBeenCalledWith({}, RESPOSTA, expect.any(Set), null, expect.any(Boolean));
  });

  it("falha ao gravar no banco local: resolve sem lançar", async () => {
    banco.aplicarPull.mockRejectedValueOnce(new Error("QuotaExceededError"));
    await expect(puxarAlteracoes("u1")).resolves.toMatchObject({ ok: false, motivo: "erro-local" });
  });

  it("navegador sem IndexedDB: não faz request", async () => {
    banco.indexedDbDisponivel.mockReturnValue(false);
    await expect(puxarAlteracoes("u1")).resolves.toMatchObject({ ok: false, motivo: "sem-indexeddb" });
    expect(apis.alteracoes).not.toHaveBeenCalled();
  });

  it("outro usuário: usa o próprio banco e faz a própria carga inicial", async () => {
    banco.lerMeta.mockImplementation(async (db: unknown) => ({
      desde: (db as { id: string }).id === "u1" ? "2026-11-04T00:00:00.000Z" : null,
      ultimoPull: null,
      armazenamentoPersistente: null,
    }));
    banco.abrirBanco.mockImplementation(async (id: string) => ({ id }));

    await puxarAlteracoes("u1");
    useAuth.setState({ token: "t2", usuario: usuario("u2") });
    const resultado = await puxarAlteracoes("u2");

    expect(banco.abrirBanco).toHaveBeenNthCalledWith(1, "u1");
    expect(banco.abrirBanco).toHaveBeenNthCalledWith(2, "u2");
    expect(apis.alteracoes).toHaveBeenNthCalledWith(1, "2026-11-03T23:55:00.000Z");
    expect(apis.alteracoes).toHaveBeenNthCalledWith(2, undefined);
    expect(resultado).toMatchObject({ ok: true, cargaCompleta: true });
  });

  it("sessão de outro usuário: não grava dados no banco errado", async () => {
    useAuth.setState({ token: "t2", usuario: usuario("u2") });
    await expect(puxarAlteracoes("u1")).resolves.toMatchObject({ ok: false, motivo: "sessao" });
    expect(banco.abrirBanco).not.toHaveBeenCalled();
    expect(apis.alteracoes).not.toHaveBeenCalled();
  });

  it("troca de sessão durante a request: a resposta não é gravada", async () => {
    apis.alteracoes.mockImplementation(async () => {
      // logout + login em outra conta enquanto a request está em andamento
      useAuth.setState({ token: "t2", usuario: usuario("u2") });
      return RESPOSTA;
    });

    await expect(puxarAlteracoes("u1")).resolves.toMatchObject({ ok: false, motivo: "sessao" });
    expect(apis.alteracoes).toHaveBeenCalledTimes(1);
    expect(banco.aplicarPull).not.toHaveBeenCalled();
  });

  it("logout durante a request: a resposta não é gravada", async () => {
    apis.alteracoes.mockImplementation(async () => {
      useAuth.setState({ token: null, usuario: null });
      return RESPOSTA;
    });

    await expect(puxarAlteracoes("u1")).resolves.toMatchObject({ ok: false, motivo: "sessao" });
    expect(banco.aplicarPull).not.toHaveBeenCalled();
  });

  it("desde gravado inválido: pede carga completa e informa cargaCompleta", async () => {
    banco.lerMeta.mockResolvedValue({ desde: "não é data", ultimoPull: null, armazenamentoPersistente: null });

    const resultado = await puxarAlteracoes("u1");

    expect(apis.alteracoes).toHaveBeenCalledWith(undefined);
    expect(resultado).toMatchObject({ ok: true, cargaCompleta: true });
  });

  it("pede desde − margem, mas grava o servidorEm da resposta como próximo desde", async () => {
    const desdeGravado = "2026-11-04T12:00:00.000Z";
    banco.lerMeta.mockResolvedValue({ desde: desdeGravado, ultimoPull: null, armazenamentoPersistente: null });

    await puxarAlteracoes("u1");

    const pedido = apis.alteracoes.mock.calls[0]![0] as string;
    expect(Date.parse(desdeGravado) - Date.parse(pedido)).toBe(MARGEM_DESDE_MS);
    // A aplicação recebe a resposta intacta: o `desde` gravado vem do servidorEm (mesclar/aplicarPull).
    expect(banco.aplicarPull).toHaveBeenCalledWith({}, RESPOSTA, expect.any(Set), [{ id: "e1" }], expect.any(Boolean));
  });
});

describe("desdeDoPedido", () => {
  it("sem desde gravado (ou inválido): carga completa", () => {
    expect(desdeDoPedido(null)).toBeUndefined();
    expect(desdeDoPedido("não é data")).toBeUndefined();
  });

  it("recua o desde gravado pela margem fixa, em ISO", () => {
    expect(MARGEM_DESDE_MS).toBeGreaterThan(0);
    expect(desdeDoPedido("2026-11-04T00:00:00.000Z")).toBe(new Date(Date.parse("2026-11-04T00:00:00.000Z") - MARGEM_DESDE_MS).toISOString());
  });
});

describe("pedirArmazenamentoPersistente", () => {
  // Fora do corpo do teste: uma asserção que falha não deixa o navigator falso vazar.
  afterEach(() => vi.unstubAllGlobals());

  it("grava o resultado concedido em meta", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => false, persist: async () => true } });
    await expect(pedirArmazenamentoPersistente("u1")).resolves.toBe(true);
    expect(banco.atualizarMeta).toHaveBeenCalledWith({}, { armazenamentoPersistente: true });
  });

  it("negado ou sem a API: grava false e não lança", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => false, persist: async () => false } });
    await expect(pedirArmazenamentoPersistente("u1")).resolves.toBe(false);
    vi.stubGlobal("navigator", {});
    await expect(pedirArmazenamentoPersistente("u1")).resolves.toBe(false);
    expect(banco.atualizarMeta).toHaveBeenCalledTimes(2);
    expect(banco.atualizarMeta).toHaveBeenLastCalledWith({}, { armazenamentoPersistente: false });
  });

  it("já persistente: não pede de novo", async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal("navigator", { storage: { persisted: async () => true, persist } });
    await expect(pedirArmazenamentoPersistente("u1")).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });
});
