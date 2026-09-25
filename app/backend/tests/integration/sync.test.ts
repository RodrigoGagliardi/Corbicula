import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database";
import { criarApp, criarColonia, criarParametros, idEspecie, novoUsuario, type Cliente } from "../helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});
afterAll(async () => {
  await app.close();
});

const agora = () => new Date().toISOString();

// updatedAt tem resolução de milissegundo: a pausa garante que a próxima escrita
// fique estritamente depois do instante comparado.
const pausa = () => new Promise((r) => setTimeout(r, 10));

// Fábricas de operações como o cliente offline as montaria.
const op = {
  criarColonia: (entidadeId: string, dados: Record<string, unknown> = {}) => ({
    id: randomUUID(),
    tipo: "colonia",
    operacao: "create",
    entidadeId,
    criadoEm: agora(),
    dados: { dataEntrada: "2026-02-01T10:00:00.000Z", origem: "divisao", tipoCaixa: "INPA", ...dados },
  }),
  criarAvaliacao: (entidadeId: string, coloniaId: string, parametroId: string, classificacao = "bom") => ({
    id: randomUUID(),
    tipo: "avaliacao",
    operacao: "create",
    entidadeId,
    coloniaId,
    criadoEm: agora(),
    dados: { dataAvaliacao: "2026-02-01T10:30:00.000Z", parametros: [{ parametroId, classificacao }] },
  }),
  criarProducao: (entidadeId: string, coloniaId: string, quantidade = 100) => ({
    id: randomUUID(),
    tipo: "producao",
    operacao: "create",
    entidadeId,
    criadoEm: agora(),
    dados: { coloniaId, dataColheita: "2026-02-01T11:00:00.000Z", tipoProduto: "mel", quantidade, unidade: "ml" },
  }),
  atualizar: (tipo: string, entidadeId: string, dados: Record<string, unknown>, baseUpdatedAt?: string) => ({
    id: randomUUID(),
    tipo,
    operacao: "update",
    entidadeId,
    criadoEm: agora(),
    dados,
    ...(baseUpdatedAt && { baseUpdatedAt }),
  }),
  excluir: (tipo: string, entidadeId: string, coloniaId?: string) => ({
    id: randomUUID(),
    tipo,
    operacao: "delete",
    entidadeId,
    criadoEm: agora(),
    ...(coloniaId && { coloniaId }),
  }),
};

const status = (res: { body: { resultados: { status: string }[] } }) => res.body.resultados.map((r) => r.status);

describe("sync — push", () => {
  let api: Cliente;
  let parametroId: string;

  beforeAll(async () => {
    ({ api } = await novoUsuario(app));
    [parametroId] = (await criarParametros(api, 1)) as [string];
  });

  it("aplica em ordem: colônia criada offline + avaliação e colheita que a referenciam", async () => {
    const coloniaId = randomUUID();
    const avaliacaoId = randomUUID();
    const producaoId = randomUUID();
    const jatai = await idEspecie(api, "TETRANGU");

    const res = await api.post("/sync", {
      operacoes: [
        op.criarColonia(coloniaId, { especieId: jatai }),
        op.criarAvaliacao(avaliacaoId, coloniaId, parametroId, "medio"),
        op.criarProducao(producaoId, coloniaId),
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ processadas: 3, aplicadas: 3, erros: 0, conflitos: 0 });
    const colonia = await api.get(`/colonias/${coloniaId}`);
    expect(colonia.body.codigo).toMatch(/^TETRANGU-\d{3}$/);
    const av = await api.get(`/colonias/${coloniaId}/avaliacoes/${avaliacaoId}`);
    expect(av.body.scoreGeral).toBe(50); // mesmas regras da API REST
    expect((await api.get(`/producoes/${producaoId}`)).status).toBe(200);
  });

  it("é idempotente: reenviar a mesma operação não duplica nada", async () => {
    const coloniaId = randomUUID();
    const operacao = op.criarColonia(coloniaId);

    await api.post("/sync", { operacoes: [operacao] });
    const antes = (await api.get("/colonias")).body.length;
    const res = await api.post("/sync", { operacoes: [operacao, operacao] });

    expect(status(res)).toEqual(["duplicado", "duplicado"]);
    expect((await api.get("/colonias")).body.length).toBe(antes);
    expect(await prisma.syncQueue.count({ where: { id: operacao.id } })).toBe(1);
  });

  it("create repetido com outro id de operação conta como aplicado (a entidade já existe)", async () => {
    const coloniaId = randomUUID();
    await api.post("/sync", { operacoes: [op.criarColonia(coloniaId)] });
    const antes = (await api.get("/colonias")).body.length;

    const res = await api.post("/sync", { operacoes: [op.criarColonia(coloniaId)] });

    expect(status(res)).toEqual(["aplicado"]);
    expect((await api.get("/colonias")).body.length).toBe(antes);
  });

  it("uma operação com erro não interrompe o lote", async () => {
    const colonia = await criarColonia(api);
    const valida = op.criarProducao(randomUUID(), colonia.id, 10);
    const invalida = op.criarProducao(randomUUID(), colonia.id, -5);
    const semColonia = { ...op.criarAvaliacao(randomUUID(), colonia.id, parametroId), coloniaId: undefined };
    const coloniaInexistente = op.criarAvaliacao(randomUUID(), randomUUID(), parametroId);

    const res = await api.post("/sync", {
      operacoes: [invalida, semColonia, coloniaInexistente, valida],
    });

    expect(status(res)).toEqual(["erro", "erro", "erro", "aplicado"]);
    expect(res.body.resultados[0].erro).toContain("quantidade");
    expect(res.body.resultados[1].erro).toContain("coloniaId");
    expect(res.body.resultados[2].erro).toContain("Colônia não encontrada");
    expect((await api.get(`/producoes/${valida.entidadeId}`)).status).toBe(200);
  });

  it("operação que falhou pode ser reenviada com o mesmo id e corrigida", async () => {
    const colonia = await criarColonia(api);
    const operacao = op.criarProducao(randomUUID(), colonia.id, -1);

    expect(status(await api.post("/sync", { operacoes: [operacao] }))).toEqual(["erro"]);
    const corrigida = { ...operacao, dados: { ...operacao.dados, quantidade: 80 } };
    expect(status(await api.post("/sync", { operacoes: [corrigida] }))).toEqual(["aplicado"]);

    const registro = await prisma.syncQueue.findUnique({ where: { id: operacao.id } });
    expect(registro).toMatchObject({ tentativas: 2, sincronizado: true, resultado: "aplicado", ultimoErro: null });
  });

  it("delete de entidade inexistente conta como aplicado; delete real remove", async () => {
    const colonia = await criarColonia(api);
    const res = await api.post("/sync", {
      operacoes: [op.excluir("producao", randomUUID()), op.excluir("colonia", colonia.id)],
    });
    expect(status(res)).toEqual(["aplicado", "aplicado"]);
    expect((await api.get(`/colonias/${colonia.id}`)).status).toBe(404);
  });

  it("delete respeita as regras da API (colônia com avaliações não é excluída)", async () => {
    const coloniaId = randomUUID();
    await api.post("/sync", {
      operacoes: [op.criarColonia(coloniaId), op.criarAvaliacao(randomUUID(), coloniaId, parametroId)],
    });
    const res = await api.post("/sync", { operacoes: [op.excluir("colonia", coloniaId)] });
    expect(status(res)).toEqual(["erro"]);
    expect((await api.get(`/colonias/${coloniaId}`)).status).toBe(200);
  });

  it("valida o lote (vazio ou acima de 500 operações → 400)", async () => {
    expect((await api.post("/sync", { operacoes: [] })).status).toBe(400);
    const muitas = Array.from({ length: 501 }, () => op.excluir("colonia", randomUUID()));
    expect((await api.post("/sync", { operacoes: muitas })).status).toBe(400);
  });
});

describe("sync — conflitos", () => {
  let api: Cliente;

  beforeAll(async () => {
    ({ api } = await novoUsuario(app));
  });

  it("sem baseUpdatedAt: last-write-wins", async () => {
    const colonia = await criarColonia(api);
    const res = await api.post("/sync", {
      operacoes: [op.atualizar("colonia", colonia.id, { observacoes: "offline" })],
    });
    expect(status(res)).toEqual(["aplicado"]);
    expect((await api.get(`/colonias/${colonia.id}`)).body.observacoes).toBe("offline");
  });

  it("baseUpdatedAt anterior à versão do servidor: conflito, não aplica e devolve a versão atual", async () => {
    const colonia = await criarColonia(api);
    const versaoVista = colonia.updatedAt;
    await pausa();
    await api.patch(`/colonias/${colonia.id}`, { observacoes: "editado online" });

    const res = await api.post("/sync", {
      operacoes: [op.atualizar("colonia", colonia.id, { observacoes: "editado offline" }, versaoVista)],
    });

    expect(res.body.conflitos).toBe(1);
    expect(res.body.resultados[0]).toMatchObject({
      status: "conflito",
      servidor: { id: colonia.id, observacoes: "editado online" },
    });
    expect((await api.get(`/colonias/${colonia.id}`)).body.observacoes).toBe("editado online");
  });

  it("baseUpdatedAt igual à versão do servidor: aplica", async () => {
    const colonia = await criarColonia(api);
    const res = await api.post("/sync", {
      operacoes: [op.atualizar("colonia", colonia.id, { observacoes: "ok" }, colonia.updatedAt)],
    });
    expect(status(res)).toEqual(["aplicado"]);
  });

  it("conflito pode ser resolvido reenviando o mesmo id com a base atualizada", async () => {
    const colonia = await criarColonia(api);
    await pausa();
    await api.patch(`/colonias/${colonia.id}`, { observacoes: "online" });
    const operacao = op.atualizar("colonia", colonia.id, { observacoes: "offline" }, colonia.updatedAt);

    const r1 = await api.post("/sync", { operacoes: [operacao] });
    expect(status(r1)).toEqual(["conflito"]);

    const resolvida = { ...operacao, baseUpdatedAt: r1.body.resultados[0].servidor.updatedAt };
    expect(status(await api.post("/sync", { operacoes: [resolvida] }))).toEqual(["aplicado"]);
    expect((await api.get(`/colonias/${colonia.id}`)).body.observacoes).toBe("offline");
  });

  it("update de registro inexistente é erro", async () => {
    const res = await api.post("/sync", {
      operacoes: [op.atualizar("producao", randomUUID(), { quantidade: 1 })],
    });
    expect(status(res)).toEqual(["erro"]);
  });
});

describe("sync — isolamento entre usuários", () => {
  it("não altera nem exclui registros de outro usuário", async () => {
    const dono = await novoUsuario(app);
    const intruso = await novoUsuario(app);
    const colonia = await criarColonia(dono.api);

    const res = await intruso.api.post("/sync", {
      operacoes: [
        op.atualizar("colonia", colonia.id, { status: "morta" }),
        op.excluir("colonia", colonia.id),
      ],
    });

    expect(res.body.resultados[0].status).toBe("erro");
    const depois = await dono.api.get(`/colonias/${colonia.id}`);
    expect(depois.status).toBe(200);
    expect(depois.body.status).toBe("ativa");
  });

  it("não aceita create com id de entidade que pertence a outro usuário", async () => {
    const dono = await novoUsuario(app);
    const intruso = await novoUsuario(app);
    const colonia = await criarColonia(dono.api);

    const res = await intruso.api.post("/sync", { operacoes: [op.criarColonia(colonia.id)] });
    expect(res.body.resultados[0].status).toBe("erro");
  });

  it("não reaproveita id de operação usado por outro usuário", async () => {
    const a = await novoUsuario(app);
    const b = await novoUsuario(app);
    const operacao = op.criarColonia(randomUUID());
    await a.api.post("/sync", { operacoes: [operacao] });

    const res = await b.api.post("/sync", { operacoes: [{ ...operacao, entidadeId: randomUUID() }] });
    expect(res.body.resultados[0]).toMatchObject({ status: "erro", erro: "id de operação já utilizado" });
  });
});

describe("sync — pull e status", () => {
  it("carga inicial traz tudo; incremental traz só o que mudou desde servidorEm", async () => {
    const { api } = await novoUsuario(app);
    const [parametroId] = await criarParametros(api, 1);
    const antiga = await criarColonia(api);

    const inicial = await api.get("/sync/alteracoes");
    expect(inicial.body.desde).toBeNull();
    expect(inicial.body.colonias.map((c: { id: string }) => c.id)).toEqual([antiga.id]);
    expect(inicial.body.parametros).toHaveLength(1);

    await pausa();
    const nova = await criarColonia(api);
    await api.post(`/colonias/${nova.id}/avaliacoes`, {
      dataAvaliacao: "2026-02-01T10:00:00.000Z",
      parametros: [{ parametroId, classificacao: "bom" }],
      acoesTomadas: ["alimentação"],
    });

    const incremental = await api.get(`/sync/alteracoes?desde=${encodeURIComponent(inicial.body.servidorEm)}`);
    expect(incremental.body.colonias.map((c: { id: string }) => c.id)).toEqual([nova.id]);
    expect(incremental.body.avaliacoes).toHaveLength(1);
    expect(incremental.body.avaliacoes[0].acoesTomadas).toEqual(["alimentação"]);
    expect(incremental.body.avaliacoes[0].parametros).toHaveLength(1);
    expect(incremental.body.parametros).toEqual([]);
    expect(incremental.body.idsAtuais.colonias.sort()).toEqual([antiga.id, nova.id].sort());
  });

  it("idsAtuais permite ao cliente detectar exclusões", async () => {
    const { api } = await novoUsuario(app);
    const c = await criarColonia(api);
    const antes = (await api.get("/sync/alteracoes")).body;
    await api.delete(`/colonias/${c.id}`);
    const depois = (await api.get(`/sync/alteracoes?desde=${encodeURIComponent(antes.servidorEm)}`)).body;
    expect(depois.idsAtuais.colonias).not.toContain(c.id);
  });

  it("status mostra a última sincronização e as operações não aplicadas", async () => {
    const { api } = await novoUsuario(app);
    expect((await api.get("/sync/status")).body).toEqual({ ultimaSincronizacao: null, naoAplicadas: [] });

    const colonia = await criarColonia(api);
    const falha = op.criarProducao(randomUUID(), colonia.id, -1);
    await api.post("/sync", { operacoes: [op.criarColonia(randomUUID()), falha] });

    const { body } = await api.get("/sync/status");
    expect(body.ultimaSincronizacao).toEqual(expect.any(String));
    expect(body.naoAplicadas).toEqual([
      expect.objectContaining({ id: falha.id, resultado: "erro", tipo: "producao" }),
    ]);
  });
});
