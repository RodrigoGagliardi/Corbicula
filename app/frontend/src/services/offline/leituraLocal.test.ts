import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import type { Especie, Usuario } from "../../types/api";
import { ErroApi } from "../api/client";
import type { AvaliacaoServidor, ColoniaServidor, ParametroServidor, ProducaoServidor, RespostaAlteracoes } from "./tipos";

// IndexedDB em memória (fake-indexeddb); cada teste usa um usuário próprio,
// portanto um banco próprio. `abrirBanco` é espionado para provar que, online,
// o banco local nem é aberto.
vi.mock("./banco", async (original) => {
  const real = await original<typeof import("./banco")>();
  return { ...real, abrirBanco: vi.fn(real.abrirBanco) };
});

const banco = await import("./banco");
const { comFallback, comFallbackLocal, leiturasLocais } = await import("./leituraLocal");

const conexao = { online: true };
const descritorOriginal = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => conexao.online });
afterAll(() => {
  delete (navigator as { onLine?: boolean }).onLine;
  if (descritorOriginal) Object.defineProperty(Navigator.prototype, "onLine", descritorOriginal);
});

const usuario = (id: string) => ({ id, email: `${id}@x.app`, name: id, createdAt: "", meliponario: null }) as Usuario;
const entrar = (id: string) => useAuth.setState({ token: "t", usuario: usuario(id) });

const colonia = (id: string, codigo: string) =>
  ({ id, codigo, status: "ativa", especieId: null, coloniaMaeId: null, coloniaDoadoraCampeirasId: null, dataEntrada: "2026-10-01T00:00:00.000Z" }) as ColoniaServidor;

function resposta(parcial: Partial<RespostaAlteracoes> = {}): RespostaAlteracoes {
  return {
    servidorEm: "2026-11-05T10:00:00.000Z",
    desde: null,
    colonias: [],
    avaliacoes: [],
    producoes: [],
    parametros: [],
    idsAtuais: { colonias: [], avaliacoes: [], producoes: [], parametros: [] },
    ...parcial,
  };
}

// Banco de `usuarioId` com uma carga aplicada (meta.desde preenchido).
async function carregar(usuarioId: string, especies: Especie[] | null = null) {
  const db = await banco.abrirBanco(usuarioId);
  await banco.aplicarPull(
    db,
    resposta({
      colonias: [colonia("c2", "COL-002"), colonia("c1", "COL-001")],
      idsAtuais: { colonias: ["c1", "c2"], avaliacoes: [], producoes: [], parametros: [] },
    }),
    new Set(),
    especies
  );
  vi.mocked(banco.abrirBanco).mockClear();
}

const semConexao = () => new ErroApi(0, "Sem conexão com o servidor.");
// Sem rede a API nem é chamada; se fosse, o teste falharia.
const naoChamar = (): Promise<never> => Promise.reject(new Error("a API não deveria ser chamada"));

beforeEach(() => {
  conexao.online = true;
  vi.mocked(banco.abrirBanco).mockClear();
});

describe("comFallbackLocal", () => {
  it("online: devolve a API sem abrir o banco local", async () => {
    entrar("online");
    const local = vi.fn();
    await expect(comFallbackLocal(async () => "da-api", local)).resolves.toBe("da-api");
    expect(local).not.toHaveBeenCalled();
    expect(banco.abrirBanco).not.toHaveBeenCalled();
  });

  it("sem rede: nem chama a API e lê o banco do usuário da sessão", async () => {
    await carregar("offline");
    entrar("offline");
    conexao.online = false;
    const remoto = vi.fn(async (): Promise<string[]> => ["da-api"]);

    const r = await comFallbackLocal(remoto, async (db) => (await db.getAllKeys("colonias")).sort());

    expect(r).toEqual(["c1", "c2"]);
    expect(remoto).not.toHaveBeenCalled();
    expect(banco.abrirBanco).toHaveBeenCalledWith("offline");
  });

  it("rede some no meio: ErroApi(0) da API cai para o banco local", async () => {
    await carregar("caiu");
    entrar("caiu");
    const r = await comFallbackLocal(async () => Promise.reject(semConexao()), leiturasLocais.colonias);
    expect(r.map((c) => c.codigo)).toEqual(["COL-001", "COL-002"]);
  });

  it("outros erros da API são relançados, sem ler o banco", async () => {
    await carregar("http");
    entrar("http");
    const local = vi.fn();
    const e500 = new ErroApi(500, "Erro interno");
    const e404 = new ErroApi(404, "Colônia não encontrada");
    await expect(comFallbackLocal(async () => Promise.reject(e500), local)).rejects.toBe(e500);
    await expect(comFallbackLocal(async () => Promise.reject(e404), local)).rejects.toBe(e404);
    expect(local).not.toHaveBeenCalled();
    expect(banco.abrirBanco).not.toHaveBeenCalled();
  });

  it("banco nunca carregado: relança o erro de conexão original", async () => {
    entrar("nunca");
    const original = semConexao();
    const local = vi.fn();
    await expect(comFallbackLocal(async () => Promise.reject(original), local)).rejects.toBe(original);
    expect(local).not.toHaveBeenCalled();

    conexao.online = false;
    await expect(comFallbackLocal(async () => "x", local)).rejects.toMatchObject({ status: 0, message: "Sem conexão com o servidor." });
    expect(local).not.toHaveBeenCalled();
  });

  it("sem usuário na sessão: erro de conexão, sem abrir banco", async () => {
    useAuth.setState({ token: null, usuario: null });
    conexao.online = false;
    await expect(comFallbackLocal(async () => "x", vi.fn())).rejects.toBeInstanceOf(ErroApi);
    expect(banco.abrirBanco).not.toHaveBeenCalled();
  });

  it("o banco de outro usuário não é lido", async () => {
    await carregar("dono");
    entrar("outro");
    conexao.online = false;
    await expect(comFallbackLocal(naoChamar, leiturasLocais.colonias)).rejects.toMatchObject({ status: 0 });
    expect(banco.abrirBanco).toHaveBeenCalledWith("outro");
  });

  it("registro inexistente localmente: 404 da leitura local passa adiante", async () => {
    await carregar("detalhe");
    entrar("detalhe");
    conexao.online = false;
    await expect(comFallbackLocal(naoChamar, (db) => leiturasLocais.colonia(db, "c9"))).rejects.toMatchObject({
      status: 404,
      message: "Este registro ainda não está na cópia offline. Ele aparece quando a conexão voltar.",
    });
    await expect(comFallbackLocal(naoChamar, (db) => leiturasLocais.colonia(db, "c1"))).resolves.toMatchObject({ codigo: "COL-001" });
  });

  it("falha do IndexedDB ou catálogo de espécies vazio: vale o erro de conexão", async () => {
    await carregar("especies");
    entrar("especies");
    conexao.online = false;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(comFallbackLocal(async () => [], leiturasLocais.especies)).rejects.toMatchObject({ status: 0 });
    const falha = new Error("IDB");
    await expect(comFallbackLocal(async () => [], async () => Promise.reject(falha))).rejects.toMatchObject({ status: 0 });
    // O erro original não passa calado.
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), falha);
    consoleError.mockRestore();
  });

  it("espécies guardadas: lidas do banco, por nome popular", async () => {
    const especies = [
      { id: "e2", codigo: "MELIQUAD", nomePopular: "Mandaçaia" },
      { id: "e1", codigo: "TETRANGU", nomePopular: "Jataí" },
    ] as Especie[];
    await carregar("com-especies", especies);
    entrar("com-especies");
    conexao.online = false;
    const r = await comFallbackLocal(async () => [], leiturasLocais.especies);
    expect(r.map((e) => e.nomePopular)).toEqual(["Jataí", "Mandaçaia"]);
  });
});

describe("comFallback", () => {
  it("sem rede, a alternativa recebe um erro de conexão; online, só em ErroApi(0)", async () => {
    conexao.online = false;
    const alternativa = vi.fn(async (erro: ErroApi) => `alt ${erro.status}`);
    await expect(comFallback(async () => "api", alternativa)).resolves.toBe("alt 0");

    conexao.online = true;
    await expect(comFallback(async () => "api", alternativa)).resolves.toBe("api");
    await expect(comFallback(async () => Promise.reject(new ErroApi(401, "x")), alternativa)).rejects.toMatchObject({ status: 401 });
    expect(alternativa).toHaveBeenCalledTimes(1);
  });
});

// ─── Cada leitura do banco local, com uma carga completa ──────────────────────

const avaliacao = (id: string, coloniaId: string, dataAvaliacao: string, parametros: [string, "bom" | "medio" | "ruim"][]) =>
  ({
    id,
    coloniaId,
    dataAvaliacao,
    statusGeral: "boa",
    scoreGeral: 70,
    acoesTomadas: [],
    parametros: parametros.map(([parametroId, classificacao]) => ({ id: `${id}-${parametroId}`, avaliacaoId: id, parametroId, classificacao })),
  }) as unknown as AvaliacaoServidor;
const producao = (id: string, coloniaId: string, dataColheita: string, tipoProduto: "mel" | "polen") =>
  ({ id, coloniaId, dataColheita, tipoProduto, quantidade: 10, unidade: "g" }) as ProducaoServidor;
const parametro = (id: string, nome: string, ordem: number) => ({ id, nome, ordem, ativo: true, criteriosEspecie: [] }) as unknown as ParametroServidor;

describe("leiturasLocais (banco local, sem rede)", () => {
  // c1: a1 (01/10, p1 bom), a2 (01/11, p1 ruim + p2 bom), pr1 (05/10, mel)
  // c2: a3 (15/10, p2 médio), pr2 (20/10, pólen)
  async function preparar(usuarioId: string) {
    const db = await banco.abrirBanco(usuarioId);
    await banco.aplicarPull(
      db,
      resposta({
        colonias: [colonia("c1", "COL-001"), colonia("c2", "COL-002")],
        avaliacoes: [
          avaliacao("a1", "c1", "2026-10-01T10:00:00.000Z", [["p1", "bom"]]),
          avaliacao("a2", "c1", "2026-11-01T10:00:00.000Z", [["p1", "ruim"], ["p2", "bom"]]),
          avaliacao("a3", "c2", "2026-10-15T10:00:00.000Z", [["p2", "medio"]]),
        ],
        producoes: [producao("pr1", "c1", "2026-10-05T10:00:00.000Z", "mel"), producao("pr2", "c2", "2026-10-20T10:00:00.000Z", "polen")],
        parametros: [parametro("p1", "Sanidade", 2), parametro("p2", "Fluxo", 1)],
        idsAtuais: { colonias: ["c1", "c2"], avaliacoes: ["a1", "a2", "a3"], producoes: ["pr1", "pr2"], parametros: ["p1", "p2"] },
      }),
      new Set(),
      null
    );
    entrar(usuarioId);
    conexao.online = false;
  }
  const ids = (lista: { id: string }[]) => lista.map((x) => x.id);

  it("avaliacoes: só as da colônia pedida, data desc; colônia inexistente → 404", async () => {
    await preparar("ad-avaliacoes");
    expect(ids(await comFallbackLocal(naoChamar, (db) => leiturasLocais.avaliacoes(db, "c1")))).toEqual(["a2", "a1"]);
    expect(ids(await comFallbackLocal(naoChamar, (db) => leiturasLocais.avaliacoes(db, "c2")))).toEqual(["a3"]);
    await expect(comFallbackLocal(naoChamar, (db) => leiturasLocais.avaliacoes(db, "c9"))).rejects.toMatchObject({ status: 404 });
  });

  it("historicoAvaliacoes: aplica os filtros", async () => {
    await preparar("ad-historico");
    const ler = (filtros: object) => comFallbackLocal(naoChamar, (db) => leiturasLocais.historicoAvaliacoes(db, filtros)).then(ids);
    expect(await ler({})).toEqual(["a2", "a3", "a1"]);
    expect(await ler({ coloniaId: "c1" })).toEqual(["a2", "a1"]);
    expect(await ler({ parametroId: "p1", classificacao: "ruim" })).toEqual(["a2"]);
    expect(await ler({ desde: "2026-10-10", ate: "2026-10-31" })).toEqual(["a3"]);
  });

  it("avaliacao: busca pela colônia e pelo id certos, parâmetros por ordem", async () => {
    await preparar("ad-avaliacao");
    const a = await comFallbackLocal(naoChamar, (db) => leiturasLocais.avaliacao(db, "c1", "a2"));
    expect(a.id).toBe("a2");
    expect(a.parametros.map((p) => p.parametro.nome)).toEqual(["Fluxo", "Sanidade"]);
    await expect(comFallbackLocal(naoChamar, (db) => leiturasLocais.avaliacao(db, "c2", "a2"))).rejects.toMatchObject({ status: 404 });
    await expect(comFallbackLocal(naoChamar, (db) => leiturasLocais.avaliacao(db, "a2", "c1"))).rejects.toMatchObject({ status: 404 });
  });

  it("parametros: por ordem, com a contagem de usos das avaliações locais", async () => {
    await preparar("ad-parametros");
    const r = await comFallbackLocal(naoChamar, leiturasLocais.parametros);
    expect(r.map((p) => [p.id, p._count.avaliacoesParametros])).toEqual([["p2", 2], ["p1", 2]]);
  });

  it("producoes: data desc e filtros de colônia, produto e período", async () => {
    await preparar("ad-producoes");
    const ler = (filtros: object) => comFallbackLocal(naoChamar, (db) => leiturasLocais.producoes(db, filtros)).then(ids);
    expect(await ler({})).toEqual(["pr2", "pr1"]);
    expect(await ler({ coloniaId: "c1" })).toEqual(["pr1"]);
    expect(await ler({ tipoProduto: "polen" })).toEqual(["pr2"]);
    expect(await ler({ ate: "2026-10-10" })).toEqual(["pr1"]);
  });

  it("producao: pelo id, com a colônia certa embutida; inexistente → 404", async () => {
    await preparar("ad-producao");
    const p = await comFallbackLocal(naoChamar, (db) => leiturasLocais.producao(db, "pr2"));
    expect([p.id, p.colonia.id, p.colonia.codigo]).toEqual(["pr2", "c2", "COL-002"]);
    await expect(comFallbackLocal(naoChamar, (db) => leiturasLocais.producao(db, "pr9"))).rejects.toMatchObject({ status: 404 });
  });
});
