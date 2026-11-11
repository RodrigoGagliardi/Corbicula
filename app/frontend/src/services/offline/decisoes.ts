import { useAuth } from "../../store/auth";
import type { AvaliacaoInput, ColoniaInput, ProducaoInput } from "../../types/api";
import { ErroApi } from "../api/client";
import { aplicarDecisao, lerFila, lerFotos, type BancoOffline, type MudancaLocal, type PlanoDecisao } from "./banco";
import { bancoDoUsuario, novoId } from "./escrita";
import { relacionadasDe } from "./fila";
import { camposDoAparelho, iguais } from "./juncao";
import { podeEditar } from "../../utils/score";
import { semRede } from "./leituraLocal";
import {
  atualizarAvaliacao,
  atualizarColonia,
  atualizarProducao,
  linhaDoServidor,
  novaAvaliacao,
  novaColonia,
  novaProducao,
} from "./linhaLocal";
import { atualizarContagem, sincronizar } from "./sincronizacao";
import type { FotoPendente, LinhaLocal, OperacaoFila } from "./tipos";
import { validarEdicaoAvaliacao, validarEdicaoColonia, validarNovaAvaliacao, validarNovaColonia } from "./validacoes";

// Decisões do usuário sobre operações paradas na fila (story 6, CAP-6):
//  - conflito no mesmo campo: manter a versão do servidor, a do aparelho, ou editar;
//  - recusa do servidor: editar ou descartar.
// Cada decisão é um plano puro (planoServidor, planoAparelho, planoDescartar,
// planoSubstituir) aplicado numa transação só (`aplicarDecisao`), seguido de uma
// sincronização. Regras do autor (10/11/2026):
//  - "Servidor" descarta também as edições seguintes do mesmo registro;
//  - descartar o create recusado de uma colônia leva junto o que foi criado
//    offline a partir dela (avaliações, colheitas, divisões, fotos);
//  - "Editar manualmente" abre o formulário normal; salvar substitui a operação
//    parada na mesma posição da fila.

export const STORE_DO_TIPO = { colonia: "colonias", avaliacao: "avaliacoes", producao: "producoes" } as const;

const parada = (op: OperacaoFila) => op.estado === "conflito" || op.estado === "erro";
const porOrdem = (fila: readonly OperacaoFila[]) => [...fila].sort((a, b) => a.ordem - b.ordem);

// Operações seguintes do mesmo registro (depois da parada).
export const seguintesDoRegistro = (fila: readonly OperacaoFila[], op: OperacaoFila) =>
  fila.filter((o) => o.entidadeId === op.entidadeId && o.ordem > op.ordem);

const vazio = (): PlanoDecisao => ({ removerOperacoes: [], gravarOperacoes: [], mudancas: [], removerFotos: [], recarregarTudo: false });

// "Servidor": tira a operação e as seguintes do registro; a cópia local recebe a
// versão do servidor que veio no conflito.
export function planoServidor(fila: readonly OperacaoFila[], op: OperacaoFila): PlanoDecisao {
  const plano = vazio();
  plano.removerOperacoes = [op.id, ...seguintesDoRegistro(fila, op).map((o) => o.id)];
  if (op.servidor) plano.mudancas.push({ store: STORE_DO_TIPO[op.tipo], gravar: linhaDoServidor(op.tipo, op.servidor) });
  else plano.recarregarTudo = true;
  return plano;
}

// "Aparelho": reenvia sobre a versão do servidor todos os campos que o aparelho
// mudou (os em conflito incluídos). Campos que só o servidor mudou ficam com ele:
// nada é sobrescrito em silêncio.
export function planoAparelho(op: OperacaoFila): PlanoDecisao {
  const servidor = op.servidor as { updatedAt?: string } | undefined;
  const { servidor: _s, conflitos: _c, ultimoErro: _e, ...resto } = op;
  const nova: OperacaoFila = {
    ...resto,
    dados: camposDoAparelho(op),
    estado: "pendente",
    ...(servidor?.updatedAt && { baseUpdatedAt: servidor.updatedAt }),
    ...(op.servidor !== undefined && { base: linhaDoServidor(op.tipo, op.servidor) }),
  };
  return { ...vazio(), gravarOperacoes: [nova] };
}

export interface Dependentes {
  operacoes: OperacaoFila[];
  fotos: FotoPendente[];
}

// O que sai junto ao descartar: as seguintes do mesmo registro e, se a operação
// é um create, tudo o que foi criado offline a partir dele (em cascata).
export function dependentesDoDescarte(fila: readonly OperacaoFila[], fotos: readonly FotoPendente[], op: OperacaoFila): Dependentes {
  const removidas = new Map<string, OperacaoFila>([[op.id, op]]);
  for (const o of seguintesDoRegistro(fila, op)) removidas.set(o.id, o);
  const criadas = new Set(op.operacao === "create" ? [op.entidadeId] : []);
  let mudou = criadas.size > 0;
  while (mudou) {
    mudou = false;
    for (const o of fila) {
      if (removidas.has(o.id)) continue;
      if (criadas.has(o.entidadeId) || o.relacionadas.some((id) => criadas.has(id))) {
        removidas.set(o.id, o);
        if (o.operacao === "create" && !criadas.has(o.entidadeId)) criadas.add(o.entidadeId);
        mudou = true;
      }
    }
  }
  return {
    operacoes: porOrdem([...removidas.values()].filter((o) => o.id !== op.id)),
    fotos: fotos.filter((f) => criadas.has(f.entidadeId)),
  };
}

// "Descartar": tira a operação (e os dependentes) e desfaz o efeito na cópia local:
// create → a linha sai; update → volta a linha anterior; delete → recarga completa
// no próximo pull (a linha já tinha saído da cópia).
export function planoDescartar(fila: readonly OperacaoFila[], fotos: readonly FotoPendente[], op: OperacaoFila): PlanoDecisao {
  const plano = vazio();
  const { operacoes, fotos: fotosDependentes } = dependentesDoDescarte(fila, fotos, op);
  const todas = porOrdem([op, ...operacoes]);
  plano.removerOperacoes = todas.map((o) => o.id);
  plano.removerFotos = fotosDependentes.map((f) => f.id);

  // Por registro, o efeito da primeira operação descartada decide o que volta.
  const vistos = new Set<string>();
  for (const o of todas) {
    if (vistos.has(o.entidadeId)) continue;
    vistos.add(o.entidadeId);
    const store = STORE_DO_TIPO[o.tipo];
    if (o.operacao === "create") plano.mudancas.push({ store, remover: [o.entidadeId] });
    else if (o.operacao === "update" && o.base) plano.mudancas.push({ store, gravar: o.base });
    else plano.recarregarTudo = true;
  }
  return plano;
}

// "Editar manualmente" → salvar: a nova operação ocupa a posição da parada (as
// dependentes continuam depois dela); as seguintes do registro saem (o formulário
// já mostrava o estado com elas).
export function planoSubstituir(
  fila: readonly OperacaoFila[],
  op: OperacaoFila,
  nova: Omit<OperacaoFila, "ordem">,
  mudanca: MudancaLocal
): PlanoDecisao {
  return {
    ...vazio(),
    removerOperacoes: [op.id, ...seguintesDoRegistro(fila, op).map((o) => o.id)],
    gravarOperacoes: [{ ...nova, ordem: op.ordem }],
    mudancas: [mudanca],
  };
}

// ─── Acesso (IndexedDB do usuário da sessão) ──────────────────────────────────

async function contexto(): Promise<{ db: BancoOffline; usuarioId: string }> {
  const usuarioId = useAuth.getState().usuario?.id;
  const db = await bancoDoUsuario(usuarioId);
  if (!db || !usuarioId) throw new ErroApi(0, "O armazenamento local deste navegador não está disponível.");
  return { db, usuarioId };
}

async function operacaoParada(db: BancoOffline, opId: string): Promise<{ fila: OperacaoFila[]; op: OperacaoFila }> {
  const fila = await lerFila(db);
  const op = fila.find((o) => o.id === opId);
  if (!op || !parada(op)) throw new ErroApi(404, "Esta pendência já foi resolvida.");
  return { fila, op };
}

async function concluir(db: BancoOffline, usuarioId: string, plano: PlanoDecisao) {
  await aplicarDecisao(db, plano);
  await atualizarContagem(usuarioId);
  if (!semRede()) void sincronizar(usuarioId);
}

export interface Pendencia {
  op: OperacaoFila;
  rotulo: string;
  // Formulário de edição (com ?pendencia=) e detalhe do registro; null quando não há.
  rotaEdicao: string | null;
  rotaDetalhe: string | null;
  // O que sai junto ao escolher "Servidor" / "Descartar".
  seguintes: number;
  dependentes: { operacoes: number; fotos: number };
}

const dataCurta = (iso: string | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

async function descrever(db: BancoOffline, fila: OperacaoFila[], fotos: FotoPendente[], op: OperacaoFila): Promise<Pendencia> {
  const base = { op, seguintes: seguintesDoRegistro(fila, op).length };
  const dep = dependentesDoDescarte(fila, fotos, op);
  const dependentes = { operacoes: dep.operacoes.length, fotos: dep.fotos.length };
  const editavel = op.operacao !== "delete";
  const q = `?pendencia=${encodeURIComponent(op.id)}`;
  if (op.tipo === "colonia") {
    const c = await db.get("colonias", op.entidadeId);
    const codigo = c?.codigo ?? (op.base as { codigo?: string } | undefined)?.codigo ?? "";
    return {
      ...base,
      dependentes,
      rotulo: `Colônia ${codigo}`.trim(),
      rotaEdicao: editavel ? `/app/colonias/${op.entidadeId}/editar${q}` : null,
      rotaDetalhe: c ? `/app/colonias/${op.entidadeId}` : null,
    };
  }
  if (op.tipo === "avaliacao") {
    const [a, c] = await Promise.all([db.get("avaliacoes", op.entidadeId), op.coloniaId ? db.get("colonias", op.coloniaId) : undefined]);
    return {
      ...base,
      dependentes,
      rotulo: `Avaliação de ${dataCurta(a?.dataAvaliacao ?? (op.dados.dataAvaliacao as string | undefined))}${c ? ` · ${c.codigo}` : ""}`,
      // Fora da janela de 7 dias a edição não abre (nem o servidor aceitaria): resta descartar.
      rotaEdicao:
        editavel && op.coloniaId && (!a || podeEditar(a.createdAt))
          ? `/app/colonias/${op.coloniaId}/avaliacoes/${op.entidadeId}/editar${q}`
          : null,
      rotaDetalhe: a && op.coloniaId ? `/app/colonias/${op.coloniaId}/avaliacoes/${op.entidadeId}` : null,
    };
  }
  const p = await db.get("producoes", op.entidadeId);
  return {
    ...base,
    dependentes,
    rotulo: `Colheita de ${dataCurta(p?.dataColheita ?? (op.dados.dataColheita as string | undefined))}`,
    rotaEdicao: editavel ? `/app/producao/${op.entidadeId}/editar${q}` : null,
    rotaDetalhe: null,
  };
}

// Operações paradas (conflito ou recusa), na ordem da fila. Sem banco: lista vazia.
export async function listarPendencias(): Promise<Pendencia[]> {
  const db = await bancoDoUsuario(useAuth.getState().usuario?.id);
  if (!db) return [];
  const [fila, fotos] = await Promise.all([lerFila(db), lerFotos(db)]);
  return Promise.all(porOrdem(fila.filter(parada)).map((op) => descrever(db, fila, fotos, op)));
}

// Pendência de um registro (para o aviso no detalhe); null se não há.
export async function pendenciaDoRegistro(entidadeId: string): Promise<OperacaoFila | null> {
  const db = await bancoDoUsuario(useAuth.getState().usuario?.id);
  if (!db) return null;
  return porOrdem(await lerFila(db)).find((o) => parada(o) && o.entidadeId === entidadeId) ?? null;
}

export async function manterServidor(opId: string): Promise<void> {
  const { db, usuarioId } = await contexto();
  const { fila, op } = await operacaoParada(db, opId);
  await concluir(db, usuarioId, planoServidor(fila, op));
}

export async function manterAparelho(opId: string): Promise<void> {
  const { db, usuarioId } = await contexto();
  const { op } = await operacaoParada(db, opId);
  await concluir(db, usuarioId, planoAparelho(op));
}

export async function descartarPendencia(opId: string): Promise<void> {
  const { db, usuarioId } = await contexto();
  const { fila, op } = await operacaoParada(db, opId);
  await concluir(db, usuarioId, planoDescartar(fila, await lerFotos(db), op));
}

type DadosEdicao = Partial<ColoniaInput> | Partial<AvaliacaoInput> | Partial<Omit<ProducaoInput, "coloniaId">>;

// Salvar o formulário aberto por "Editar manualmente". Valida como uma escrita
// offline (story 4) e substitui a operação parada. Um create recusado continua
// create (o registro ainda não existe no servidor), com os dados juntados.
export async function substituirPendencia(opId: string, dados: DadosEdicao): Promise<{ id: string }> {
  const { db, usuarioId } = await contexto();
  const { fila, op } = await operacaoParada(db, opId);
  if (op.operacao === "delete") throw new ErroApi(409, "Uma exclusão recusada não pode ser editada; descarte-a.");
  const agora = new Date().toISOString();
  const store = STORE_DO_TIPO[op.tipo];
  const linha = (await db.get(store, op.entidadeId)) as LinhaLocal | undefined;
  if (!linha) throw new ErroApi(404, "O registro desta pendência não está mais na cópia local.");

  const criacao = op.operacao === "create";
  let dadosFinais = (criacao ? { ...op.dados, ...dados } : dados) as Record<string, unknown>;
  // Conflito: o formulário traz todos os campos, preenchidos com a versão do
  // aparelho. Vão só os que diferem do servidor e que o usuário mudou (em relação
  // à base) ou que estavam em conflito; o resto fica como o servidor tem.
  if (!criacao && op.servidor) {
    const emConflito = new Set((op.conflitos ?? []).map((c) => c.campo));
    const doServidor = op.servidor as Record<string, unknown>;
    const base = op.base as Record<string, unknown> | undefined;
    dadosFinais = Object.fromEntries(
      Object.entries(dadosFinais).filter(
        ([campo, valor]) =>
          valor !== undefined &&
          !iguais(campo, valor, doServidor[campo]) &&
          (!base || emConflito.has(campo) || !iguais(campo, valor, base[campo]))
      )
    );
    // Tudo igual ao servidor: é o mesmo que escolher a versão dele.
    if (Object.keys(dadosFinais).length === 0) {
      await concluir(db, usuarioId, planoServidor(fila, op));
      return { id: op.entidadeId };
    }
  }
  // Sem a parada (e as seguintes) no caminho: a validação olha o registro como ficará.
  const outrasColonias = (await db.getAll("colonias")).filter((c) => c.id !== op.entidadeId || !criacao);
  let gravar: LinhaLocal;
  if (op.tipo === "colonia") {
    const [especies, colonias] = [await db.getAll("especies"), outrasColonias];
    if (criacao) {
      const especieId = validarNovaColonia(op.entidadeId, dadosFinais as unknown as ColoniaInput, colonias);
      gravar = novaColonia(op.entidadeId, { ...(dadosFinais as unknown as ColoniaInput), especieId }, { userId: usuarioId, especies, colonias, agora });
    } else {
      validarEdicaoColonia(linha as never, dadosFinais as Partial<ColoniaInput>, colonias);
      gravar = atualizarColonia(linha as never, dadosFinais as Partial<ColoniaInput>, { userId: usuarioId, especies, colonias, agora });
    }
  } else if (op.tipo === "avaliacao") {
    const parametros = await db.getAll("parametros");
    if (criacao) {
      validarNovaAvaliacao(op.coloniaId!, dadosFinais as unknown as AvaliacaoInput, await db.getAll("colonias"), parametros);
      gravar = novaAvaliacao(op.entidadeId, op.coloniaId!, dadosFinais as unknown as AvaliacaoInput, agora, novoId);
    } else {
      validarEdicaoAvaliacao(linha as never, dadosFinais as Partial<AvaliacaoInput>, parametros, new Date(agora));
      gravar = atualizarAvaliacao(linha as never, dadosFinais as Partial<AvaliacaoInput>, agora, novoId);
    }
  } else {
    gravar = criacao
      ? novaProducao(op.entidadeId, dadosFinais as unknown as ProducaoInput, agora)
      : atualizarProducao(linha as never, dadosFinais as Partial<ProducaoInput>);
  }

  const servidor = op.servidor as { updatedAt?: string } | undefined;
  const { servidor: _s, conflitos: _c, ultimoErro: _e, ordem: _o, ...resto } = op;
  const nova: Omit<OperacaoFila, "ordem"> = {
    ...resto,
    id: novoId(),
    dados: dadosFinais,
    relacionadas: relacionadasDe(op.tipo, dadosFinais, op.coloniaId),
    criadoEm: agora,
    estado: "pendente",
    tentativas: 0,
    ...(!criacao && servidor?.updatedAt && { baseUpdatedAt: servidor.updatedAt }),
    ...(!criacao && op.servidor !== undefined && { base: linhaDoServidor(op.tipo, op.servidor) }),
  };
  await concluir(db, usuarioId, planoSubstituir(fila, op, nova, { store, gravar }));
  return { id: op.entidadeId };
}

