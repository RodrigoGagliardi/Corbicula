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
    expect(await pendenciasDoAparelho("conta-a")).toEqual({ operacoes: 1, fotos: 1, decisoes: 0 });
    expect(await pendenciasDoAparelho("conta-vazia")).toEqual({ operacoes: 0, fotos: 0, decisoes: 0 });
  });

  it("pendenciasDoAparelho: operações paradas contam como decisões", async () => {
    const db = await bancoComPendencias("conta-b");
    await enfileirar(db, { id: "op2", tipo: "colonia", operacao: "update", entidadeId: "c2", dados: {}, criadoEm: "", estado: "conflito", tentativas: 1, relacionadas: [] }, []);
    expect(await pendenciasDoAparelho("conta-b")).toEqual({ operacoes: 2, fotos: 1, decisoes: 1 });
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
