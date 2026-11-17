import { describe, expect, it } from "vitest";
import {
  conteudoCanonico,
  hashProtocolo,
  templateDoConteudo,
} from "../../src/modules/avaliacoes/avaliacoes.protocolo";
import { TEMPLATES } from "../../src/modules/parametros/parametros.templates";

// Conteúdo canônico e hash do protocolo de avaliação (sem banco).

const p = (nome: string, sufixo = "") => ({
  nome,
  criterioBom: `${nome} bom${sufixo}`,
  criterioMedio: `${nome} médio`,
  criterioRuim: `${nome} ruim`,
});

describe("protocolo — conteúdo canônico e hash", () => {
  it("tem versão, ordena pelo nome normalizado (sem maiúsculas nem acentos) e fixa as chaves", () => {
    const conteudo = conteudoCanonico([p("Zangões"), p("Óleo"), p("abelhas")]);
    expect(conteudo.versao).toBe(1);
    expect(conteudo.itens.map((i) => i.nome)).toEqual(["abelhas", "Óleo", "Zangões"]);
    expect(Object.keys(conteudo.itens[0]!)).toEqual(["nome", "criterioBom", "criterioMedio", "criterioRuim", "especieCodigo"]);
    expect(conteudo.itens[0]!.especieCodigo).toBeNull();
  });

  it("o mesmo conteúdo dá o mesmo hash, em qualquer ordem e com campos extras (ids) ignorados", () => {
    const a = hashProtocolo(conteudoCanonico([p("A"), p("B")]));
    const b = hashProtocolo(conteudoCanonico([{ id: "x", ...p("B") }, { id: "y", ...p("A") }] as never));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("acentos em NFD ou NFC e espaços nas pontas dão o mesmo hash", () => {
    const nfc = p("Potes de pólen".normalize("NFC"));
    const nfd = {
      nome: `  ${"Potes de pólen".normalize("NFD")} `,
      criterioBom: `${nfc.criterioBom.normalize("NFD")}  `,
      criterioMedio: ` ${nfc.criterioMedio.normalize("NFD")}`,
      criterioRuim: nfc.criterioRuim,
    };
    expect(nfd.nome.trim()).not.toBe(nfc.nome); // bytes diferentes, mesmo texto visível
    const canonico = conteudoCanonico([nfd]);
    expect(canonico.itens[0]!.nome).toBe(nfc.nome);
    expect(hashProtocolo(canonico)).toBe(hashProtocolo(conteudoCanonico([nfc])));
  });

  it("qualquer mudança de texto muda o hash", () => {
    const a = hashProtocolo(conteudoCanonico([p("A"), p("B")]));
    expect(hashProtocolo(conteudoCanonico([p("A"), p("B", "!")]))).not.toBe(a);
  });

  it("o override da espécie substitui os critérios e registra o código da espécie", () => {
    const { itens } = conteudoCanonico([
      { ...p("A"), override: { criterioBom: "j b", criterioMedio: "j m", criterioRuim: "j r", especieCodigo: "TETRANGU" } },
    ]);
    expect(itens[0]).toEqual({ nome: "A", criterioBom: "j b", criterioMedio: "j m", criterioRuim: "j r", especieCodigo: "TETRANGU" });
  });
});

describe("protocolo — template de origem", () => {
  const conteudoDo = (id: string) => conteudoCanonico(TEMPLATES.find((t) => t.id === id)!.parametros);

  it("reconhece cada template publicado, com a versão", () => {
    for (const t of TEMPLATES) {
      expect(templateDoConteudo(conteudoDo(t.id))).toEqual({ codigo: t.id, versao: t.versao });
    }
  });

  it("não casa com conjunto parcial, parâmetro a mais ou critério alterado", () => {
    const iniciante = conteudoDo("iniciante");
    expect(templateDoConteudo({ ...iniciante, itens: iniciante.itens.slice(1) })).toBeNull();
    expect(templateDoConteudo(conteudoCanonico([...TEMPLATES[0]!.parametros, p("Extra")]))).toBeNull();
    const alterado = iniciante.itens.map((i, n) => (n === 0 ? { ...i, criterioBom: "outro texto" } : i));
    expect(templateDoConteudo({ ...iniciante, itens: alterado })).toBeNull();
  });
});
