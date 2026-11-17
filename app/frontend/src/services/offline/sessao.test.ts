import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { useAuth } from "../../store/auth";
import { useSincronizacao } from "../../store/sincronizacao";
import { abrirBanco, aplicarPull, contarFila, enfileirar, guardarFoto, lerMeta } from "./banco";
import { apagarDadosLocais, pendenciasDoAparelho } from "./sessao";
import type { RespostaAlteracoes } from "./tipos";

const resposta: RespostaAlteracoes = {
  servidorEm: "2026-11-11T10:00:00.000Z",
  desde: null,
  colonias: [],
  avaliacoes: [],
  producoes: [],
  parametros: [],
  idsAtuais: { colonias: [], avaliacoes: [], producoes: [], parametros: [] },
};

async function bancoComPendencias(usuarioId: string) {
  const db = await abrirBanco(usuarioId);
  await aplicarPull(db, resposta, new Set(), null);
  await enfileirar(db, { id: "op1", tipo: "colonia", operacao: "update", entidadeId: "c1", dados: {}, criadoEm: "", estado: "pendente", tentativas: 0, relacionadas: [] }, []);
  await guardarFoto(db, { id: "f1", vinculo: { coloniaId: "c1" }, entidadeId: "c1", bytes: new ArrayBuffer(1), tipo: "image/jpeg", criadoEm: "", estado: "pendente", tentativas: 0 });
  return db;
}

describe("sessão", () => {
  it("pendenciasDoAparelho: operações na fila e fotos aguardando", async () => {
    await bancoComPendencias("conta-a");
    expect(await pendenciasDoAparelho("conta-a")).toEqual({ operacoes: 1, fotos: 1, decisoes: 0, fotosParadas: 0 });
    expect(await pendenciasDoAparelho("conta-vazia")).toEqual({ operacoes: 0, fotos: 0, decisoes: 0, fotosParadas: 0 });
  });

  it("pendenciasDoAparelho: operações paradas contam como decisões", async () => {
    const db = await bancoComPendencias("conta-b");
    await enfileirar(db, { id: "op2", tipo: "colonia", operacao: "update", entidadeId: "c2", dados: {}, criadoEm: "", estado: "conflito", tentativas: 1, relacionadas: [] }, []);
    expect(await pendenciasDoAparelho("conta-b")).toEqual({ operacoes: 2, fotos: 1, decisoes: 1, fotosParadas: 0 });
  });

  it("pendenciasDoAparelho: foto recusada e foto presa atrás de um create parado contam como paradas", async () => {
    const db = await bancoComPendencias("conta-c");
    await enfileirar(db, { id: "op3", tipo: "colonia", operacao: "create", entidadeId: "c3", dados: {}, criadoEm: "", estado: "erro", tentativas: 1, relacionadas: [] }, []);
    await guardarFoto(db, { id: "f2", vinculo: { coloniaId: "c1" }, entidadeId: "c1", bytes: new ArrayBuffer(1), tipo: "image/jpeg", criadoEm: "", estado: "erro", tentativas: 1 });
    await guardarFoto(db, { id: "f3", vinculo: { coloniaId: "c3" }, entidadeId: "c3", bytes: new ArrayBuffer(1), tipo: "image/jpeg", criadoEm: "", estado: "pendente", tentativas: 0 });
    expect(await pendenciasDoAparelho("conta-c")).toEqual({ operacoes: 2, fotos: 3, decisoes: 1, fotosParadas: 2 });
  });

  it("pendenciasDoAparelho: operação presa atrás de uma parada também espera decisão (sincronizar não a envia)", async () => {
    const db = await bancoComPendencias("conta-d");
    await enfileirar(db, { id: "op4", tipo: "colonia", operacao: "create", entidadeId: "c4", dados: {}, criadoEm: "", estado: "erro", tentativas: 1, relacionadas: [] }, []);
    await enfileirar(db, { id: "op5", tipo: "avaliacao", operacao: "create", entidadeId: "a5", coloniaId: "c4", dados: {}, criadoEm: "", estado: "pendente", tentativas: 0, relacionadas: ["c4"] }, []);
    // op1 (c1) segue livre; op4 parou e op5 depende dela.
    expect(await pendenciasDoAparelho("conta-d")).toEqual({ operacoes: 3, fotos: 1, decisoes: 2, fotosParadas: 0 });
  });

  it("apagarDadosLocais: encerra a sessão do próprio usuário, nunca a de outro", async () => {
    useAuth.setState({ token: "t", usuario: { id: "dono" } as never });
    await apagarDadosLocais("dono");
    expect(useAuth.getState().usuario).toBeNull();

    useAuth.setState({ token: "t", usuario: { id: "outro" } as never });
    await apagarDadosLocais("dono");
    expect(useAuth.getState().usuario?.id).toBe("outro");
  });

  it("apagarDadosLocais: o banco do usuário some (o próximo começa limpo), o de outro fica", async () => {
    await bancoComPendencias("sai");
    await bancoComPendencias("fica");
    useSincronizacao.setState({ naFila: 1, decisoes: 1, fotosPendentes: 1, servidorInacessivel: true });

    await apagarDadosLocais("sai");

    expect(useSincronizacao.getState()).toMatchObject({ naFila: 0, decisoes: 0, fotosPendentes: 0, servidorInacessivel: false });
    const reaberto = await abrirBanco("sai");
    expect(await contarFila(reaberto)).toBe(0);
    expect((await lerMeta(reaberto)).desde).toBeNull();
    expect(await contarFila(await abrirBanco("fica"))).toBe(1);
  });
});
