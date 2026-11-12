import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../store/auth";
import { useSincronizacao } from "../../store/sincronizacao";
import type { Usuario } from "../../types/api";
import { ErroApi } from "../api/client";
import type { ColoniaServidor, OperacaoSync, ParametroServidor, RespostaAlteracoes } from "./tipos";

// Fotos guardadas offline e o envio delas no ciclo (fila → fotos → pull), com
// IndexedDB em memória e a API mockada.
const chamadas = vi.hoisted(() => [] as string[]);
const apis = vi.hoisted(() => ({
  syncApi: { enviar: vi.fn(), alteracoes: vi.fn() },
  especiesApi: { listar: vi.fn(async () => []) },
  fotosApi: { enviar: vi.fn() },
  coloniasApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
  avaliacoesApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
  producoesApi: { criar: vi.fn(), atualizar: vi.fn(), excluir: vi.fn() },
}));
vi.mock("../api/endpoints", () => apis);
const segundoPlano = vi.hoisted(() => ({ pedirSincronizacaoEmSegundoPlano: vi.fn(async () => undefined) }));
vi.mock("./segundoPlano", () => segundoPlano);
// A compressão usa canvas, ausente no jsdom: devolve 3 bytes JPEG.
vi.mock("../../utils/imagem", () => ({ comprimirImagem: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })) }));

const banco = await import("./banco");
const { escritas } = await import("./escrita");
const { anexarFoto, fotosGuardadas } = await import("./fotos");
const { cancelarNovaTentativa, ESPERAS_MS, sincronizar } = await import("./sincronizacao");

const conexao = { online: true };
const descritorOriginal = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => conexao.online });
afterAll(() => {
  delete (navigator as { onLine?: boolean }).onLine;
  if (descritorOriginal) Object.defineProperty(Navigator.prototype, "onLine", descritorOriginal);
});

const usuario = (id: string) => ({ id, email: `${id}@x.app`, name: id, createdAt: "", meliponario: null }) as Usuario;
const colonia = { id: "c1", codigo: "TETRANGU-001", status: "ativa", especieId: null, coloniaMaeId: null, coloniaDoadoraCampeirasId: null, updatedAt: "2026-11-01T00:00:00.000Z" } as ColoniaServidor;
const PARAMETROS = [{ id: "p1", nome: "p1", ativo: true, criteriosEspecie: [] }] as unknown as ParametroServidor[];
const pull = (): RespostaAlteracoes => ({
  servidorEm: "2026-11-10T12:00:00.000Z",
  desde: null,
  colonias: [colonia],
  avaliacoes: [],
  producoes: [],
  parametros: PARAMETROS,
  idsAtuais: { colonias: ["c1"], avaliacoes: [], producoes: [], parametros: ["p1"] },
});
const AVALIACAO = { dataAvaliacao: "2026-11-10T12:00:00.000Z", parametros: [{ parametroId: "p1", classificacao: "bom" as const }] };
const arquivo = () => new File(["original grande"], "foto.jpg", { type: "image/jpeg" });

async function entrarCarregado(usuarioId: string) {
  useAuth.setState({ token: "t", usuario: usuario(usuarioId) });
  const db = await banco.abrirBanco(usuarioId);
  await banco.aplicarPull(db, pull(), new Set(), []);
  return db;
}

const agendadas = () => vi.mocked(setTimeout).mock.calls.filter(([, ms]) => ESPERAS_MS.includes(ms as number));

beforeEach(() => {
  vi.clearAllMocks();
  chamadas.length = 0;
  conexao.online = true;
  apis.syncApi.alteracoes.mockImplementation(async () => {
    chamadas.push("pull");
    return pull();
  });
  apis.syncApi.enviar.mockImplementation(async (ops: OperacaoSync[]) => {
    chamadas.push("sync");
    return { servidorEm: "x", processadas: ops.length, aplicadas: ops.length, duplicadas: 0, conflitos: 0, erros: 0, resultados: ops.map((o) => ({ id: o.id, entidadeId: o.entidadeId, status: "aplicado" })) };
  });
  apis.fotosApi.enviar.mockImplementation(async () => {
    chamadas.push("foto");
    return {};
  });
  vi.spyOn(globalThis, "setTimeout");
});
afterEach(() => {
  cancelarNovaTentativa();
  vi.mocked(setTimeout).mockRestore();
});

describe("anexarFoto", () => {
  it("online, registro no servidor: sobe na hora, comprimida, e nada fica guardado", async () => {
    const db = await entrarCarregado("online");
    expect(await anexarFoto(arquivo(), { coloniaId: "c1" })).toEqual({ pendente: false });
    const [blob, vinculo] = apis.fotosApi.enviar.mock.calls[0]!;
    expect((blob as Blob).size).toBe(3);
    expect(vinculo).toEqual({ coloniaId: "c1" });
    expect(await banco.lerFotos(db)).toEqual([]);
  });

  it("offline: guarda os bytes comprimidos e o vínculo; nada é enviado", async () => {
    const db = await entrarCarregado("offline");
    conexao.online = false;
    expect(await anexarFoto(arquivo(), { coloniaId: "c1" })).toEqual({ pendente: true });
    expect(apis.fotosApi.enviar).not.toHaveBeenCalled();
    // Única pendência é a foto: ela mesma pede o envio em segundo plano.
    expect(segundoPlano.pedirSincronizacaoEmSegundoPlano).toHaveBeenCalledTimes(1);
    const [foto] = await banco.lerFotos(db);
    expect(foto).toMatchObject({ vinculo: { coloniaId: "c1" }, entidadeId: "c1", tipo: "image/jpeg", estado: "pendente", tentativas: 0 });
    expect(new Uint8Array(foto!.bytes)).toEqual(new Uint8Array([1, 2, 3]));
    await vi.waitFor(() => expect(useSincronizacao.getState().fotosPendentes).toBe(1));
  });

  it("online, mas o registro ainda está na fila: guarda (sobe depois do create)", async () => {
    const db = await entrarCarregado("na-fila");
    conexao.online = false;
    const a = await escritas.criarAvaliacao("c1", AVALIACAO);
    conexao.online = true;
    apis.syncApi.enviar.mockImplementation(() => new Promise(() => {})); // a sincronização disparada fica pendurada
    expect(await anexarFoto(arquivo(), { avaliacaoId: a.id })).toEqual({ pendente: true });
    expect(apis.fotosApi.enviar).not.toHaveBeenCalled();
    expect(await banco.fotosDoRegistro(db, a.id)).toHaveLength(1);
  });

  it("falha de rede ou servidor indisponível (5xx, 408, 429) no upload: guarda; outro 4xx aparece como hoje", async () => {
    const db = await entrarCarregado("falhas-upload");
    // Um ciclo fica pendurado no pull (antes de haver foto guardada): as sincronizações
    // disparadas por anexarFoto esperam atrás dele e não disputam o mock do upload.
    apis.syncApi.alteracoes.mockImplementation(() => new Promise(() => {}));
    void sincronizar("falhas-upload");
    await vi.waitFor(() => expect(apis.syncApi.alteracoes).toHaveBeenCalled());
    for (const status of [0, 503, 408, 429]) {
      apis.fotosApi.enviar.mockRejectedValueOnce(new ErroApi(status, "falha " + status));
      expect(await anexarFoto(arquivo(), { coloniaId: "c1" })).toEqual({ pendente: true });
    }

    const e400 = new ErroApi(400, "Formato não suportado. Envie JPEG, PNG ou WebP.");
    apis.fotosApi.enviar.mockRejectedValueOnce(e400);
    await expect(anexarFoto(arquivo(), { coloniaId: "c1" })).rejects.toBe(e400);
    expect(await banco.lerFotos(db)).toHaveLength(4);
  });

  it("sem IndexedDB e sem rede: erro de conexão (nada a guardar)", async () => {
    useAuth.setState({ token: "t", usuario: usuario("sem-idb") });
    conexao.online = false;
    const original = globalThis.indexedDB;
    // @ts-expect-error simula navegador sem IndexedDB
    delete globalThis.indexedDB;
    try {
      await expect(anexarFoto(arquivo(), { coloniaId: "c1" })).rejects.toMatchObject({ status: 0 });
    } finally {
      globalThis.indexedDB = original;
    }
  });

  it("fotosGuardadas: só as do registro, da mais antiga para a mais nova", async () => {
    await entrarCarregado("galeria");
    conexao.online = false;
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    await anexarFoto(arquivo(), { producaoId: "p-outra" });
    const guardadas = await fotosGuardadas({ coloniaId: "c1" });
    expect(guardadas).toHaveLength(2);
    expect(guardadas[0]!.criadoEm <= guardadas[1]!.criadoEm).toBe(true);
  });
});

describe("envio das fotos na sincronização", () => {
  it("avaliação offline com foto: ao reconectar, fila → foto → pull; a foto sai do banco local", async () => {
    const db = await entrarCarregado("reconexao");
    conexao.online = false;
    const a = await escritas.criarAvaliacao("c1", AVALIACAO);
    await anexarFoto(arquivo(), { avaliacaoId: a.id });
    conexao.online = true;

    const r = await sincronizar("reconexao");
    expect(chamadas).toEqual(["sync", "foto", "pull"]);
    expect(apis.fotosApi.enviar.mock.calls[0]![1]).toEqual({ avaliacaoId: a.id });
    expect(r).toMatchObject({ enviadas: 1, fotosEnviadas: 1, falhaFotos: null });
    expect(await banco.lerFotos(db)).toEqual([]);
    expect(useSincronizacao.getState().fotosPendentes).toBe(0);
  });

  it("create do registro parado (erro): a foto não sobe", async () => {
    const db = await entrarCarregado("parado");
    conexao.online = false;
    const a = await escritas.criarAvaliacao("c1", AVALIACAO);
    await anexarFoto(arquivo(), { avaliacaoId: a.id });
    conexao.online = true;
    apis.syncApi.enviar.mockImplementation(async (ops: OperacaoSync[]) => ({
      servidorEm: "x", processadas: 1, aplicadas: 0, duplicadas: 0, conflitos: 0, erros: 1,
      resultados: ops.map((o) => ({ id: o.id, entidadeId: o.entidadeId, status: "erro", erro: "Colônia não encontrada" })),
    }));

    await sincronizar("parado");
    expect(apis.fotosApi.enviar).not.toHaveBeenCalled();
    expect(await banco.lerFotos(db)).toHaveLength(1);
  });

  it("falha transitória (503): a foto fica, o pull acontece e há nova tentativa agendada", async () => {
    const db = await entrarCarregado("foto-503");
    conexao.online = false;
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    conexao.online = true;
    apis.fotosApi.enviar.mockRejectedValue(new ErroApi(503, "Erro 503"));

    const r = await sincronizar("foto-503");
    expect(r.falhaFotos).toMatchObject({ motivo: "servidor" });
    expect(r.pull?.ok).toBe(true);
    expect(await banco.lerFotos(db)).toHaveLength(1);
    expect(agendadas()).toHaveLength(1);
  });

  it("429 no envio guardado: a foto fica pendente e há nova tentativa", async () => {
    const db = await entrarCarregado("foto-429");
    conexao.online = false;
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    conexao.online = true;
    apis.fotosApi.enviar.mockRejectedValue(new ErroApi(429, "Muitas requisições"));
    const r = await sincronizar("foto-429");
    expect(r.falhaFotos).toMatchObject({ motivo: "servidor" });
    expect(await banco.lerFotos(db)).toEqual([expect.objectContaining({ estado: "pendente", tentativas: 0 })]);
    expect(agendadas()).toHaveLength(1);
  });

  it("só fotos subiram (fila vazia, pull sem mudança): as telas são avisadas para reler", async () => {
    await entrarCarregado("so-fotos");
    conexao.online = false;
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    conexao.online = true;
    // Pull sem nada novo.
    apis.syncApi.alteracoes.mockResolvedValue({ ...pull(), colonias: [], parametros: [] });
    const antes = useSincronizacao.getState().concluidas;
    const r = await sincronizar("so-fotos");
    expect(r).toMatchObject({ enviadas: 0, fotosEnviadas: 1 });
    expect(useSincronizacao.getState().concluidas).toBe(antes + 1);
  });

  it("foto descartada (404) também avisa as telas, para a galeria tirar a foto", async () => {
    await entrarCarregado("so-descarte");
    conexao.online = false;
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    conexao.online = true;
    apis.syncApi.alteracoes.mockResolvedValue({ ...pull(), colonias: [], parametros: [] });
    apis.fotosApi.enviar.mockRejectedValue(new ErroApi(404, "Colônia não encontrada"));
    const antes = useSincronizacao.getState().concluidas;
    await sincronizar("so-descarte");
    expect(useSincronizacao.getState().concluidas).toBe(antes + 1);
  });

  it("erro que não vem da API: a foto para e não segura as seguintes", async () => {
    const db = await entrarCarregado("foto-local");
    conexao.online = false;
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    conexao.online = true;
    apis.fotosApi.enviar.mockRejectedValueOnce(new TypeError("bytes ilegíveis"));
    const r = await sincronizar("foto-local");
    expect(r).toMatchObject({ fotosEnviadas: 1, falhaFotos: null });
    expect(await banco.lerFotos(db)).toEqual([expect.objectContaining({ estado: "erro", ultimoErro: "bytes ilegíveis" })]);
  });

  it("404 (o registro sumiu): a foto é descartada", async () => {
    const db = await entrarCarregado("foto-404");
    conexao.online = false;
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    conexao.online = true;
    apis.fotosApi.enviar.mockRejectedValue(new ErroApi(404, "Colônia não encontrada"));
    await sincronizar("foto-404");
    expect(await banco.lerFotos(db)).toEqual([]);
  });

  it("400 (arquivo recusado): a foto para com a mensagem e não é reenviada", async () => {
    const db = await entrarCarregado("foto-400");
    conexao.online = false;
    await anexarFoto(arquivo(), { coloniaId: "c1" });
    conexao.online = true;
    apis.fotosApi.enviar.mockRejectedValue(new ErroApi(400, "Formato não suportado. Envie JPEG, PNG ou WebP."));

    const r = await sincronizar("foto-400");
    expect(r.falhaFotos).toBeNull();
    expect(await banco.lerFotos(db)).toEqual([
      expect.objectContaining({ estado: "erro", tentativas: 1, ultimoErro: "Formato não suportado. Envie JPEG, PNG ou WebP." }),
    ]);
    await sincronizar("foto-400");
    expect(apis.fotosApi.enviar).toHaveBeenCalledTimes(1);
    expect(agendadas()).toEqual([]);
  });
});
