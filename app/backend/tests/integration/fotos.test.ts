import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PNG,
  criarApp,
  criarAvaliacao,
  criarColonia,
  criarParametros,
  formFoto,
  novoUsuario,
  type Cliente,
} from "../helpers";

let app: FastifyInstance;
let api: Cliente;
let params: string[];

beforeAll(async () => {
  app = await criarApp();
  ({ api } = await novoUsuario(app));
  params = await criarParametros(api, 2);
});
afterAll(async () => {
  await app.close();
});

async function avaliacaoCompleta() {
  const colonia = await criarColonia(api);
  const av = await criarAvaliacao(api, colonia.id, [
    { parametroId: params[0]!, classificacao: "bom" },
    { parametroId: params[1]!, classificacao: "ruim" },
  ]);
  return { colonia, avaliacao: av.body, parametroAvaliado: av.body.parametros[0] };
}

async function arquivoExiste(url: string) {
  return (await app.inject({ method: "GET", url })).statusCode === 200;
}

describe("fotos — regra de integridade", () => {
  it("recusa foto sem nenhum vínculo (400) — nenhuma foto órfã", async () => {
    const res = await api.post("/fotos", formFoto({}));
    expect(res.status).toBe(400);
  });

  it("deriva avaliação e colônia a partir do parâmetro avaliado", async () => {
    const { colonia, avaliacao, parametroAvaliado } = await avaliacaoCompleta();
    const res = await api.post("/fotos", formFoto({ avaliacaoParametroId: parametroAvaliado.id }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      avaliacaoParametroId: parametroAvaliado.id,
      avaliacaoId: avaliacao.id,
      coloniaId: colonia.id,
      producaoId: null,
    });
  });

  it("deriva a colônia a partir da colheita", async () => {
    const colonia = await criarColonia(api);
    const prod = await api.post("/producoes", {
      coloniaId: colonia.id,
      dataColheita: "2026-03-01T12:00:00.000Z",
      tipoProduto: "mel",
      quantidade: 100,
      unidade: "ml",
    });
    const res = await api.post("/fotos", formFoto({ producaoId: prod.body.id }));
    expect(res.status).toBe(201);
    expect(res.body.coloniaId).toBe(colonia.id);
  });

  it("recusa vínculos incoerentes entre si (400)", async () => {
    const { avaliacao } = await avaliacaoCompleta();
    const outraColonia = await criarColonia(api);
    const res = await api.post("/fotos", formFoto({ avaliacaoId: avaliacao.id, coloniaId: outraColonia.id }));
    expect(res.status).toBe(400);
  });

  it("recusa foto de avaliação e colheita ao mesmo tempo (400)", async () => {
    const { colonia, avaliacao } = await avaliacaoCompleta();
    const prod = await api.post("/producoes", {
      coloniaId: colonia.id,
      dataColheita: "2026-03-01T12:00:00.000Z",
      tipoProduto: "mel",
      quantidade: 1,
      unidade: "ml",
    });
    const res = await api.post("/fotos", formFoto({ avaliacaoId: avaliacao.id, producaoId: prod.body.id }));
    expect(res.status).toBe(400);
  });

  it("não permite vincular a registros de outro usuário (404)", async () => {
    const outro = await novoUsuario(app);
    const alheia = await criarColonia(outro.api);
    expect((await api.post("/fotos", formFoto({ coloniaId: alheia.id }))).status).toBe(404);
  });
});

describe("fotos — arquivo", () => {
  it("recusa requisição sem arquivo ou com formato não suportado (400)", async () => {
    const colonia = await criarColonia(api);
    expect((await api.post("/fotos", formFoto({ coloniaId: colonia.id }, null))).status).toBe(400);

    const texto = formFoto({ coloniaId: colonia.id }, { conteudo: Buffer.from("oi"), tipo: "text/plain" });
    expect((await api.post("/fotos", texto)).status).toBe(400);

    const heic = formFoto({ coloniaId: colonia.id }, { conteudo: PNG, tipo: "image/heic" });
    expect((await api.post("/fotos", heic)).status).toBe(400);
  });

  it("recusa mais de um arquivo por requisição (413, limite do multipart)", async () => {
    const colonia = await criarColonia(api);
    const dois = formFoto({ coloniaId: colonia.id });
    dois.append("arquivo", new Blob([new Uint8Array(PNG)], { type: "image/png" }), "b.png");
    const res = await api.post("/fotos", dois);
    expect(res.status).toBe(413);
    expect((await api.get(`/fotos?coloniaId=${colonia.id}`)).body).toEqual([]);
  });

  it("recusa arquivo acima de 5 MB (413)", async () => {
    const colonia = await criarColonia(api);
    const grande = formFoto(
      { coloniaId: colonia.id },
      { conteudo: Buffer.alloc(5 * 1024 * 1024 + 1), tipo: "image/jpeg" }
    );
    expect((await api.post("/fotos", grande)).status).toBe(413);
  });

  it("salva, serve estaticamente com nome UUID e registra o tamanho", async () => {
    const colonia = await criarColonia(api);
    const res = await api.post("/fotos", formFoto({ coloniaId: colonia.id, legenda: "entrada" }));
    expect(res.body.url).toMatch(/^\/uploads\/fotos\/[0-9a-f-]{36}\.png$/);
    expect(res.body).toMatchObject({ legenda: "entrada", tamanhoKb: 1 });

    const arquivo = await app.inject({ method: "GET", url: res.body.url });
    expect(arquivo.statusCode).toBe(200);
    expect(arquivo.headers["content-type"]).toBe("image/png");
  });
});

describe("fotos — ciclo de vida", () => {
  it("lista por vínculo, altera legenda e exclui (registro + arquivo)", async () => {
    const colonia = await criarColonia(api);
    const foto = (await api.post("/fotos", formFoto({ coloniaId: colonia.id }))).body;

    const lista = await api.get(`/fotos?coloniaId=${colonia.id}`);
    expect(lista.body.map((f: { id: string }) => f.id)).toEqual([foto.id]);

    expect((await api.patch(`/fotos/${foto.id}`, { legenda: "nova" })).body.legenda).toBe("nova");

    expect((await api.delete(`/fotos/${foto.id}`)).status).toBe(204);
    expect(await arquivoExiste(foto.url)).toBe(false);
    expect((await api.get(`/fotos/${foto.id}`)).status).toBe(404);
  });

  it("foto de parâmetro sobrevive quando o parâmetro sai da avaliação (fica na avaliação)", async () => {
    const { colonia, avaliacao, parametroAvaliado } = await avaliacaoCompleta();
    const foto = (await api.post("/fotos", formFoto({ avaliacaoParametroId: parametroAvaliado.id }))).body;

    const outroParametro = avaliacao.parametros[1].parametroId;
    await api.patch(`/colonias/${colonia.id}/avaliacoes/${avaliacao.id}`, {
      parametros: [{ parametroId: outroParametro, classificacao: "bom" }],
    });

    const depois = await api.get(`/fotos/${foto.id}`);
    expect(depois.status).toBe(200);
    expect(depois.body).toMatchObject({ avaliacaoParametroId: null, avaliacaoId: avaliacao.id });
    expect(await arquivoExiste(foto.url)).toBe(true);
  });

  it("excluir a avaliação apaga as fotos dela e os arquivos", async () => {
    const { colonia, avaliacao, parametroAvaliado } = await avaliacaoCompleta();
    const fotoAv = (await api.post("/fotos", formFoto({ avaliacaoId: avaliacao.id }))).body;
    const fotoParam = (await api.post("/fotos", formFoto({ avaliacaoParametroId: parametroAvaliado.id }))).body;
    const fotoColonia = (await api.post("/fotos", formFoto({ coloniaId: colonia.id }))).body;

    await api.delete(`/colonias/${colonia.id}/avaliacoes/${avaliacao.id}`);

    expect(await arquivoExiste(fotoAv.url)).toBe(false);
    expect(await arquivoExiste(fotoParam.url)).toBe(false);
    expect(await arquivoExiste(fotoColonia.url)).toBe(true); // foto da colônia não pertence à avaliação
  });

  it("excluir a colônia apaga todas as fotos dela", async () => {
    const colonia = await criarColonia(api);
    const foto = (await api.post("/fotos", formFoto({ coloniaId: colonia.id }))).body;
    expect((await api.delete(`/colonias/${colonia.id}`)).status).toBe(204);
    expect(await arquivoExiste(foto.url)).toBe(false);
  });

  it("outro usuário não vê, edita nem exclui a foto", async () => {
    const colonia = await criarColonia(api);
    const foto = (await api.post("/fotos", formFoto({ coloniaId: colonia.id }))).body;
    const intruso = await novoUsuario(app);

    expect((await intruso.api.get(`/fotos/${foto.id}`)).status).toBe(404);
    expect((await intruso.api.patch(`/fotos/${foto.id}`, { legenda: "x" })).status).toBe(404);
    expect((await intruso.api.delete(`/fotos/${foto.id}`)).status).toBe(404);
    expect((await intruso.api.get(`/fotos?coloniaId=${colonia.id}`)).body).toEqual([]);
  });
});
