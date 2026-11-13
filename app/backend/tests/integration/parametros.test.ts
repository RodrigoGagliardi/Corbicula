import type { FastifyInstance } from "fastify/types/instance";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEMPLATES } from "../../src/modules/parametros/parametros.templates";
import { criarApp, criarAvaliacao, criarColonia, criarParametros, idEspecie, novoUsuario, type Cliente } from "../helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});
afterAll(async () => {
  await app.close();
});

const listar = async (api: Cliente) => (await api.get("/parametros")).body as { id: string; nome: string; ativo: boolean; ordem: number; criterioBom: string }[];
const ativos = async (api: Cliente) => (await listar(api)).filter((p) => p.ativo).map((p) => p.nome);

describe("parâmetros — templates", () => {
  it("lista os 4 templates cumulativos (5, 8, 12, 15) com versão", async () => {
    const { api } = await novoUsuario(app);
    const res = await api.get("/parametros/templates");
    expect(res.status).toBe(200);
    expect(res.body.map((t: { id: string }) => t.id)).toEqual(["iniciante", "intermediario", "avancado", "cientifico"]);
    expect(res.body.map((t: { parametros: unknown[] }) => t.parametros.length)).toEqual([5, 8, 12, 15]);
    for (const t of res.body) expect(t.versao).toBeGreaterThanOrEqual(1);
    // Cumulativos: cada template contém todos os parâmetros do anterior.
    for (let i = 1; i < TEMPLATES.length; i++) {
      const anteriores = TEMPLATES[i - 1]!.parametros.map((p) => p.nome);
      expect(TEMPLATES[i]!.parametros.map((p) => p.nome)).toEqual(expect.arrayContaining(anteriores));
    }
  });

  it("aplica um template numa conta vazia, na ordem do template", async () => {
    const { api } = await novoUsuario(app);
    const res = await api.post("/parametros/templates/intermediario/aplicar", { modo: "mesclar" });
    expect(res.status).toBe(200);
    expect(res.body.criados).toHaveLength(8);
    expect(res.body).toMatchObject({ reativados: [], desativados: [], existentes: [] });
    const lista = await listar(api);
    expect(lista.map((p) => p.nome)).toEqual(TEMPLATES[1]!.parametros.map((p) => p.nome));
    expect(lista.every((p) => p.ativo)).toBe(true);
  });

  it("mesclar acrescenta só o que falta e nunca sobrescreve critérios existentes", async () => {
    const { api } = await novoUsuario(app);
    // Mesmo nome com outra grafia: conta como o mesmo parâmetro.
    await api.post("/parametros", { nome: "SANIDADE", ordem: 1, criterioBom: "meu bom", criterioMedio: "meu médio", criterioRuim: "meu ruim" });
    await criarParametros(api, 1); // "Parâmetro 1", fora do template

    const res = await api.post("/parametros/templates/iniciante/aplicar", { modo: "mesclar" });
    expect(res.status).toBe(200);
    expect(res.body.criados).toHaveLength(4);
    expect(res.body.existentes).toEqual(["SANIDADE"]);
    expect(res.body.criteriosDiferentes).toEqual(["SANIDADE"]);
    expect(res.body.desativados).toEqual([]);

    const lista = await listar(api);
    expect(lista).toHaveLength(6);
    expect(lista.find((p) => p.nome === "SANIDADE")!.criterioBom).toBe("meu bom");
    expect(lista.find((p) => p.nome === "Parâmetro 1")!.ativo).toBe(true);
  });

  it("substituir desativa (não exclui) os parâmetros fora do template e preserva o histórico", async () => {
    const { api } = await novoUsuario(app);
    const [usado] = await criarParametros(api, 1);
    const colonia = await criarColonia(api);
    const avaliacao = await criarAvaliacao(api, colonia.id, [{ parametroId: usado!, classificacao: "bom" }]);
    expect(avaliacao.status).toBe(201);

    const res = await api.post("/parametros/templates/iniciante/aplicar", { modo: "substituir" });
    expect(res.status).toBe(200);
    expect(res.body.desativados).toEqual(["Parâmetro 1"]);

    const lista = await listar(api);
    expect(lista.find((p) => p.id === usado)).toMatchObject({ ativo: false });
    expect(await ativos(api)).toEqual(TEMPLATES[0]!.parametros.map((p) => p.nome));
    const historico = await api.get(`/colonias/${colonia.id}/avaliacoes/${avaliacao.body.id}`);
    expect(historico.status).toBe(200);
    expect(historico.body.scoreGeral).toBe(100);
  });

  it("reativa parâmetro do template que estava desativado", async () => {
    const { api } = await novoUsuario(app);
    await api.post("/parametros/templates/iniciante/aplicar", { modo: "mesclar" });
    const sanidade = (await listar(api)).find((p) => p.nome === "Sanidade")!;
    await api.patch(`/parametros/${sanidade.id}`, { ativo: false });

    const res = await api.post("/parametros/templates/iniciante/aplicar", { modo: "mesclar" });
    expect(res.body).toMatchObject({ criados: [], reativados: ["Sanidade"] });
    expect(res.body.existentes).toHaveLength(5);
    expect(res.body.criteriosDiferentes).toEqual([]);
    expect((await listar(api)).find((p) => p.id === sanidade.id)!.ativo).toBe(true);
  });

  it("aplicar duas vezes não duplica nada (idempotente)", async () => {
    const { api } = await novoUsuario(app);
    await api.post("/parametros/templates/cientifico/aplicar", { modo: "mesclar" });
    const res = await api.post("/parametros/templates/cientifico/aplicar", { modo: "substituir" });
    expect(res.body).toMatchObject({ criados: [], reativados: [], desativados: [] });
    expect(await listar(api)).toHaveLength(15);
  });

  it("valida template e modo", async () => {
    const { api } = await novoUsuario(app);
    expect((await api.post("/parametros/templates/inexistente/aplicar", { modo: "mesclar" })).status).toBe(404);
    expect((await api.post("/parametros/templates/iniciante/aplicar", { modo: "apagar" })).status).toBe(400);
    expect((await api.post("/parametros/templates/iniciante/aplicar", {})).status).toBe(400);
  });
});

describe("parâmetros — exportar e importar", () => {
  it("exporta em formato versionado com critérios por espécie pelo código Kew", async () => {
    const { api } = await novoUsuario(app);
    await api.post("/parametros/templates/iniciante/aplicar", { modo: "mesclar" });
    const sanidade = (await listar(api)).find((p) => p.nome === "Sanidade")!;
    const jatai = await idEspecie(api, "TETRANGU");
    await api.put(`/parametros/${sanidade.id}/especies/${jatai}`, { criterioBom: "j bom", criterioMedio: "j médio", criterioRuim: "j ruim" });

    const res = await api.get("/parametros/exportar");
    expect(res.status).toBe(200);
    expect(String(res.headers["content-disposition"])).toMatch(/attachment; filename="corbicula-parametros-\d{4}-\d{2}-\d{2}\.json"/);
    expect(res.body).toMatchObject({ formato: "corbicula-parametros", versao: 1 });
    expect(res.body.metodologia).toContain("Score");
    expect(res.body.parametros).toHaveLength(5);
    expect(res.body.parametros.find((p: { nome: string }) => p.nome === "Sanidade").criteriosEspecie).toEqual([
      { especie: "TETRANGU", criterioBom: "j bom", criterioMedio: "j médio", criterioRuim: "j ruim" },
    ]);
  });

  it("importa o arquivo exportado em outra conta (ida e volta), com critérios por espécie", async () => {
    const origem = await novoUsuario(app);
    await origem.api.post("/parametros/templates/avancado/aplicar", { modo: "mesclar" });
    const sanidade = (await listar(origem.api)).find((p) => p.nome === "Sanidade")!;
    await origem.api.patch(`/parametros/${sanidade.id}`, { ativo: false });
    const jatai = await idEspecie(origem.api, "TETRANGU");
    await origem.api.put(`/parametros/${sanidade.id}/especies/${jatai}`, { criterioBom: "j bom", criterioMedio: "j médio", criterioRuim: "j ruim" });
    const arquivo = (await origem.api.get("/parametros/exportar")).body;

    const destino = await novoUsuario(app);
    const res = await destino.api.post("/parametros/importar", { modo: "mesclar", dados: arquivo });
    expect(res.status).toBe(200);
    expect(res.body.criados).toHaveLength(12);
    expect(res.body.especiesIgnoradas).toEqual([]);

    const reexportado = (await destino.api.get("/parametros/exportar")).body;
    const semData = (a: { parametros: unknown[] }) => a.parametros;
    expect(semData(reexportado)).toEqual(semData(arquivo));
  });

  it("ignora e lista códigos de espécie desconhecidos", async () => {
    const { api } = await novoUsuario(app);
    const res = await api.post("/parametros/importar", {
      modo: "mesclar",
      dados: {
        formato: "corbicula-parametros",
        versao: 1,
        parametros: [
          {
            nome: "Atividade",
            criterioBom: "a",
            criterioMedio: "b",
            criterioRuim: "c",
            criteriosEspecie: [
              { especie: "tetrangu", criterioBom: "x", criterioMedio: "y", criterioRuim: "z" },
              { especie: "NAOEXIST", criterioBom: "x", criterioMedio: "y", criterioRuim: "z" },
            ],
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.especiesIgnoradas).toEqual(["NAOEXIST"]);
    const param = (await api.get("/parametros")).body[0];
    expect(param.criteriosEspecie.map((c: { especie: { codigo: string } }) => c.especie.codigo)).toEqual(["TETRANGU"]);
  });

  it("recusa arquivo de outro formato, versão desconhecida, nomes repetidos ou sem parâmetro ativo", async () => {
    const { api } = await novoUsuario(app);
    const item = { nome: "Atividade", criterioBom: "a", criterioMedio: "b", criterioRuim: "c" };
    const importar = (dados: unknown, modo = "mesclar") => api.post("/parametros/importar", { modo, dados });

    expect((await importar({ formato: "outro", versao: 1, parametros: [item] })).status).toBe(400);
    expect((await importar({ formato: "corbicula-parametros", versao: 2, parametros: [item] })).status).toBe(400);
    expect((await importar({ formato: "corbicula-parametros", versao: 1, parametros: [] })).status).toBe(400);
    const repetido = await importar({ formato: "corbicula-parametros", versao: 1, parametros: [item, { ...item, nome: "atividade " }] });
    expect(repetido.status).toBe(400);
    expect(repetido.body.error).toContain("repetido");

    // Substituir por um conjunto só de inativos deixaria zero ativos: nada é aplicado.
    await criarParametros(api, 2);
    const semAtivos = await importar({ formato: "corbicula-parametros", versao: 1, parametros: [{ ...item, ativo: false }] }, "substituir");
    expect(semAtivos.status).toBe(400);
    expect(await ativos(api)).toEqual(["Parâmetro 1", "Parâmetro 2"]);
    expect(await listar(api)).toHaveLength(2); // a transação desfez a criação de "Atividade"
  });
});
