import type {
  AvaliacaoDetalhada,
  AvaliacaoHistorico,
  AvaliacaoLista,
  AvaliacaoResumo,
  Colonia,
  ColoniaDetalhada,
  CriterioEspecie,
  Especie,
  EspecieResumo,
  FiltrosAvaliacoes,
  FiltrosProducao,
  Parametro,
  Producao,
} from "../../types/api";
import { ErroApi } from "../api/client";
import type { AvaliacaoServidor, ColoniaServidor, ParametroServidor, ProducaoServidor } from "./tipos";

// Leituras offline: montam, a partir das linhas do banco local (formato do
// GET /sync/alteracoes), a mesma resposta que a rota REST daria. Funções puras,
// sem IndexedDB. Referência no backend:
//  - colonias.repository.ts: ordem status, código; `ultimaAvaliacao` = data mais
//    recente; filhas e receptoras por código; `especie` e `_count` embutidos;
//  - avaliacoes.repository.ts: data desc; parâmetros por `parametro.ordem`;
//    filtro de parâmetro + classificação num único `some`;
//  - producoes.repository.ts: `dataColheita` desc;
//  - parametros.repository.ts: ordem, nome; critérios por `especie.nomePopular`;
//    lista também os inativos.
// Datas dos filtros (`desde`/`ate`): inclusivas sobre o instante, como o
// `z.coerce.date()` do servidor ("YYYY-MM-DD" = meia-noite UTC).

export interface DadosLocais {
  colonias: ColoniaServidor[];
  avaliacoes: AvaliacaoServidor[];
  producoes: ProducaoServidor[];
  parametros: ParametroServidor[];
  especies: Especie[];
}

// ─── Comparações ──────────────────────────────────────────────────────────────

// Códigos (KEW-NNN, COL-NNN) e status são ASCII: comparação simples.
const porTexto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
// Nomes digitados (parâmetros, espécies): ordem alfabética do português.
const porNome = new Intl.Collator("pt-BR").compare;
const instante = (iso: string) => Date.parse(iso);
const maisRecentePrimeiro = (a: string, b: string) => instante(b) - instante(a);

function porColonia<T extends { coloniaId: string }>(linhas: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const l of linhas) {
    const lista = mapa.get(l.coloniaId);
    if (lista) lista.push(l);
    else mapa.set(l.coloniaId, [l]);
  }
  return mapa;
}

// Mesmo `new Date(valor)` do `z.coerce.date()` do servidor.
function dentroDoPeriodo(data: string, desde?: string, ate?: string): boolean {
  const t = instante(data);
  if (desde !== undefined && !(t >= new Date(desde).getTime())) return false;
  if (ate !== undefined && !(t <= new Date(ate).getTime())) return false;
  return true;
}

const preenchido = <T>(v: T | undefined | ""): v is T => v !== undefined && v !== "";

// ─── Espécies ─────────────────────────────────────────────────────────────────

const especiesPorId = (especies: Especie[]) => new Map(especies.map((e) => [e.id, e]));

function especieResumo(especies: Map<string, Especie>, especieId: string | null): EspecieResumo | null {
  const e = especieId ? especies.get(especieId) : undefined;
  return e ? { codigo: e.codigo, nomePopular: e.nomePopular, nomeCientifico: e.nomeCientifico } : null;
}

// GET /especies: catálogo por nome popular.
export function listarEspecies(especies: Especie[]): Especie[] {
  return [...especies].sort((a, b) => porNome(a.nomePopular, b.nomePopular));
}

// ─── Colônias ─────────────────────────────────────────────────────────────────

function resumoAvaliacao(a: AvaliacaoServidor): AvaliacaoResumo {
  return { id: a.id, dataAvaliacao: a.dataAvaliacao, scoreGeral: a.scoreGeral, statusGeral: a.statusGeral };
}

function maisRecente(avaliacoes: AvaliacaoServidor[] | undefined): AvaliacaoServidor | undefined {
  let atual: AvaliacaoServidor | undefined;
  for (const a of avaliacoes ?? []) if (!atual || instante(a.dataAvaliacao) > instante(atual.dataAvaliacao)) atual = a;
  return atual;
}

// Mãe ou doadora ausente do banco local (ex.: excluída no servidor) = sem vínculo.
function vinculo(ids: ReadonlySet<string>, id: string | null): string | null {
  return id && ids.has(id) ? id : null;
}

interface Indices {
  ids: Set<string>;
  especies: Map<string, Especie>;
  avaliacoes: Map<string, AvaliacaoServidor[]>;
  producoes: Map<string, ProducaoServidor[]>;
}

function indexar(dados: Pick<DadosLocais, "colonias" | "avaliacoes" | "producoes" | "especies">): Indices {
  return {
    ids: new Set(dados.colonias.map((c) => c.id)),
    especies: especiesPorId(dados.especies),
    avaliacoes: porColonia(dados.avaliacoes),
    producoes: porColonia(dados.producoes),
  };
}

function montarColonia(c: ColoniaServidor, idx: Indices): Colonia {
  const ultima = maisRecente(idx.avaliacoes.get(c.id));
  return {
    ...c,
    coloniaMaeId: vinculo(idx.ids, c.coloniaMaeId),
    coloniaDoadoraCampeirasId: vinculo(idx.ids, c.coloniaDoadoraCampeirasId),
    especie: especieResumo(idx.especies, c.especieId),
    ultimaAvaliacao: ultima ? resumoAvaliacao(ultima) : null,
    _count: { avaliacoes: idx.avaliacoes.get(c.id)?.length ?? 0, producoes: idx.producoes.get(c.id)?.length ?? 0 },
  };
}

// GET /colonias
export function listarColonias(dados: Pick<DadosLocais, "colonias" | "avaliacoes" | "producoes" | "especies">): Colonia[] {
  const idx = indexar(dados);
  return [...dados.colonias]
    .sort((a, b) => porTexto(a.status, b.status) || porTexto(a.codigo, b.codigo))
    .map((c) => montarColonia(c, idx));
}

const naoEncontrado = (mensagem: string) => new ErroApi(404, mensagem);

// GET /colonias/:id
export function buscarColonia(
  dados: Pick<DadosLocais, "colonias" | "avaliacoes" | "producoes" | "especies">,
  id: string
): ColoniaDetalhada {
  const linha = dados.colonias.find((c) => c.id === id);
  if (!linha) throw naoEncontrado("Colônia não encontrada");
  const idx = indexar(dados);
  const base = montarColonia(linha, idx);
  const porId = new Map(dados.colonias.map((c) => [c.id, c]));
  const ref = (refId: string | null) => {
    const c = refId ? porId.get(refId) : undefined;
    return c ? { id: c.id, codigo: c.codigo } : null;
  };
  const relacionadas = (filtro: (c: ColoniaServidor) => boolean) =>
    dados.colonias
      .filter(filtro)
      .sort((a, b) => porTexto(a.codigo, b.codigo))
      .map((c) => ({ id: c.id, codigo: c.codigo, status: c.status }));

  // O detalhe do servidor traz também `caracteristicas` da espécie (texto JSON, como no banco).
  const especie = linha.especieId ? idx.especies.get(linha.especieId) : undefined;
  const caracteristicas = (especie as { caracteristicas?: unknown } | undefined)?.caracteristicas;

  return {
    ...base,
    especie: base.especie && {
      ...base.especie,
      caracteristicas: caracteristicas == null ? null : typeof caracteristicas === "string" ? caracteristicas : JSON.stringify(caracteristicas),
    },
    coloniaMae: ref(base.coloniaMaeId),
    coloniasFilhas: relacionadas((c) => c.coloniaMaeId === id),
    coloniaDoadoraCampeiras: ref(base.coloniaDoadoraCampeirasId),
    coloniasReceptorasCampeiras: relacionadas((c) => c.coloniaDoadoraCampeirasId === id),
  } as ColoniaDetalhada;
}

// ─── Avaliações ───────────────────────────────────────────────────────────────

function avaliacaoLista(a: AvaliacaoServidor): AvaliacaoLista {
  const { parametros, ...resto } = a;
  return { ...resto, _count: { parametros: parametros.length } };
}

// GET /colonias/:coloniaId/avaliacoes (404 se a colônia não existe).
export function listarAvaliacoesDaColonia(
  dados: Pick<DadosLocais, "colonias" | "avaliacoes">,
  coloniaId: string
): AvaliacaoLista[] {
  if (!dados.colonias.some((c) => c.id === coloniaId)) throw naoEncontrado("Colônia não encontrada");
  return dados.avaliacoes
    .filter((a) => a.coloniaId === coloniaId)
    .sort((a, b) => maisRecentePrimeiro(a.dataAvaliacao, b.dataAvaliacao))
    .map(avaliacaoLista);
}

// GET /avaliacoes (histórico de todas as colônias, com filtros).
export function historicoAvaliacoes(
  dados: Pick<DadosLocais, "colonias" | "avaliacoes" | "especies">,
  filtros: FiltrosAvaliacoes = {}
): AvaliacaoHistorico[] {
  const colonias = new Map(dados.colonias.map((c) => [c.id, c]));
  const especies = especiesPorId(dados.especies);
  const { coloniaId, status, parametroId, classificacao, desde, ate } = filtros;
  const filtraParametro = preenchido(parametroId) || preenchido(classificacao);

  return dados.avaliacoes
    .filter((a) => {
      if (!colonias.has(a.coloniaId)) return false;
      if (preenchido(coloniaId) && a.coloniaId !== coloniaId) return false;
      if (preenchido(status) && a.statusGeral !== status) return false;
      // Um mesmo parâmetro avaliado precisa atender aos dois critérios (`some` único no servidor).
      if (
        filtraParametro &&
        !a.parametros.some(
          (p) =>
            (!preenchido(parametroId) || p.parametroId === parametroId) &&
            (!preenchido(classificacao) || p.classificacao === classificacao)
        )
      ) {
        return false;
      }
      return dentroDoPeriodo(a.dataAvaliacao, preenchido(desde) ? desde : undefined, preenchido(ate) ? ate : undefined);
    })
    .sort((a, b) => maisRecentePrimeiro(a.dataAvaliacao, b.dataAvaliacao))
    .map((a) => {
      const c = colonias.get(a.coloniaId)!;
      const e = c.especieId ? especies.get(c.especieId) : undefined;
      return {
        ...avaliacaoLista(a),
        colonia: { id: c.id, codigo: c.codigo, especie: e ? { codigo: e.codigo, nomePopular: e.nomePopular } : null },
      };
    });
}

// GET /colonias/:coloniaId/avaliacoes/:id
export function buscarAvaliacao(
  dados: Pick<DadosLocais, "colonias" | "avaliacoes" | "parametros">,
  coloniaId: string,
  id: string
): AvaliacaoDetalhada {
  if (!dados.colonias.some((c) => c.id === coloniaId)) throw naoEncontrado("Colônia não encontrada");
  const a = dados.avaliacoes.find((x) => x.id === id && x.coloniaId === coloniaId);
  if (!a) throw naoEncontrado("Avaliação não encontrada");

  const parametros = new Map(dados.parametros.map((p) => [p.id, p]));
  return {
    ...a,
    parametros: a.parametros
      // A chave estrangeira garante o parâmetro no servidor; localmente, só por uma carga incompleta faltaria.
      .filter((p) => parametros.has(p.parametroId))
      .map((p) => {
        const par = parametros.get(p.parametroId)!;
        return { ...p, parametro: { id: par.id, nome: par.nome, ordem: par.ordem } };
      })
      .sort((x, y) => x.parametro.ordem - y.parametro.ordem),
  };
}

// ─── Produções ────────────────────────────────────────────────────────────────

function montarProducao(p: ProducaoServidor, c: ColoniaServidor, especies: Map<string, Especie>): Producao {
  return {
    ...p,
    colonia: { id: c.id, codigo: c.codigo, especie: especieResumo(especies, c.especieId) },
    // Fotos não ficam no banco local; a interface não lê este campo.
    _count: { fotos: 0 },
  };
}

// GET /producoes
export function listarProducoes(
  dados: Pick<DadosLocais, "colonias" | "producoes" | "especies">,
  filtros: FiltrosProducao = {}
): Producao[] {
  const colonias = new Map(dados.colonias.map((c) => [c.id, c]));
  const especies = especiesPorId(dados.especies);
  const { coloniaId, tipoProduto, desde, ate } = filtros;
  return dados.producoes
    .filter(
      (p) =>
        colonias.has(p.coloniaId) &&
        (!preenchido(coloniaId) || p.coloniaId === coloniaId) &&
        (!preenchido(tipoProduto) || p.tipoProduto === tipoProduto) &&
        dentroDoPeriodo(p.dataColheita, preenchido(desde) ? desde : undefined, preenchido(ate) ? ate : undefined)
    )
    .sort((a, b) => maisRecentePrimeiro(a.dataColheita, b.dataColheita))
    .map((p) => montarProducao(p, colonias.get(p.coloniaId)!, especies));
}

// GET /producoes/:id
export function buscarProducao(dados: Pick<DadosLocais, "colonias" | "producoes" | "especies">, id: string): Producao {
  const p = dados.producoes.find((x) => x.id === id);
  const c = p && dados.colonias.find((x) => x.id === p.coloniaId);
  if (!p || !c) throw naoEncontrado("Colheita não encontrada");
  return montarProducao(p, c, especiesPorId(dados.especies));
}

// ─── Parâmetros ───────────────────────────────────────────────────────────────

// GET /parametros (sem filtro: ativos e inativos).
export function listarParametros(dados: Pick<DadosLocais, "parametros" | "avaliacoes" | "especies">): Parametro[] {
  const especies = especiesPorId(dados.especies);
  const usos = new Map<string, number>();
  for (const a of dados.avaliacoes) for (const p of a.parametros) usos.set(p.parametroId, (usos.get(p.parametroId) ?? 0) + 1);

  return [...dados.parametros]
    .sort((a, b) => a.ordem - b.ordem || porNome(a.nome, b.nome))
    .map((p) => ({
      ...p,
      criteriosEspecie: p.criteriosEspecie
        .map((c): CriterioEspecie => {
          const e = especies.get(c.especieId);
          // Sem o catálogo local, o critério continua casando pelo `especieId`.
          return { ...c, especie: e ? { id: e.id, codigo: e.codigo, nomePopular: e.nomePopular } : { id: c.especieId, codigo: "", nomePopular: "" } };
        })
        .sort((x, y) => porNome(x.especie.nomePopular, y.especie.nomePopular)),
      _count: { avaliacoesParametros: usos.get(p.id) ?? 0 },
    }));
}
