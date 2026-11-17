import { describe, expect, it } from "vitest";
import {
  diaLocal,
  estadoStatusInicial,
  dataMinimaStatus,
  FONTES_CLIMA,
  instanteDoDia,
  montarMotivosAcoes,
  MOTIVOS_ACAO,
  MOTIVOS_INSPECAO,
  MOTIVOS_STATUS,
  motivoCompativel,
  motivosDoStatus,
  payloadContextoAvaliacao,
  payloadStatus,
  rotuloMotivoInspecao,
  rotuloFonteClima,
  rotuloMotivoAcao,
  rotuloMotivoStatus,
  temClima,
  trocarStatus,
  type EstadoStatus,
  type StatusOriginal,
} from "./vocabularios";

// 09/11/2026 15:30 local: "hoje" no fuso de quem roda o teste.
const AGORA = new Date(2026, 10, 9, 15, 30);
const HOJE = diaLocal(AGORA.toISOString());
// Hoje à tarde, o instante enviado é o meio-dia local (o menor entre agora e o meio-dia).
const MEIO_DIA_HOJE = new Date(2026, 10, 9, 12).toISOString();

describe("vocabulários (mesmos códigos de vocabularios.md e do backend)", () => {
  it("motivos de status, com status e classe", () => {
    expect(Object.keys(MOTIVOS_STATUS)).toEqual([
      "fome_escassez",
      "frio",
      "pragas_predadores",
      "intoxicacao_suspeita",
      "orfandade",
      "falha_divisao",
      "desconhecida",
      "abandono",
      "roubo_perda",
      "venda_doacao",
      "uniao",
      "recuperada",
      "correcao_registro",
      "outro",
    ]);
    expect(MOTIVOS_STATUS.abandono).toEqual({ rotulo: "A colônia abandonou a caixa", status: "inativa", classe: "evento" });
    expect(MOTIVOS_STATUS.venda_doacao.classe).toBe("censura");
    expect(MOTIVOS_STATUS.fome_escassez.rotulo).toBe("Fome / falta de alimento");
  });

  it("motivos da inspeção, da ação e procedência do clima", () => {
    expect(MOTIVOS_INSPECAO).toEqual({
      rotina: "Rotina",
      problema_observado: "Algo chamou atenção",
      retorno_acao: "Retorno após uma ação",
      outro: "Outro (texto)",
    });
    expect(MOTIVOS_ACAO).toEqual({
      preventiva: "Preventiva (calendário, estação, rotina)",
      resposta_problema: "Resposta a um problema observado",
    });
    expect(FONTES_CLIMA).toEqual({ api_previsao: "API (previsão)", api_historico: "API (histórico ERA5)", digitado: "Digitado" });
  });
});

describe("compatibilidade status → motivo", () => {
  it("ativa: só recuperada, correção de registro e outro", () => {
    expect(motivosDoStatus("ativa")).toEqual(["recuperada", "correcao_registro", "outro"]);
  });

  it("morta e inativa: os seus motivos e outro (sempre por último)", () => {
    expect(motivosDoStatus("morta")).toEqual([
      "fome_escassez",
      "frio",
      "pragas_predadores",
      "intoxicacao_suspeita",
      "orfandade",
      "falha_divisao",
      "desconhecida",
      "outro",
    ]);
    expect(motivosDoStatus("inativa")).toEqual(["abandono", "roubo_perda", "venda_doacao", "uniao", "outro"]);
  });

  it("motivoCompativel", () => {
    expect(motivoCompativel("frio", "morta")).toBe(true);
    expect(motivoCompativel("frio", "ativa")).toBe(false);
    expect(motivoCompativel("outro", "inativa")).toBe(true);
  });
});

describe("rótulos com texto livre", () => {
  it("outro mostra o texto; sem texto, só 'Outro'; sem código, null", () => {
    expect(rotuloMotivoStatus("outro", " Caixa caiu ")).toBe("Outro: Caixa caiu");
    expect(rotuloMotivoStatus("outro", null)).toBe("Outro");
    expect(rotuloMotivoStatus("frio")).toBe("Frio");
    expect(rotuloMotivoStatus(null)).toBeNull();
    expect(rotuloMotivoInspecao("problema_observado")).toBe("Algo chamou atenção");
    expect(rotuloMotivoInspecao(undefined)).toBeNull();
  });
});

describe("data da mudança de status", () => {
  it("hoje = o menor entre agora e o meio-dia local; outro dia = meio-dia local", () => {
    expect(instanteDoDia(HOJE, AGORA)).toBe(MEIO_DIA_HOJE);
    const manha = new Date(2026, 10, 9, 9, 15);
    expect(instanteDoDia(HOJE, manha)).toBe(manha.toISOString());
    expect(instanteDoDia("2026-11-01", AGORA)).toBe(new Date(2026, 10, 1, 12).toISOString());
    expect(diaLocal(instanteDoDia("2026-11-01", AGORA))).toBe("2026-11-01");
  });

  it("hoje à noite (depois das 21h em UTC−3 já é amanhã em UTC): meio-dia local, mesmo dia local e UTC", () => {
    const noite = new Date(2026, 10, 9, 23, 30);
    const enviado = instanteDoDia(HOJE, noite);
    expect(enviado).toBe(MEIO_DIA_HOJE);
    expect(diaLocal(enviado)).toBe(HOJE);
    expect(enviado.slice(0, 10)).toBe(HOJE);
    expect(new Date(enviado).getTime()).toBeLessThanOrEqual(noite.getTime());
  });

  it("data mínima: a entrada; numa mudança, também a data do status atual (a mais recente das duas)", () => {
    const morta: StatusOriginal = { status: "morta", statusDesde: new Date(2026, 9, 20, 12).toISOString() };
    expect(dataMinimaStatus("2026-10-01", morta, true)).toEqual({ dia: "2026-10-20", origem: "status" });
    expect(dataMinimaStatus("2026-10-01", morta, false)).toEqual({ dia: "2026-10-01", origem: "entrada" });
    expect(dataMinimaStatus("2026-10-25", morta, true)).toEqual({ dia: "2026-10-25", origem: "entrada" });
    expect(dataMinimaStatus("2026-10-01", { status: "ativa", statusDesde: null }, true)).toEqual({ dia: "2026-10-01", origem: "entrada" });
  });
});

describe("clima no detalhe da avaliação", () => {
  it("há clima com qualquer um dos três campos (umidade sozinha conta)", () => {
    expect(temClima({ temperatura: null, umidade: null, condicaoClimatica: null })).toBe(false);
    expect(temClima({})).toBe(false);
    expect(temClima({ temperatura: null, umidade: 70, condicaoClimatica: null })).toBe(true);
    expect(temClima({ temperatura: 0, umidade: null, condicaoClimatica: null })).toBe(true);
    expect(temClima({ temperatura: null, umidade: null, condicaoClimatica: "nublado" })).toBe(true);
  });

  it("código desconhecido aparece como veio", () => {
    expect(rotuloFonteClima("api_previsao")).toBe("API (previsão)");
    expect(rotuloFonteClima("satelite")).toBe("satelite");
    expect(rotuloMotivoAcao("preventiva")).toBe("Preventiva (calendário, estação, rotina)");
    expect(rotuloMotivoAcao("mutirao")).toBe("mutirao");
    expect(rotuloMotivoStatus("novo_codigo")).toBe("novo_codigo");
  });
});

describe("payloadStatus (PATCH da colônia)", () => {
  const ativa: StatusOriginal = { status: "ativa", statusDesde: null, motivoStatus: null, motivoStatusDetalhe: null };

  it("status muda (ativa → morta, fome, data padrão): status, motivo e statusDesde de hoje", () => {
    const estado = { ...trocarStatus(ativa, "morta", AGORA), motivo: "fome_escassez" as const };
    expect(payloadStatus(ativa, estado, AGORA)).toEqual({
      status: "morta",
      motivoStatus: "fome_escassez",
      statusDesde: MEIO_DIA_HOJE,
    });
  });

  it("status muda sem motivo: só status e a data (padrão hoje, também com o campo apagado)", () => {
    const estado = trocarStatus(ativa, "inativa", AGORA);
    expect(payloadStatus(ativa, estado, AGORA)).toEqual({ status: "inativa", statusDesde: MEIO_DIA_HOJE });
    expect(payloadStatus(ativa, { ...estado, desde: "" }, AGORA)).toEqual({ status: "inativa", statusDesde: MEIO_DIA_HOJE });
  });

  it("data informada pelo usuário: meio-dia local daquele dia", () => {
    const estado = { ...trocarStatus(ativa, "morta", AGORA), desde: "2026-11-02" };
    expect(payloadStatus(ativa, estado, AGORA).statusDesde).toBe(new Date(2026, 10, 2, 12).toISOString());
  });

  it("status igual (editando outros campos): nenhum campo de status", () => {
    expect(payloadStatus(ativa, estadoStatusInicial(ativa, AGORA), AGORA)).toEqual({});
  });

  it("motivo incompatível com o status final não sai; texto só com outro", () => {
    const morta = { ...trocarStatus(ativa, "morta", AGORA), motivo: "recuperada" as const, detalhe: "x" };
    expect(payloadStatus(ativa, morta, AGORA)).toEqual({ status: "morta", statusDesde: MEIO_DIA_HOJE });
    const outro = { ...trocarStatus(ativa, "morta", AGORA), motivo: "outro" as const, detalhe: "  Caixa caiu " };
    expect(payloadStatus(ativa, outro, AGORA)).toMatchObject({ motivoStatus: "outro", motivoStatusDetalhe: "Caixa caiu" });
  });

  it("trocar o status limpa data e motivo; voltar ao salvo restaura os valores salvos", () => {
    const morta: StatusOriginal = { status: "morta", statusDesde: new Date(2026, 9, 3, 12).toISOString(), motivoStatus: "frio", motivoStatusDetalhe: null };
    const inicial = estadoStatusInicial(morta, AGORA);
    expect(inicial).toEqual({ status: "morta", desde: "2026-10-03", motivo: "frio", detalhe: "", corrigindo: false });
    expect(trocarStatus(morta, "ativa", AGORA)).toEqual({ status: "ativa", desde: HOJE, motivo: null, detalhe: "", corrigindo: false });
    expect(trocarStatus(morta, "morta", AGORA)).toEqual(inicial);
  });

  describe("correção com o status igual", () => {
    const morta: StatusOriginal = {
      status: "morta",
      statusDesde: new Date(2026, 9, 3, 12).toISOString(),
      motivoStatus: "frio",
      motivoStatusDetalhe: null,
    };
    const corrigindo = (mudancas: Partial<EstadoStatus>): EstadoStatus => ({
      ...estadoStatusInicial(morta, AGORA),
      corrigindo: true,
      ...mudancas,
    });

    it("sem nada alterado: nenhum campo", () => {
      expect(payloadStatus(morta, corrigindo({}), AGORA)).toEqual({});
    });

    it("só o motivo: motivo, sem status nem data", () => {
      expect(payloadStatus(morta, corrigindo({ motivo: "fome_escassez" }), AGORA)).toEqual({ motivoStatus: "fome_escassez" });
    });

    it("só a data: statusDesde, sem status nem motivo", () => {
      expect(payloadStatus(morta, corrigindo({ desde: "2026-10-01" }), AGORA)).toEqual({
        statusDesde: new Date(2026, 9, 1, 12).toISOString(),
      });
    });

    it("motivo apagado vai como null; data apagada mantém a salva", () => {
      expect(payloadStatus(morta, corrigindo({ motivo: null, desde: "" }), AGORA)).toEqual({ motivoStatus: null });
    });

    it("sem status salvo antes (registro antigo): a data de hoje não é enviada sem o usuário mexer", () => {
      const antiga: StatusOriginal = { status: "morta", statusDesde: null, motivoStatus: null, motivoStatusDetalhe: null };
      const estado = { ...estadoStatusInicial(antiga, AGORA), corrigindo: true, motivo: "desconhecida" as const };
      expect(payloadStatus(antiga, estado, AGORA)).toEqual({ motivoStatus: "desconhecida" });
    });

    it("sem status salvo antes: mexer na data e manter hoje envia a data", () => {
      const antiga: StatusOriginal = { status: "morta", statusDesde: null, motivoStatus: null, motivoStatusDetalhe: null };
      const estado = { ...estadoStatusInicial(antiga, AGORA), corrigindo: true, desde: HOJE, desdeTocado: true };
      expect(payloadStatus(antiga, estado, AGORA)).toEqual({ statusDesde: MEIO_DIA_HOJE });
    });
  });
});

describe("payload de contexto da avaliação", () => {
  const vazio = { motivoInspecao: null, motivoInspecaoDetalhe: "", acoes: [], motivosAcoes: {} };

  it("sem nada marcado: nenhuma chave nova (payload igual ao de antes)", () => {
    expect(payloadContextoAvaliacao(vazio)).toEqual({});
    expect(payloadContextoAvaliacao({ ...vazio, acoes: ["Limpeza realizada"] })).toEqual({});
  });

  it("motivo por ação: só as ações marcadas que receberam motivo", () => {
    const contexto = {
      ...vazio,
      acoes: ["Alimentação artificial", "Limpeza realizada"],
      motivosAcoes: { "Alimentação artificial": "resposta_problema" as const },
    };
    expect(payloadContextoAvaliacao(contexto)).toEqual({ motivosAcoes: { "Alimentação artificial": "resposta_problema" } });
  });

  it("ação desmarcada: o motivo dela sai do payload", () => {
    expect(montarMotivosAcoes(["Limpeza realizada"], { "Alimentação artificial": "preventiva" })).toBeNull();
    expect(
      montarMotivosAcoes(["Limpeza realizada"], { "Alimentação artificial": "preventiva", "Limpeza realizada": "preventiva" })
    ).toEqual({ "Limpeza realizada": "preventiva" });
  });

  it("motivo da inspeção; o texto livre só vai com outro", () => {
    expect(payloadContextoAvaliacao({ ...vazio, motivoInspecao: "rotina", motivoInspecaoDetalhe: "ignorado" })).toEqual({
      motivoInspecao: "rotina",
    });
    expect(payloadContextoAvaliacao({ ...vazio, motivoInspecao: "outro", motivoInspecaoDetalhe: " visita " })).toEqual({
      motivoInspecao: "outro",
      motivoInspecaoDetalhe: "visita",
    });
  });

  it("edição: o que existia e foi desmarcado vai como null; o que nunca existiu não vai", () => {
    const original = { motivoInspecao: "outro", motivoInspecaoDetalhe: "visita", motivosAcoes: { "Troca de caixa": "preventiva" } };
    expect(payloadContextoAvaliacao({ ...vazio, acoes: ["Troca de caixa"] }, original)).toEqual({
      motivoInspecao: null,
      motivoInspecaoDetalhe: null,
      motivosAcoes: null,
    });
    expect(payloadContextoAvaliacao(vazio, { motivoInspecao: null, motivoInspecaoDetalhe: null, motivosAcoes: null })).toEqual({});
  });
});
