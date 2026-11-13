import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import type { Usuario } from "../../types/api";
import { ErroApi } from "../api/client";
import type { ColoniaServidor, ParametroServidor, RespostaAlteracoes } from "./tipos";

// Camada de escrita com IndexedDB em memória: REST mockada, sincronização
// espionada (o ciclo tem testes próprios).
const apis = vi.hoisted(() => ({
  coloniasApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
  avaliacoesApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
  producoesApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
}));
const sinc = vi.hoisted(() => ({ sincronizar: vi.fn(async () => ({})), atualizarContagem: vi.fn(async () => 0) }));
vi.mock("../api/endpoints", () => apis);
vi.mock("./sincronizacao", () => sinc);

const banco = await import("./banco");
const { escritas, novoId } = await import("./escrita");
const { mensagemColoniaComAvaliacoes } = await import("./validacoes");

const conexao = { online: true };
const descritorOriginal = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => conexao.online });
afterAll(() => {
  delete (navigator as { onLine?: boolean }).onLine;
  if (descritorOriginal) Object.defineProperty(Navigator.prototype, "onLine", descritorOriginal);
});

// Parâmetros ativos da cópia local (as avaliações dos testes usam p1 e p2).
const PARAMETROS = ["p1", "p2"].map((id) => ({ id, nome: id, ativo: true, criteriosEspecie: [] })) as unknown as ParametroServidor[];
const usuario = (id: string) => ({ id, email: `${id}@x.app`, name: id, createdAt: "", meliponario: null }) as Usuario;
const colonia = (id: string, codigo: string) =>
  ({ id, codigo, status: "ativa", especieId: null, coloniaMaeId: null, coloniaDoadoraCampeirasId: null, updatedAt: "2026-11-01T00:00:00.000Z" }) as ColoniaServidor;

const VAZIA: RespostaAlteracoes = {
  servidorEm: "2026-11-05T10:00:00.000Z",
  desde: null,
  colonias: [colonia("c1", "TETRANGU-001")],
  avaliacoes: [],
  producoes: [],
  parametros: PARAMETROS,
  idsAtuais: { colonias: ["c1"], avaliacoes: [], producoes: [], parametros: ["p1", "p2"] },
};

// Banco carregado (como depois do primeiro pull) e sessão do usuário.
async function entrarCarregado(usuarioId: string, resposta: RespostaAlteracoes = VAZIA) {
  useAuth.setState({ token: "t", usuario: usuario(usuarioId) });
  const db = await banco.abrirBanco(usuarioId);
  await banco.aplicarPull(db, resposta, new Set(), []);
  return db;
}

const AVALIACAO = {
  dataAvaliacao: "2026-11-09T12:00:00.000Z",
  parametros: [{ parametroId: "p1", classificacao: "bom" as const }, { parametroId: "p2", classificacao: "ruim" as const }],
};

beforeEach(() => {
  vi.clearAllMocks();
  conexao.online = true;
});

describe("novoId", () => {
  it("UUID v4, também sem crypto.randomUUID (http na rede local)", () => {
    expect(novoId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined });
    try {
      expect(novoId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { configurable: true, value: original });
    }
  });
});

describe("online com a fila vazia: REST como antes", () => {
  it("create vai pela API com o id do cliente e sincroniza; nada na fila", async () => {
    const db = await entrarCarregado("rest-ok");
    apis.avaliacoesApi.criar.mockResolvedValue({});
    const r = await escritas.criarAvaliacao("c1", AVALIACAO);

    expect(r.offline).toBe(false);
    expect(apis.avaliacoesApi.criar).toHaveBeenCalledWith("c1", { ...AVALIACAO, id: r.id });
    expect(sinc.sincronizar).toHaveBeenCalledWith("rest-ok");
    expect(await banco.contarFila(db)).toBe(0);
  });

  it("REST ok com a fila não vazia: espera a sincronização (a tela lê a cópia local)", async () => {
    const db = await entrarCarregado("rest-com-fila");
    await banco.enfileirar(
      db,
      { id: "op0", tipo: "colonia", operacao: "update", entidadeId: "c-outra", dados: {}, criadoEm: "2026-11-09T10:00:00.000Z", estado: "erro", tentativas: 1, relacionadas: [] },
      []
    );
    let terminou = false;
    sinc.sincronizar.mockImplementationOnce(
      () =>
        new Promise((r) =>
          setTimeout(() => {
            terminou = true;
            r({});
          }, 10)
        )
    );
    apis.avaliacoesApi.criar.mockResolvedValue({});
    const r = await escritas.criarAvaliacao("c1", AVALIACAO);
    expect(r.offline).toBe(false);
    expect(terminou).toBe(true);
  });

  it("erro de validação aparece como hoje e nada entra na fila", async () => {
    const db = await entrarCarregado("rest-400");
    const e400 = new ErroApi(400, "Dados inválidos", [{ campo: "parametros", mensagem: "Avalie ao menos um parâmetro" }]);
    apis.avaliacoesApi.criar.mockRejectedValue(e400);
    await expect(escritas.criarAvaliacao("c1", AVALIACAO)).rejects.toBe(e400);
    expect(await banco.contarFila(db)).toBe(0);
  });
});

describe("fila", () => {
  it("avaliação offline: fila com 1 create e a avaliação na cópia local com a prévia do score", async () => {
    const db = await entrarCarregado("offline-avaliacao");
    conexao.online = false;
    const r = await escritas.criarAvaliacao("c1", AVALIACAO);

    expect(r.offline).toBe(true);
    expect(apis.avaliacoesApi.criar).not.toHaveBeenCalled();
    expect(sinc.sincronizar).not.toHaveBeenCalled();
    const fila = await banco.lerFila(db);
    expect(fila).toEqual([
      expect.objectContaining({ tipo: "avaliacao", operacao: "create", entidadeId: r.id, coloniaId: "c1", dados: AVALIACAO, estado: "pendente", relacionadas: ["c1"] }),
    ]);
    expect(await db.get("avaliacoes", r.id)).toMatchObject({ coloniaId: "c1", scoreGeral: 50, statusGeral: "atencao" });
  });

  it("timeout online: a operação vai para a fila com o mesmo id e a sincronização é disparada", async () => {
    const db = await entrarCarregado("timeout");
    apis.coloniasApi.criar.mockRejectedValue(new ErroApi(0, "Sem conexão com o servidor."));
    const dados = { dataEntrada: "2026-11-09T12:00:00.000Z", origem: "captura", tipoCaixa: "inpa" } as never;
    const r = await escritas.criarColonia(dados);

    expect(r.offline).toBe(true);
    const enviadoPelaRest = apis.coloniasApi.criar.mock.calls[0]![0] as { id: string };
    const [op] = await banco.lerFila(db);
    expect(op!.entidadeId).toBe(enviadoPelaRest.id);
    expect((await db.get("colonias", r.id))?.codigo).toBe("COL-001 (provisório)");
    expect(sinc.sincronizar).toHaveBeenCalledWith("timeout");
  });

  it("online, avaliação de uma colônia criada offline ainda na fila: vai para a fila, depois da colônia", async () => {
    const db = await entrarCarregado("dependencia");
    conexao.online = false;
    const nova = await escritas.criarColonia({ dataEntrada: "2026-11-09T12:00:00.000Z", origem: "captura", tipoCaixa: "inpa" } as never);
    conexao.online = true;

    const r = await escritas.criarAvaliacao(nova.id, AVALIACAO);
    expect(r.offline).toBe(true);
    expect(apis.avaliacoesApi.criar).not.toHaveBeenCalled();
    expect((await banco.lerFila(db)).map((o) => [o.tipo, o.operacao])).toEqual([["colonia", "create"], ["avaliacao", "create"]]);
  });

  it("edições offline encadeadas: só a primeira leva baseUpdatedAt; o update guarda a linha anterior", async () => {
    const db = await entrarCarregado("encadeadas");
    conexao.online = false;
    const versao = { id: "c1", updatedAt: "2026-11-01T00:00:00.000Z" };
    await escritas.atualizarColonia(versao, { observacoes: "primeira" });
    await escritas.atualizarColonia(versao, { observacoes: "segunda" });

    const [primeira, segunda] = await banco.lerFila(db);
    expect(primeira).toMatchObject({ baseUpdatedAt: "2026-11-01T00:00:00.000Z", base: { id: "c1", codigo: "TETRANGU-001" } });
    expect(segunda).not.toHaveProperty("baseUpdatedAt");
    expect(segunda!.base).toMatchObject({ observacoes: "primeira" });
    expect(await db.get("colonias", "c1")).toMatchObject({ observacoes: "segunda", updatedAt: "2026-11-01T00:00:00.000Z" });
  });

  it("excluir offline uma colônia com avaliações: mensagem do servidor, nada na fila", async () => {
    const db = await entrarCarregado("excluir-com-avaliacoes");
    conexao.online = false;
    await escritas.criarAvaliacao("c1", AVALIACAO);
    await expect(escritas.excluirColonia("c1")).rejects.toMatchObject({ status: 409, message: mensagemColoniaComAvaliacoes(1) });
    expect(await banco.contarFila(db)).toBe(1);
    expect(await db.get("colonias", "c1")).toBeDefined();
  });

  it("excluir online uma colônia com avaliação na fila: vai pelo caminho da fila e a mensagem do servidor aparece", async () => {
    const db = await entrarCarregado("excluir-online-com-pendente");
    conexao.online = false;
    await escritas.criarAvaliacao("c1", AVALIACAO);
    conexao.online = true;
    await expect(escritas.excluirColonia("c1")).rejects.toMatchObject({ status: 409 });
    expect(apis.coloniasApi.excluir).not.toHaveBeenCalled();
    expect(await banco.contarFila(db)).toBe(1);
  });

  it("editar e excluir avaliação e colheita offline: operação certa e cópia local atualizada", async () => {
    const db = await entrarCarregado("editar-excluir");
    conexao.online = false;
    const a = await escritas.criarAvaliacao("c1", AVALIACAO);
    const p = await escritas.criarProducao({ coloniaId: "c1", dataColheita: "2026-11-09T12:00:00.000Z", tipoProduto: "mel", quantidade: 10, unidade: "ml" });
    const linhaAvaliacao = await db.get("avaliacoes", a.id);

    await escritas.atualizarAvaliacao("c1", { id: a.id, updatedAt: linhaAvaliacao!.updatedAt }, { parametros: [{ parametroId: "p1", classificacao: "bom" }] });
    expect(await db.get("avaliacoes", a.id)).toMatchObject({ scoreGeral: 100, statusGeral: "excelente" });

    await escritas.excluirAvaliacao("c1", a.id);
    await escritas.excluirProducao({ id: p.id, coloniaId: "c1" });
    expect(await db.get("avaliacoes", a.id)).toBeUndefined();
    expect(await db.get("producoes", p.id)).toBeUndefined();

    const fila = await banco.lerFila(db);
    expect(fila.map((o) => [o.tipo, o.operacao, o.entidadeId, o.coloniaId])).toEqual([
      ["avaliacao", "create", a.id, "c1"],
      ["producao", "create", p.id, "c1"],
      ["avaliacao", "update", a.id, "c1"],
      ["avaliacao", "delete", a.id, "c1"],
      ["producao", "delete", p.id, "c1"],
    ]);
    // A edição guarda a linha anterior (base da junção da story 6).
    expect(fila[2]!.base).toMatchObject({ id: a.id, scoreGeral: 50 });
  });

  it("divisão de outra espécie offline: mensagem do servidor, nada na fila", async () => {
    const db = await entrarCarregado("divisao-invalida");
    conexao.online = false;
    const dados = { dataEntrada: "2026-11-09T12:00:00.000Z", origem: "divisao", tipoCaixa: "inpa", coloniaMaeId: "c1", especieId: "e-outra" } as never;
    await db.put("colonias", { ...colonia("c1", "TETRANGU-001"), especieId: "e-jatai", dataEntrada: "2026-01-01T00:00:00.000Z" });
    await expect(escritas.criarColonia(dados)).rejects.toMatchObject({
      status: 409,
      message: "A espécie deve ser a mesma da colônia mãe (TETRANGU-001): uma divisão não muda de espécie.",
    });
    expect(await banco.contarFila(db)).toBe(0);
  });

  it("divisão offline sem espécie: herda a da mãe na cópia local", async () => {
    const db = await entrarCarregado("divisao-heranca");
    await db.put("especies", { id: "e-jatai", codigo: "TETRANGU" } as never);
    await db.put("colonias", { ...colonia("c1", "TETRANGU-001"), especieId: "e-jatai", dataEntrada: "2026-01-01T00:00:00.000Z" });
    conexao.online = false;
    const r = await escritas.criarColonia({ dataEntrada: "2026-11-09T12:00:00.000Z", origem: "divisao", tipoCaixa: "inpa", coloniaMaeId: "c1" } as never);
    expect(await db.get("colonias", r.id)).toMatchObject({ especieId: "e-jatai", codigo: "TETRANGU-002 (provisório)" });
    // A operação leva o payload como o usuário enviou: o servidor faz a mesma herança.
    expect((await banco.lerFila(db))[0]!.dados).not.toHaveProperty("especieId");
  });

  it("avaliação offline: edição fora dos 7 dias e nova com parâmetro inativo são recusadas; nada na fila", async () => {
    const db = await entrarCarregado("avaliacao-invalida");
    conexao.online = false;
    const a = await escritas.criarAvaliacao("c1", AVALIACAO);
    const linha = (await db.get("avaliacoes", a.id))!;
    await db.put("avaliacoes", { ...linha, createdAt: "2026-01-01T00:00:00.000Z" });
    await expect(escritas.atualizarAvaliacao("c1", { id: a.id, updatedAt: linha.updatedAt }, { observacoesGerais: "x" })).rejects.toMatchObject({
      status: 409,
      message: "Avaliações só podem ser editadas nos primeiros 7 dias após o registro.",
    });

    await db.put("parametros", { ...PARAMETROS[0]!, id: "p-inativo", ativo: false });
    await expect(
      escritas.criarAvaliacao("c1", { dataAvaliacao: "2026-11-09T12:00:00.000Z", parametros: [{ parametroId: "p-inativo", classificacao: "bom" }] })
    ).rejects.toMatchObject({ status: 409 });
    expect(await banco.contarFila(db)).toBe(1);
  });

  it("edição offline mantendo um parâmetro desativado depois do registro: aceita", async () => {
    const db = await entrarCarregado("parametro-desativado");
    conexao.online = false;
    const a = await escritas.criarAvaliacao("c1", AVALIACAO);
    await db.put("parametros", { ...PARAMETROS[1]!, ativo: false });
    const linha = (await db.get("avaliacoes", a.id))!;
    await escritas.atualizarAvaliacao("c1", { id: a.id, updatedAt: linha.updatedAt }, { parametros: [{ parametroId: "p2", classificacao: "bom" }] });
    expect(await banco.contarFila(db)).toBe(2);
  });

  it("edição offline de colônia que o servidor recusaria (troca de espécie, ciclo): mensagem dele, nada na fila", async () => {
    const db = await entrarCarregado("colonia-invalida");
    await db.put("colonias", { ...colonia("c1", "TETRANGU-001"), especieId: "e-jatai", origem: "divisao", dataEntrada: "2026-01-01T00:00:00.000Z" } as ColoniaServidor);
    await db.put("colonias", { ...colonia("c2", "TETRANGU-002"), especieId: "e-jatai", origem: "divisao", coloniaMaeId: "c1", dataEntrada: "2026-01-01T00:00:00.000Z" } as ColoniaServidor);
    conexao.online = false;
    const versao = { id: "c1", updatedAt: "2026-11-01T00:00:00.000Z" };

    await expect(escritas.atualizarColonia(versao, { especieId: "e-outra" })).rejects.toMatchObject({
      status: 409,
      message:
        "A espécie de uma colônia não pode ser alterada depois de definida. Se a identificação estava errada, registre uma nova colônia e marque esta como inativa.",
    });
    await expect(escritas.atualizarColonia(versao, { coloniaMaeId: "c2" })).rejects.toMatchObject({
      status: 409,
      message: "Genealogia inválida: a colônia mãe é descendente desta colônia",
    });
    expect(await banco.contarFila(db)).toBe(0);
    expect((await db.get("colonias", "c1"))?.especieId).toBe("e-jatai");
  });

  it("identificar offline uma colônia COL: aceita, com o código provisório da espécie", async () => {
    const db = await entrarCarregado("identificar");
    await db.put("especies", { id: "e-jatai", codigo: "TETRANGU" } as never);
    await db.put("colonias", { ...colonia("c9", "COL-001"), especieId: null, origem: "captura", dataEntrada: "2026-01-01T00:00:00.000Z" } as ColoniaServidor);
    conexao.online = false;
    await escritas.atualizarColonia({ id: "c9", updatedAt: "2026-11-01T00:00:00.000Z" }, { especieId: "e-jatai" });
    expect(await db.get("colonias", "c9")).toMatchObject({ especieId: "e-jatai", codigo: "TETRANGU-002 (provisório)" });
    expect(await banco.contarFila(db)).toBe(1);
  });

  it("online sem pendência: a divisão inválida vai à REST e o servidor decide", async () => {
    await entrarCarregado("divisao-online");
    const e409 = new ErroApi(409, "A espécie deve ser a mesma da colônia mãe (TETRANGU-001): uma divisão não muda de espécie.");
    apis.coloniasApi.criar.mockRejectedValue(e409);
    const dados = { dataEntrada: "2026-11-09T12:00:00.000Z", origem: "divisao", tipoCaixa: "inpa", coloniaMaeId: "c1", especieId: "e-outra" } as never;
    await expect(escritas.criarColonia(dados)).rejects.toBe(e409);
    expect(apis.coloniasApi.criar).toHaveBeenCalledTimes(1);
  });

  it("excluir offline remove a linha local (a colônia leva as colheitas)", async () => {
    const db = await entrarCarregado("excluir");
    conexao.online = false;
    await escritas.criarProducao({ coloniaId: "c1", dataColheita: "2026-11-09T12:00:00.000Z", tipoProduto: "mel", quantidade: 10, unidade: "ml" });
    await escritas.excluirColonia("c1");
    expect(await db.count("colonias")).toBe(0);
    expect(await db.count("producoes")).toBe(0);
    expect((await banco.lerFila(db)).map((o) => o.operacao)).toEqual(["create", "delete"]);
  });

  it("sem cópia local carregada, offline: erro de conexão, nada gravado", async () => {
    useAuth.setState({ token: "t", usuario: usuario("nunca-carregado") });
    conexao.online = false;
    await expect(escritas.criarAvaliacao("c1", AVALIACAO)).rejects.toMatchObject({ status: 0 });
    expect(await banco.contarFila(await banco.abrirBanco("nunca-carregado"))).toBe(0);
  });

  it("editar offline um registro fora da cópia local: aviso, nada na fila", async () => {
    const db = await entrarCarregado("fora-da-copia");
    conexao.online = false;
    await expect(escritas.atualizarProducao({ id: "p-x", coloniaId: "c1", updatedAt: "2026-11-01T00:00:00.000Z" }, { quantidade: 1 })).rejects.toMatchObject({ status: 0 });
    expect(await banco.contarFila(db)).toBe(0);
  });
});
