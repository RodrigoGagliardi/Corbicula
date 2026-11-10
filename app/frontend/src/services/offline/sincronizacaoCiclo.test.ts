import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import { useSincronizacao } from "../../store/sincronizacao";
import type { Usuario } from "../../types/api";
import { ErroApi } from "../api/client";
import type { ColoniaServidor, ParametroServidor, OperacaoFila, OperacaoSync, RespostaAlteracoes, RespostaSync, StatusSync } from "./tipos";

// Ciclo completo (fila → POST /sync → pull) com IndexedDB em memória e a API mockada.
const apis = vi.hoisted(() => ({
  syncApi: { enviar: vi.fn(), alteracoes: vi.fn() },
  especiesApi: { listar: vi.fn(async () => []) },
  coloniasApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
  avaliacoesApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
  producoesApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
}));
vi.mock("../api/endpoints", () => apis);

const banco = await import("./banco");
const { escritas } = await import("./escrita");
const { cancelarNovaTentativa, ESPERAS_MS, esperaDaTentativa, sincronizacaoOk, sincronizar } = await import("./sincronizacao");

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
const colonia = (id: string, codigo: string, observacoes: string | null = null) =>
  ({ id, codigo, observacoes, status: "ativa", especieId: null, coloniaMaeId: null, coloniaDoadoraCampeirasId: null, updatedAt: "2026-11-01T00:00:00.000Z" }) as ColoniaServidor;

const pull = (parcial: Partial<RespostaAlteracoes> = {}): RespostaAlteracoes => ({
  servidorEm: "2026-11-09T12:00:00.000Z",
  desde: null,
  colonias: [],
  avaliacoes: [],
  producoes: [],
  parametros: PARAMETROS,
  idsAtuais: { colonias: ["c1"], avaliacoes: [], producoes: [], parametros: ["p1", "p2"] },
  ...parcial,
});

// O servidor responde a cada operação com o status escolhido (padrão: aplicado).
function servidor(status: (op: OperacaoSync) => StatusSync = () => "aplicado", extra: Partial<RespostaSync["resultados"][number]> = {}) {
  apis.syncApi.enviar.mockImplementation(async (operacoes: OperacaoSync[]) => ({
    servidorEm: "2026-11-09T12:00:00.000Z",
    processadas: operacoes.length,
    aplicadas: 0,
    duplicadas: 0,
    conflitos: 0,
    erros: 0,
    resultados: operacoes.map((o) => ({ id: o.id, entidadeId: o.entidadeId, status: status(o), ...extra })),
  }));
}

async function entrarCarregado(usuarioId: string) {
  useAuth.setState({ token: "t", usuario: usuario(usuarioId) });
  const db = await banco.abrirBanco(usuarioId);
  await banco.aplicarPull(db, pull({ colonias: [colonia("c1", "TETRANGU-001")] }), new Set(), []);
  return db;
}

const AVALIACAO = { dataAvaliacao: "2026-11-09T12:00:00.000Z", parametros: [{ parametroId: "p1", classificacao: "bom" as const }] };
const COLONIA = { dataEntrada: "2026-11-09T12:00:00.000Z", origem: "captura", tipoCaixa: "inpa" } as never;

// Três escritas offline: colônia, avaliação (na c1) e colheita.
async function tresEscritasOffline() {
  conexao.online = false;
  const c = await escritas.criarColonia(COLONIA);
  const a = await escritas.criarAvaliacao("c1", AVALIACAO);
  const p = await escritas.criarProducao({ coloniaId: "c1", dataColheita: "2026-11-09T12:00:00.000Z", tipoProduto: "mel", quantidade: 10, unidade: "ml" });
  conexao.online = true;
  return [c.id, a.id, p.id];
}

const agendadas = () => vi.mocked(setTimeout).mock.calls.filter(([, ms]) => ESPERAS_MS.includes(ms as number));

beforeEach(() => {
  vi.clearAllMocks();
  conexao.online = true;
  apis.syncApi.alteracoes.mockResolvedValue(pull());
  servidor();
  vi.spyOn(globalThis, "setTimeout");
});

afterEach(() => {
  cancelarNovaTentativa();
  vi.mocked(setTimeout).mockRestore();
});

describe("sincronizar", () => {
  it("reconexão: envia as 3 operações num lote, na ordem, esvazia a fila e faz o pull com os mesmos ids", async () => {
    const db = await entrarCarregado("reconexao");
    const ids = await tresEscritasOffline();
    const concluidasAntes = useSincronizacao.getState().concluidas;

    const r = await sincronizar("reconexao");

    expect(sincronizacaoOk(r)).toBe(true);
    expect(r).toMatchObject({ enviadas: 3, paradas: 0, naFila: 0 });
    expect(apis.syncApi.enviar).toHaveBeenCalledTimes(1);
    const enviadas = apis.syncApi.enviar.mock.calls[0]![0] as OperacaoSync[];
    expect(enviadas.map((o) => [o.tipo, o.entidadeId])).toEqual([["colonia", ids[0]], ["avaliacao", ids[1]], ["producao", ids[2]]]);
    expect(enviadas[1]).toMatchObject({ coloniaId: "c1", dados: AVALIACAO });
    expect(apis.syncApi.alteracoes).toHaveBeenCalledTimes(1);
    expect(await banco.contarFila(db)).toBe(0);
    expect(useSincronizacao.getState()).toMatchObject({ sincronizando: false, naFila: 0, concluidas: concluidasAntes + 1 });
  });

  it("envio interrompido: o reenvio usa os mesmos ids e `duplicado` tira da fila", async () => {
    const db = await entrarCarregado("interrompido");
    await tresEscritasOffline();
    apis.syncApi.enviar.mockRejectedValueOnce(new ErroApi(0, "Sem conexão com o servidor."));

    const primeira = await sincronizar("interrompido");
    expect(primeira.falhaEnvio).toMatchObject({ motivo: "sem-conexao" });
    expect(await banco.contarFila(db)).toBe(3);

    servidor(() => "duplicado");
    const segunda = await sincronizar("interrompido");
    const ids = (n: number) => (apis.syncApi.enviar.mock.calls[n]![0] as OperacaoSync[]).map((o) => o.id);
    expect(ids(1)).toEqual(ids(0));
    expect(segunda).toMatchObject({ enviadas: 3, naFila: 0 });
  });

  it("servidor fora (503): fila intacta, sem pull, nova tentativa agendada com espera crescente", async () => {
    const db = await entrarCarregado("fora-do-ar");
    await tresEscritasOffline();
    apis.syncApi.enviar.mockRejectedValue(new ErroApi(503, "Erro 503"));

    const r = await sincronizar("fora-do-ar");
    expect(r.falhaEnvio).toMatchObject({ motivo: "servidor" });
    expect(r.pull).toBeNull();
    expect(apis.syncApi.alteracoes).not.toHaveBeenCalled();
    expect(await banco.contarFila(db)).toBe(3);
    expect(agendadas().map(([, ms]) => ms)).toEqual([ESPERAS_MS[0]]);

    await sincronizar("fora-do-ar");
    expect(agendadas().map(([, ms]) => ms)).toEqual([ESPERAS_MS[0], ESPERAS_MS[1]]);
  });

  it("token expirado (401): fila intacta e nenhuma nova tentativa (o novo login sincroniza)", async () => {
    const db = await entrarCarregado("expirado");
    await tresEscritasOffline();
    apis.syncApi.enviar.mockRejectedValue(new ErroApi(401, "Token inválido"));

    const r = await sincronizar("expirado");
    expect(r.falhaEnvio).toMatchObject({ motivo: "sessao" });
    expect(await banco.contarFila(db)).toBe(3);
    expect(agendadas()).toEqual([]);
  });

  it("recusa no create da colônia: fica parada e a avaliação dela não é enviada depois", async () => {
    const db = await entrarCarregado("recusa");
    conexao.online = false;
    const nova = await escritas.criarColonia(COLONIA);
    conexao.online = true;
    servidor(() => "erro", { erro: "A espécie deve ser a mesma da colônia mãe" });
    expect(await sincronizar("recusa")).toMatchObject({ enviadas: 0, paradas: 1, naFila: 1 });

    conexao.online = false;
    await escritas.criarAvaliacao(nova.id, AVALIACAO);
    conexao.online = true;
    servidor();
    apis.syncApi.enviar.mockClear();

    const r = await sincronizar("recusa");
    expect(apis.syncApi.enviar).not.toHaveBeenCalled();
    expect(r.naFila).toBe(2);
    const [parada] = await banco.lerFila(db);
    expect(parada).toMatchObject({ estado: "erro", ultimoErro: "A espécie deve ser a mesma da colônia mãe" });
  });

  it("conflito: fica parado com a versão do servidor e o pull não sobrescreve a cópia local", async () => {
    const db = await entrarCarregado("conflito");
    conexao.online = false;
    await escritas.atualizarColonia({ id: "c1", updatedAt: "2026-11-01T00:00:00.000Z" }, { observacoes: "local" });
    conexao.online = true;
    const doServidor = colonia("c1", "TETRANGU-001", "do servidor");
    servidor(() => "conflito", { servidor: doServidor });
    apis.syncApi.alteracoes.mockResolvedValue(pull({ colonias: [doServidor] }));

    const r = await sincronizar("conflito");
    expect(r).toMatchObject({ paradas: 1, naFila: 1 });
    const [op] = await banco.lerFila(db);
    expect(op).toMatchObject({ estado: "conflito", servidor: doServidor, baseUpdatedAt: "2026-11-01T00:00:00.000Z" } satisfies Partial<OperacaoFila>);
    expect((await db.get("colonias", "c1"))?.observacoes).toBe("local");
  });

  it("offline: não chama a API nem agenda tentativa", async () => {
    await entrarCarregado("sem-rede");
    await tresEscritasOffline();
    conexao.online = false;
    const r = await sincronizar("sem-rede");
    expect(r).toMatchObject({ naFila: 3, falhaEnvio: { motivo: "sem-conexao" } });
    expect(apis.syncApi.enviar).not.toHaveBeenCalled();
    expect(agendadas()).toEqual([]);
  });

  it("outro usuário na sessão: não envia a fila de quem saiu", async () => {
    await entrarCarregado("dono");
    await tresEscritasOffline();
    useAuth.setState({ token: "t2", usuario: usuario("outro") });
    const r = await sincronizar("dono");
    expect(r.falhaEnvio).toMatchObject({ motivo: "sessao" });
    expect(apis.syncApi.enviar).not.toHaveBeenCalled();
  });
});

describe("ciclos, lotes e nova tentativa", () => {
  const opFila = (i: number) => ({
    id: "op-" + String(i).padStart(4, "0"),
    tipo: "colonia" as const,
    operacao: "update" as const,
    entidadeId: "ent-" + i,
    dados: {},
    criadoEm: "2026-11-09T10:00:00.000Z",
    estado: "pendente" as const,
    tentativas: 0,
    relacionadas: [],
  });

  it("mais de 500 operações: todas enviadas num ciclo, em dois lotes", async () => {
    const db = await entrarCarregado("muitas");
    for (let i = 0; i < 501; i++) await banco.enfileirar(db, opFila(i), []);
    const r = await sincronizar("muitas");
    expect(apis.syncApi.enviar.mock.calls.map(([ops]) => (ops as OperacaoSync[]).length)).toEqual([500, 1]);
    expect(r).toMatchObject({ enviadas: 501, naFila: 0 });
  });

  it("resposta sem resultados para o lote: para em vez de reenviar", async () => {
    const db = await entrarCarregado("sem-resultados");
    await banco.enfileirar(db, opFila(1), []);
    apis.syncApi.enviar.mockResolvedValue({ servidorEm: "x", processadas: 0, aplicadas: 0, duplicadas: 0, conflitos: 0, erros: 0, resultados: [] });
    await sincronizar("sem-resultados");
    expect(apis.syncApi.enviar).toHaveBeenCalledTimes(1);
    expect(await banco.contarFila(db)).toBe(1);
  });

  it("colônia criada offline e sua avaliação: dois lotes, a avaliação depois da resposta ao create", async () => {
    await entrarCarregado("dependente");
    conexao.online = false;
    const c = await escritas.criarColonia(COLONIA);
    await escritas.criarAvaliacao(c.id, AVALIACAO);
    conexao.online = true;
    await sincronizar("dependente");
    expect(apis.syncApi.enviar.mock.calls.map(([ops]) => (ops as OperacaoSync[]).map((o) => o.tipo))).toEqual([["colonia"], ["avaliacao"]]);
  });

  it("a nova tentativa agendada sincroniza de novo quando dispara", async () => {
    const db = await entrarCarregado("agendada");
    await banco.enfileirar(db, opFila(1), []);
    apis.syncApi.enviar.mockRejectedValueOnce(new ErroApi(503, "Erro 503"));
    await sincronizar("agendada");
    const [disparo] = agendadas()[0]!;
    (disparo as () => void)();
    await vi.waitFor(async () => expect(await banco.contarFila(db)).toBe(0));
    expect(apis.syncApi.enviar).toHaveBeenCalledTimes(2);
  });

  it("chamada durante um ciclo em andamento: roda outro ciclo depois dele", async () => {
    await entrarCarregado("repeticao");
    const primeiro = sincronizar("repeticao");
    const segundo = sincronizar("repeticao");
    const terceiro = sincronizar("repeticao");
    expect(terceiro).toBe(segundo);
    await Promise.all([primeiro, segundo]);
    expect(apis.syncApi.alteracoes).toHaveBeenCalledTimes(2);
  });
});

describe("esperaDaTentativa", () => {
  it("cresce de 15 s até 5 min e para aí", () => {
    expect([1, 2, 3, 4, 5, 9].map(esperaDaTentativa)).toEqual([15_000, 30_000, 60_000, 120_000, 300_000, 300_000]);
  });
});
