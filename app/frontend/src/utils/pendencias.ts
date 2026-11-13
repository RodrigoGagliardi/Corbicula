import type { Caracteristicas, DimensoesCaixa } from "../types/api";
import { formatarDataHora, ROTULO_CAIXA, ROTULO_ORIGEM, ROTULO_STATUS_COLONIA } from "./format";
import { ROTULO_PRODUTO } from "./producao";
import { ROTULO_CLASSIFICACAO } from "./score";
import { MOTIVOS_INSPECAO, MOTIVOS_STATUS, rotuloMotivoAcao } from "./vocabularios";

// Rótulos e valores legíveis dos campos de uma pendência de conflito (tela de
// Sincronização). Funções puras.

const ROTULOS: Record<string, string> = {
  dataEntrada: "Data de entrada",
  origem: "Origem",
  tipoCaixa: "Tipo de caixa",
  dimensoesCaixa: "Dimensões da caixa",
  localizacao: "Localização",
  latitude: "Latitude",
  longitude: "Longitude",
  observacoes: "Observações",
  status: "Status",
  statusDesde: "Data do status",
  motivoStatus: "Motivo do status",
  motivoStatusDetalhe: "Detalhe do motivo do status",
  frequenciaInspecaoDias: "Frequência de inspeção (dias)",
  especieId: "Espécie",
  coloniaMaeId: "Colônia mãe",
  coloniaDoadoraCampeirasId: "Doadora de campeiras",
  dataAvaliacao: "Data da avaliação",
  parametros: "Parâmetros avaliados",
  observacoesGerais: "Observações gerais",
  acoesTomadas: "Ações tomadas",
  duracaoMinutos: "Duração (min)",
  motivoInspecao: "Motivo da inspeção",
  motivoInspecaoDetalhe: "Detalhe do motivo da inspeção",
  motivosAcoes: "Motivos das ações",
  dataColheita: "Data da colheita",
  tipoProduto: "Produto",
  quantidade: "Quantidade",
  unidade: "Unidade",
  caracteristicas: "Características",
};

export const rotuloCampo = (campo: string) => ROTULOS[campo] ?? campo;

export interface ContextoValores {
  // Nomes para ids (parâmetros, espécies, colônias) vindos da cópia local.
  nomes: Record<string, string>;
}

const VAZIO = "—";

export function formatarValorCampo(campo: string, valor: unknown, ctx: ContextoValores = { nomes: {} }): string {
  if (valor === null || valor === undefined || valor === "") return VAZIO;
  const nome = (id: unknown) => ctx.nomes[String(id)] ?? String(id);
  switch (campo) {
    case "dataEntrada":
    case "statusDesde":
    case "dataAvaliacao":
    case "dataColheita":
      // Com hora: a comparação é pelo instante, e só a data podia parecer igual nos dois lados.
      return formatarDataHora(String(valor));
    case "origem":
      return ROTULO_ORIGEM[valor as keyof typeof ROTULO_ORIGEM] ?? String(valor);
    case "tipoCaixa":
      return ROTULO_CAIXA[valor as keyof typeof ROTULO_CAIXA] ?? String(valor);
    case "status":
      return ROTULO_STATUS_COLONIA[valor as keyof typeof ROTULO_STATUS_COLONIA] ?? String(valor);
    case "motivoStatus":
      return MOTIVOS_STATUS[valor as keyof typeof MOTIVOS_STATUS]?.rotulo ?? String(valor);
    case "motivoInspecao":
      return MOTIVOS_INSPECAO[valor as keyof typeof MOTIVOS_INSPECAO] ?? String(valor);
    case "tipoProduto":
      return ROTULO_PRODUTO[valor as keyof typeof ROTULO_PRODUTO] ?? String(valor);
    case "especieId":
    case "coloniaMaeId":
    case "coloniaDoadoraCampeirasId":
      return nome(valor);
    case "dimensoesCaixa": {
      const d = valor as DimensoesCaixa;
      return `${[d.altura, d.largura, d.profundidade].map((v) => v ?? "?").join(" × ")} cm`;
    }
    case "parametros":
      return (valor as { parametroId: string; classificacao: keyof typeof ROTULO_CLASSIFICACAO; observacoes?: string | null }[])
        .map(
          (p) =>
            `${nome(p.parametroId)}: ${ROTULO_CLASSIFICACAO[p.classificacao] ?? p.classificacao}${p.observacoes ? ` (${p.observacoes})` : ""}`
        )
        .join("; ");
    case "acoesTomadas":
      return (valor as string[]).length ? (valor as string[]).join(", ") : VAZIO;
    case "motivosAcoes":
      return Object.entries(valor as Record<string, string>)
        .map(([acao, motivo]) => `${acao}: ${rotuloMotivoAcao(motivo)}`)
        .join("; ") || VAZIO;
    case "caracteristicas": {
      const c = valor as Caracteristicas;
      const partes = [c.cor && `Cor: ${c.cor}`, c.aroma && `Aroma: ${c.aroma}`, c.sabor && `Sabor: ${c.sabor}`].filter(Boolean);
      return partes.join(" · ") || VAZIO;
    }
    default:
      return typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  }
}
