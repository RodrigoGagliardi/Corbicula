import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import type { Usuario } from "../../types/api";
import type { AvaliacaoServidor, ColoniaServidor, FotoPendente, OperacaoFila, OperacaoSync, ParametroServidor, RespostaAlteracoes, StatusSync } from "./tipos";

// Decisões sobre operações paradas e a junção automática no ciclo, com
// IndexedDB em memória e a API mockada.
const apis = vi.hoisted(() => ({
  syncApi: { enviar: vi.fn(), alteracoes: vi.fn() },
  especiesApi: { listar: vi.fn(async () => []) },
  fotosApi: { enviar: vi.fn(async () => ({})) },
  coloniasApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
  avaliacoesApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
  producoesApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
}));
vi.mock("../api/endpoints", () => apis);
vi.mock("../../utils/imagem", () => ({ comprimirImagem: vi.fn(async () => new Blob([new Uint8Array([1])], { type: "image/jpeg" })) }));

const banco = await import("./banco");
const { escritas } = await import("./escrita");
const { anexarFoto } = await import("./fotos");
const decisoes = await import("./decisoes");
const { cancelarNovaTentativa, sincronizar } = await import("./sincronizacao");

const conexao = { online: true };
const descritorOriginal = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => conexao.online });
afterAll(() => {
  delete (navigator as { onLine?: boolean }).onLine;
  if (descritorOriginal) Object.defineProperty(Navigator.prototype, "onLine", descritorOriginal);
});

const usuario = (id: string) => ({ id, email: `${id}@x.app`, name: id, createdAt: "", meliponario: null }) as Usuario;
const C1 = {
  id: "c1",
  codigo: "TETRANGU-001",
  status: "ativa",
  origem: "captura",
  especieId: "e-jatai",
  coloniaMaeId: null,
  coloniaDoadoraCampeirasId: null,
  observacoes: "antes",
  localizacao: "antiga",
  dataEntrada: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
} as ColoniaServidor;
const PARAMETROS = [{ id: "p1", nome: "Fluxo", ativo: true, criteriosEspecie: [] }] as unknown as ParametroServidor[];
const pull = (colonias: ColoniaServidor[] = [C1]): RespostaAlteracoes => ({
  servidorEm: "2026-11-10T12:00:00.000Z",
  desde: null,
  colonias,
  avaliacoes: [],
  producoes: [],
  parametros: PARAMETROS,
  idsAtuais: { colonias: colonias.map((c) => c.id), avaliacoes: [], producoes: [], parametros: ["p1"] },
});
const AVALIACAO = { dataAvaliacao: "2026-11-10T12:00:00.000Z", parametros: [{ parametroId: "p1", classificacao: "bom" as const }] };

async function entrarCarregado(usuarioId: string) {
  useAuth.setState({ token: "t", usuario: usuario(usuarioId) });
  const db = await banco.abrirBanco(usuarioId);
  await banco.aplicarPull(db, pull(), new Set(), [{ id: "e-jatai", codigo: "TETRANGU", nomePopular: "Jataí" } as never]);
  return db;
}

// O servidor responde por operação: `status(op)` decide; conflito devolve `servidor`.
function servidor(status: (op: OperacaoSync) => StatusSync, versao?: (op: OperacaoSync) => unknown, erro?: string) {
  apis.syncApi.enviar.mockImplementation(async (ops: OperacaoSync[]) => ({
    servidorEm: "x",
    processadas: ops.length,
    aplicadas: 0,
    duplicadas: 0,
    conflitos: 0,
    erros: 0,
    resultados: ops.map((o) => {
      const s = status(o);
      return { id: o.id, entidadeId: o.entidadeId, status: s, ...(s === "conflito" && { servidor: versao?.(o) }), ...(s === "erro" && { erro }) };
    }),
  }));
}

// Deixa uma operação parada: faz a escrita offline e sincroniza com o servidor respondendo `status`.
async function pararComo(usuarioId: string, escrever: () => Promise<unknown>, status: StatusSync, versao?: () => unknown, erro?: string) {
  conexao.online = false;
  await escrever();
  conexao.online = true;
  servidor(() => status, versao, erro);
  await sincronizar(usuarioId);
}

beforeEach(() => {
  vi.clearAllMocks();
  conexao.online = true;
  apis.syncApi.alteracoes.mockResolvedValue(pull());
});
afterEach(() => cancelarNovaTentativa());

describe("junção automática no ciclo", () => {
  it("campos distintos: reenviada no mesmo ciclo só com o campo do aparelho, sobre a versão do servidor", async () => {
    const db = await entrarCarregado("juncao");
    conexao.online = false;
    await escritas.atualizarColonia(C1, { observacoes: "do aparelho", localizacao: "antiga" });
    conexao.online = true;
    const doServidor = { ...C1, localizacao: "do servidor", updatedAt: "2026-11-09T10:00:00.000Z", especie: null };
    let rodada = 0;
    apis.syncApi.enviar.mockImplementation(async (ops: OperacaoSync[]) => {
      rodada += 1;
      const status = rodada === 1 ? "conflito" : "aplicado";
      return { servidorEm: "x", processadas: 1, aplicadas: 0, duplicadas: 0, conflitos: 0, erros: 0, resultados: ops.map((o) => ({ id: o.id, entidadeId: o.entidadeId, status, servidor: doServidor })) };
    });

    const r = await sincronizar("juncao");
    const segunda = apis.syncApi.enviar.mock.calls[1]![0] as OperacaoSync[];
    expect(segunda[0]).toMatchObject({ dados: { observacoes: "do aparelho" }, baseUpdatedAt: "2026-11-09T10:00:00.000Z" });
    expect(r.naFila).toBe(0);
    expect(await banco.contarFila(db)).toBe(0);
  });
});

describe("decisões", () => {
  const conflitoObs = () => ({ ...C1, observacoes: "do servidor", updatedAt: "2026-11-09T10:00:00.000Z", especie: { id: "e-jatai" }, _count: {} });

  it("listarPendencias: rótulo, rota de edição com ?pendencia e o que sai junto", async () => {
    await entrarCarregado("listar");
    await pararComo("listar", () => escritas.atualizarColonia(C1, { observacoes: "do aparelho" }), "conflito", conflitoObs);
    conexao.online = false;
    await escritas.atualizarColonia(C1, { localizacao: "depois" });
    conexao.online = true;

    const [p] = await decisoes.listarPendencias();
    expect(p).toMatchObject({ rotulo: "Colônia TETRANGU-001", rotaDetalhe: "/app/colonias/c1", seguintes: 1 });
    expect(p!.rotaEdicao).toBe(`/app/colonias/c1/editar?pendencia=${p!.op.id}`);
    expect(p!.op.conflitos).toEqual([{ campo: "observacoes", local: "do aparelho", servidor: "do servidor" }]);
    expect(await decisoes.pendenciaDoRegistro("c1")).toMatchObject({ id: p!.op.id });
  });

  it("manter a do servidor: tira a parada e as seguintes; a cópia local recebe a versão do servidor", async () => {
    const db = await entrarCarregado("servidor");
    await pararComo("servidor", () => escritas.atualizarColonia(C1, { observacoes: "do aparelho" }), "conflito", conflitoObs);
    conexao.online = false;
    await escritas.atualizarColonia(C1, { localizacao: "depois" });
    const [p] = await decisoes.listarPendencias();

    await decisoes.manterServidor(p!.op.id);
    expect(await banco.contarFila(db)).toBe(0);
    const linha = await db.get("colonias", "c1");
    expect(linha).toMatchObject({ observacoes: "do servidor", localizacao: "antiga", updatedAt: "2026-11-09T10:00:00.000Z" });
    expect(linha).not.toHaveProperty("especie");
  });

  it("manter a deste aparelho: volta a pendente com todos os campos locais, sobre a versão do servidor", async () => {
    const db = await entrarCarregado("aparelho");
    await pararComo("aparelho", () => escritas.atualizarColonia(C1, { observacoes: "do aparelho" }), "conflito", conflitoObs);
    const [p] = await decisoes.listarPendencias();
    conexao.online = false;
    await decisoes.manterAparelho(p!.op.id);
    const [op] = await banco.lerFila(db);
    expect(op).toMatchObject({ estado: "pendente", dados: { observacoes: "do aparelho" }, baseUpdatedAt: "2026-11-09T10:00:00.000Z" });
    expect(op).not.toHaveProperty("conflitos");
    expect((await db.get("colonias", "c1"))?.observacoes).toBe("do aparelho");
  });

  it("descartar o create recusado de uma colônia leva junto a avaliação e a foto criadas a partir dela", async () => {
    const db = await entrarCarregado("descartar-create");
    conexao.online = false;
    const nova = await escritas.criarColonia({ dataEntrada: "2026-11-10T12:00:00.000Z", origem: "captura", tipoCaixa: "inpa" } as never);
    const a = await escritas.criarAvaliacao(nova.id, AVALIACAO);
    await anexarFoto(new File(["x"], "f.jpg"), { avaliacaoId: a.id });
    conexao.online = true;
    servidor(() => "erro", undefined, "Recusada");
    await sincronizar("descartar-create");

    const [p] = await decisoes.listarPendencias();
    expect(p).toMatchObject({ dependentes: { operacoes: 1, fotos: 1 } });
    await decisoes.descartarPendencia(p!.op.id);
    expect(await banco.contarFila(db)).toBe(0);
    expect(await db.get("colonias", nova.id)).toBeUndefined();
    expect(await db.get("avaliacoes", a.id)).toBeUndefined();
    expect(await banco.lerFotos(db)).toEqual([]);
  });

  it("descartar um update recusado: volta a linha anterior e saem as seguintes do registro", async () => {
    const db = await entrarCarregado("descartar-update");
    await pararComo("descartar-update", () => escritas.atualizarColonia(C1, { observacoes: "recusada" }), "erro", undefined, "Não pode");
    conexao.online = false;
    await escritas.atualizarColonia(C1, { localizacao: "depois" });
    const [p] = await decisoes.listarPendencias();
    await decisoes.descartarPendencia(p!.op.id);
    expect(await banco.contarFila(db)).toBe(0);
    expect(await db.get("colonias", "c1")).toMatchObject({ observacoes: "antes", localizacao: "antiga" });
  });

  it("descartar uma exclusão recusada: o próximo pull é uma carga completa (a linha volta)", async () => {
    const db = await entrarCarregado("descartar-delete");
    await pararComo("descartar-delete", () => escritas.excluirColonia("c1"), "erro", undefined, "Não pode excluir");
    expect(await db.get("colonias", "c1")).toBeUndefined();
    const [p] = await decisoes.listarPendencias();
    expect(p!.rotaEdicao).toBeNull();

    conexao.online = false;
    await decisoes.descartarPendencia(p!.op.id);
    expect((await banco.lerMeta(db)).recarregar).toBe(true);
    conexao.online = true;
    apis.syncApi.alteracoes.mockClear();
    await sincronizar("descartar-delete");
    expect(apis.syncApi.alteracoes).toHaveBeenCalledWith(undefined);
    expect(await db.get("colonias", "c1")).toBeDefined();
    expect((await banco.lerMeta(db)).recarregar).toBeUndefined();
  });

  it("editar manualmente um create recusado: continua create, na mesma posição, antes da avaliação que depende dele", async () => {
    const db = await entrarCarregado("substituir-create");
    conexao.online = false;
    const nova = await escritas.criarColonia({ dataEntrada: "2026-11-10T12:00:00.000Z", origem: "captura", tipoCaixa: "inpa", observacoes: "errada" } as never);
    await escritas.criarAvaliacao(nova.id, AVALIACAO);
    conexao.online = true;
    servidor(() => "erro", undefined, "Recusada");
    await sincronizar("substituir-create");
    const [p] = await decisoes.listarPendencias();

    conexao.online = false;
    await decisoes.substituirPendencia(p!.op.id, { observacoes: "corrigida" });
    const fila = await banco.lerFila(db);
    expect(fila.map((o) => [o.tipo, o.operacao, o.estado])).toEqual([["colonia", "create", "pendente"], ["avaliacao", "create", "pendente"]]);
    expect(fila[0]).toMatchObject({ ordem: p!.op.ordem, entidadeId: nova.id, dados: expect.objectContaining({ origem: "captura", observacoes: "corrigida" }) });
    expect((await db.get("colonias", nova.id))?.observacoes).toBe("corrigida");
  });

  it("editar manualmente um conflito: update sobre a versão do servidor", async () => {
    const db = await entrarCarregado("substituir-update");
    await pararComo("substituir-update", () => escritas.atualizarColonia(C1, { observacoes: "do aparelho" }), "conflito", conflitoObs);
    const [p] = await decisoes.listarPendencias();
    conexao.online = false;
    await decisoes.substituirPendencia(p!.op.id, { observacoes: "juntei as duas" });
    const [op] = await banco.lerFila(db);
    expect(op).toMatchObject({ operacao: "update", estado: "pendente", dados: { observacoes: "juntei as duas" }, baseUpdatedAt: "2026-11-09T10:00:00.000Z" });
    expect(op!.id).not.toBe(p!.op.id);
  });

  it("editar manualmente com dado que o servidor recusaria: mensagem dele, a pendência continua", async () => {
    const db = await entrarCarregado("substituir-invalido");
    await pararComo("substituir-invalido", () => escritas.atualizarColonia(C1, { observacoes: "x" }), "erro", undefined, "Recusada");
    const [p] = await decisoes.listarPendencias();
    await expect(decisoes.substituirPendencia(p!.op.id, { especieId: "e-outra" })).rejects.toMatchObject({ status: 409 });
    expect(await banco.lerFila(db)).toEqual([expect.objectContaining({ id: p!.op.id, estado: "erro" })]);
  });

  it("pendência já resolvida: 404 com aviso", async () => {
    await entrarCarregado("resolvida");
    await expect(decisoes.manterServidor("nao-existe")).rejects.toMatchObject({ status: 404, message: "Esta pendência já foi resolvida." });
  });
});

describe("regras das decisões", () => {
  it("manter a deste aparelho não reenvia campo que só o servidor mudou", () => {
    const op = {
      id: "o", tipo: "colonia", operacao: "update", entidadeId: "c1", criadoEm: "", ordem: 1, estado: "conflito", tentativas: 1, relacionadas: [],
      dados: { observacoes: "A", localizacao: "antiga" },
      base: { id: "c1", observacoes: "antes", localizacao: "antiga" },
      servidor: { id: "c1", observacoes: "B", localizacao: "do servidor", updatedAt: "2026-11-09T10:00:00.000Z" },
    } as unknown as OperacaoFila;
    const [nova] = decisoes.planoAparelho(op).gravarOperacoes;
    expect(nova!.dados).toEqual({ observacoes: "A" });
    expect(nova!.baseUpdatedAt).toBe("2026-11-09T10:00:00.000Z");
  });

  it("servidor e descarte de update pedem recarga completa; descarte só de create não", () => {
    const base = { tipo: "colonia", entidadeId: "c1", criadoEm: "", tentativas: 1, relacionadas: [], dados: {} };
    const upd = { ...base, id: "u", operacao: "update", ordem: 1, estado: "erro", base: { id: "c1" } } as unknown as OperacaoFila;
    const cre = { ...base, id: "c", entidadeId: "c2", operacao: "create", ordem: 2, estado: "erro" } as unknown as OperacaoFila;
    expect(decisoes.planoServidor([upd], upd).recarregarTudo).toBe(true);
    expect(decisoes.planoDescartar([upd], [], upd).recarregarTudo).toBe(true);
    expect(decisoes.planoDescartar([cre], [], cre).recarregarTudo).toBe(false);
  });
});

describe("decisões sobre avaliação e colheita", () => {
  it("manter a do servidor numa avaliação: a linha local fica com os parâmetros, sem objetos embutidos", async () => {
    const db = await entrarCarregado("av-servidor");
    // Avaliação que já está no servidor (como viria do pull).
    const a = { id: "a1" };
    const linha = {
      id: "a1", coloniaId: "c1", dataAvaliacao: "2026-11-10T12:00:00.000Z", duracaoMinutos: null, temperatura: null, umidade: null,
      condicaoClimatica: null, observacoesGerais: null, acoesTomadas: [], motivoInspecao: null, motivoInspecaoDetalhe: null,
      motivosAcoes: null, climaFonte: null, protocoloId: null, scoreGeral: 100, statusGeral: "excelente",
      createdAt: new Date().toISOString(), updatedAt: "2026-11-01T00:00:00.000Z",
      parametros: [{ id: "ap1", avaliacaoId: "a1", parametroId: "p1", classificacao: "bom", valorNumerico: null, observacoes: null, createdAt: "" }],
    } as AvaliacaoServidor;
    await db.put("avaliacoes", linha);
    const versaoServidor = {
      ...linha,
      observacoesGerais: "do servidor",
      updatedAt: "2026-11-11T10:00:00.000Z",
      colonia: { id: "c1", codigo: "TETRANGU-001" },
      _count: { parametros: 1 },
      parametros: [{ id: "ap9", avaliacaoId: a.id, parametroId: "p1", classificacao: "ruim", valorNumerico: null, observacoes: null, createdAt: "", parametro: { id: "p1", nome: "Fluxo" } }],
    };
    await pararComo("av-servidor", () => escritas.atualizarAvaliacao("c1", linha, { observacoesGerais: "do aparelho" }), "conflito", () => versaoServidor);
    const [p] = await decisoes.listarPendencias();
    await decisoes.manterServidor(p!.op.id);
    const nova = (await db.get("avaliacoes", a.id))!;
    expect(nova).toMatchObject({ observacoesGerais: "do servidor" });
    expect(nova).not.toHaveProperty("colonia");
    expect(nova.parametros).toEqual([expect.objectContaining({ parametroId: "p1", classificacao: "ruim" })]);
    expect(nova.parametros[0]).not.toHaveProperty("parametro");
  });

  it("editar manualmente uma colheita recusada; e só conflito tem servidor/aparelho", async () => {
    const db = await entrarCarregado("colheita");
    conexao.online = false;
    const p = await escritas.criarProducao({ coloniaId: "c1", dataColheita: "2026-11-10T12:00:00.000Z", tipoProduto: "mel", quantidade: 10, unidade: "ml" });
    conexao.online = true;
    servidor(() => "erro", undefined, "Recusada");
    await sincronizar("colheita");
    const [pend] = await decisoes.listarPendencias();
    expect(pend!.rotaEdicao).toBe(`/app/producao/${p.id}/editar?pendencia=${pend!.op.id}`);
    await expect(decisoes.manterServidor(pend!.op.id)).rejects.toMatchObject({ status: 409 });

    conexao.online = false;
    await decisoes.substituirPendencia(pend!.op.id, { quantidade: 25 });
    const [op] = await banco.lerFila(db);
    expect(op).toMatchObject({ operacao: "create", dados: expect.objectContaining({ quantidade: 25, coloniaId: "c1" }) });
    expect((await db.get("producoes", p.id))?.quantidade).toBe(25);
  });

  it("editar manualmente não perde a mudança de status feita offline", async () => {
    const db = await entrarCarregado("status-offline");
    await pararComo("status-offline", () => escritas.atualizarColonia(C1, { status: "morta", motivoStatus: "fome_escassez" }), "erro", undefined, "Recusada");
    const [p] = await decisoes.listarPendencias();
    conexao.online = false;
    await decisoes.substituirPendencia(p!.op.id, { observacoes: "corrigida" });
    const [op] = await banco.lerFila(db);
    expect(op!.dados).toMatchObject({ status: "morta", motivoStatus: "fome_escassez", observacoes: "corrigida" });
  });
});

describe("dependentesDoDescarte (cascata)", () => {
  const op = (id: string, entidadeId: string, parcial: Partial<OperacaoFila> = {}): OperacaoFila => ({
    id,
    tipo: "colonia",
    operacao: "create",
    entidadeId,
    dados: {},
    criadoEm: "",
    ordem: Number(id.replace(/\D/g, "")),
    estado: "pendente",
    tentativas: 0,
    relacionadas: [],
    ...parcial,
  });

  it("divisão criada da colônia descartada e a avaliação da divisão saem juntas; outras ficam", () => {
    const mae = op("o1", "mae", { estado: "erro" });
    const filha = op("o2", "filha", { relacionadas: ["mae"] });
    const avDaFilha = op("o3", "av", { tipo: "avaliacao", relacionadas: ["filha"] });
    const outra = op("o4", "outra");
    const fotos = [{ id: "f1", entidadeId: "av" }, { id: "f2", entidadeId: "outra" }] as FotoPendente[];
    const r = decisoes.dependentesDoDescarte([mae, filha, avDaFilha, outra], fotos, mae);
    expect(r.operacoes.map((o) => o.id)).toEqual(["o2", "o3"]);
    // A edição seguinte de um registro que sai junto também sai.
    const edicaoDaFilha = op("o5", "filha", { operacao: "update" });
    expect(decisoes.dependentesDoDescarte([mae, filha, avDaFilha, outra, edicaoDaFilha], [], mae).operacoes.map((o) => o.id)).toEqual(["o2", "o3", "o5"]);
    expect(r.fotos.map((f) => f.id)).toEqual(["f1"]);
  });
});
