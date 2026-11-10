import type { AvaliacaoInput, ColoniaInput, Especie, ProducaoInput } from "../../types/api";
import { calcularScore } from "../../utils/score";
import type { AvaliacaoParametroServidor, AvaliacaoServidor, ColoniaServidor, ProducaoServidor } from "./tipos";

// Aplica uma escrita offline à cópia local, no formato das linhas do pull
// (funções puras). Os valores que o servidor calcula aparecem como prévia ou
// provisórios até o próximo pull trazer os definitivos:
//  - código da colônia: `<PREFIXO>-NNN (provisório)`, mesma regra do servidor
//    (colonias.service.ts) sobre as colônias locais;
//  - score e status da avaliação: a prévia de utils/score.ts (mesma fórmula);
//  - clima e protocolo: vazios (o servidor preenche ao sincronizar).
// Um update preserva o `updatedAt` da linha: ele é a versão do servidor que a
// fila usa como `baseUpdatedAt`.

export const SUFIXO_PROVISORIO = " (provisório)";

// Datas chegam em ISO 8601 (o mesmo que a API REST recebe); a linha guarda o
// formato que o servidor devolve.
const iso = (valor: string) => new Date(valor).toISOString();

const PREFIXO_SEM_ESPECIE = "COL";

export function codigoProvisorio(prefixo: string, colonias: readonly Pick<ColoniaServidor, "codigo">[]): string {
  let maior = 0;
  for (const { codigo } of colonias) {
    const m = new RegExp(`^${prefixo}-(\\d+)`).exec(codigo);
    if (m) maior = Math.max(maior, Number(m[1]));
  }
  return `${prefixo}-${String(maior + 1).padStart(3, "0")}${SUFIXO_PROVISORIO}`;
}

const prefixoDa = (especieId: string | null | undefined, especies: readonly Especie[]) =>
  especies.find((e) => e.id === especieId)?.codigo ?? PREFIXO_SEM_ESPECIE;

export interface ContextoColonia {
  userId: string;
  especies: readonly Especie[];
  colonias: readonly ColoniaServidor[];
  // Instante da operação (ISO).
  agora: string;
}

export function novaColonia(id: string, dados: ColoniaInput, ctx: ContextoColonia): ColoniaServidor {
  return {
    id,
    userId: ctx.userId,
    codigo: codigoProvisorio(prefixoDa(dados.especieId, ctx.especies), ctx.colonias),
    dataEntrada: iso(dados.dataEntrada),
    origem: dados.origem,
    tipoCaixa: dados.tipoCaixa,
    dimensoesCaixa: dados.dimensoesCaixa ?? null,
    localizacao: dados.localizacao ?? null,
    latitude: dados.latitude ?? null,
    longitude: dados.longitude ?? null,
    observacoes: dados.observacoes ?? null,
    status: dados.status ?? "ativa",
    frequenciaInspecaoDias: dados.frequenciaInspecaoDias ?? null,
    // Criar a colônia não gera entrada no histórico de status (regra do servidor).
    statusDesde: null,
    motivoStatus: null,
    motivoStatusDetalhe: null,
    especieId: dados.especieId ?? null,
    coloniaMaeId: dados.coloniaMaeId ?? null,
    coloniaDoadoraCampeirasId: dados.coloniaDoadoraCampeirasId ?? null,
    createdAt: ctx.agora,
    updatedAt: ctx.agora,
  };
}

const CAMPOS_COLONIA = [
  "origem",
  "tipoCaixa",
  "dimensoesCaixa",
  "localizacao",
  "latitude",
  "longitude",
  "observacoes",
  "frequenciaInspecaoDias",
  "coloniaMaeId",
  "coloniaDoadoraCampeirasId",
] as const;

// Campos enviados substituem os da linha; `undefined` = não enviado.
function copiarDefinidos<T extends object>(alvo: T, dados: object, campos: readonly string[]): T {
  const fonte = dados as Record<string, unknown>;
  const saida = { ...alvo } as Record<string, unknown>;
  for (const campo of campos) if (fonte[campo] !== undefined) saida[campo] = fonte[campo];
  return saida as T;
}

export function atualizarColonia(linha: ColoniaServidor, dados: Partial<ColoniaInput>, ctx: ContextoColonia): ColoniaServidor {
  const nova = copiarDefinidos(linha, dados, CAMPOS_COLONIA);
  if (dados.dataEntrada !== undefined) nova.dataEntrada = iso(dados.dataEntrada);

  // Identificar uma colônia sem espécie (COL-NNN) dá a ela o código da espécie.
  if (dados.especieId !== undefined && dados.especieId !== linha.especieId) {
    nova.especieId = dados.especieId;
    if (!linha.especieId && dados.especieId) {
      const outras = ctx.colonias.filter((c) => c.id !== linha.id);
      nova.codigo = codigoProvisorio(prefixoDa(dados.especieId, ctx.especies), outras);
    }
  }

  const mudouStatus = dados.status !== undefined && dados.status !== linha.status;
  if (mudouStatus) {
    // Mesma regra do servidor: data percebida = statusDesde ou o instante da operação.
    nova.status = dados.status!;
    nova.statusDesde = dados.statusDesde ? iso(dados.statusDesde) : ctx.agora;
    nova.motivoStatus = dados.motivoStatus ?? null;
    nova.motivoStatusDetalhe = dados.motivoStatusDetalhe ?? null;
  } else {
    // Sem mudança de status, os campos enviados corrigem a data e o motivo atuais.
    if (dados.statusDesde !== undefined) nova.statusDesde = iso(dados.statusDesde);
    if (dados.motivoStatus !== undefined) nova.motivoStatus = dados.motivoStatus;
    if (dados.motivoStatusDetalhe !== undefined) nova.motivoStatusDetalhe = dados.motivoStatusDetalhe;
  }
  return nova;
}

function linhasParametros(
  avaliacaoId: string,
  parametros: AvaliacaoInput["parametros"],
  agora: string,
  gerarId: () => string
): AvaliacaoParametroServidor[] {
  return parametros.map((p) => ({
    id: gerarId(),
    avaliacaoId,
    parametroId: p.parametroId,
    classificacao: p.classificacao,
    valorNumerico: null,
    observacoes: p.observacoes ?? null,
    createdAt: agora,
  }));
}

function scoreDa(parametros: AvaliacaoInput["parametros"]) {
  const previa = calcularScore(parametros.map((p) => p.classificacao));
  // Sem parâmetros o servidor recusa a avaliação; a linha local só não quebra.
  return previa ? { scoreGeral: previa.score, statusGeral: previa.status } : { scoreGeral: 0, statusGeral: "critica" as const };
}

export function novaAvaliacao(
  id: string,
  coloniaId: string,
  dados: AvaliacaoInput,
  agora: string,
  gerarId: () => string
): AvaliacaoServidor {
  return {
    id,
    coloniaId,
    dataAvaliacao: iso(dados.dataAvaliacao),
    duracaoMinutos: dados.duracaoMinutos ?? null,
    temperatura: null,
    umidade: null,
    condicaoClimatica: null,
    observacoesGerais: dados.observacoesGerais ?? null,
    acoesTomadas: dados.acoesTomadas ?? [],
    motivoInspecao: dados.motivoInspecao ?? null,
    motivoInspecaoDetalhe: dados.motivoInspecaoDetalhe ?? null,
    motivosAcoes: dados.motivosAcoes ?? null,
    climaFonte: null,
    protocoloId: null,
    ...scoreDa(dados.parametros),
    createdAt: agora,
    updatedAt: agora,
    parametros: linhasParametros(id, dados.parametros, agora, gerarId),
  };
}

const CAMPOS_AVALIACAO = [
  "duracaoMinutos",
  "observacoesGerais",
  "motivoInspecao",
  "motivoInspecaoDetalhe",
  "motivosAcoes",
] as const;

export function atualizarAvaliacao(
  linha: AvaliacaoServidor,
  dados: Partial<AvaliacaoInput>,
  agora: string,
  gerarId: () => string
): AvaliacaoServidor {
  const nova = copiarDefinidos(linha, dados, CAMPOS_AVALIACAO);
  if (dados.dataAvaliacao !== undefined) nova.dataAvaliacao = iso(dados.dataAvaliacao);
  if (dados.acoesTomadas !== undefined) nova.acoesTomadas = dados.acoesTomadas ?? [];
  if (dados.parametros !== undefined) {
    // O servidor recalcula o score com o conjunto enviado; aqui, a prévia.
    Object.assign(nova, scoreDa(dados.parametros));
    nova.parametros = linhasParametros(linha.id, dados.parametros, agora, gerarId);
  }
  return nova;
}

export function novaProducao(id: string, dados: ProducaoInput, agora: string): ProducaoServidor {
  return {
    id,
    coloniaId: dados.coloniaId,
    dataColheita: iso(dados.dataColheita),
    tipoProduto: dados.tipoProduto,
    quantidade: dados.quantidade,
    unidade: dados.unidade,
    caracteristicas: dados.caracteristicas ?? null,
    observacoes: dados.observacoes ?? null,
    createdAt: agora,
    updatedAt: agora,
  };
}

const CAMPOS_PRODUCAO = ["tipoProduto", "quantidade", "unidade", "caracteristicas", "observacoes"] as const;

export function atualizarProducao(linha: ProducaoServidor, dados: Partial<Omit<ProducaoInput, "coloniaId">>): ProducaoServidor {
  const nova = copiarDefinidos(linha, dados, CAMPOS_PRODUCAO);
  if (dados.dataColheita !== undefined) nova.dataColheita = iso(dados.dataColheita);
  return nova;
}
