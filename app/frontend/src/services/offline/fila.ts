import type {
  AcaoOperacao,
  LinhaLocal,
  OperacaoFila,
  OperacaoSync,
  ResultadoOperacaoSync,
  TipoOperacao,
} from "./tipos";

// Regras da fila de operações offline (funções puras, sem IndexedDB).
// Ciclo de uma operação em _bmad-output/specs/spec-pwa-offline/fluxo-sincronizacao.md.

// O POST /sync aceita até 500 operações por lote.
export const MAX_LOTE = 500;

const texto = (v: unknown): v is string => typeof v === "string" && v.length > 0;

// Colônias que uma escrita referencia além da própria entidade: a colônia da
// avaliação/colheita e, numa colônia, a mãe e a doadora de campeiras.
export function relacionadasDe(tipo: TipoOperacao, dados: Record<string, unknown>, coloniaId?: string): string[] {
  const ids =
    tipo === "colonia" ? [dados.coloniaMaeId, dados.coloniaDoadoraCampeirasId] : [coloniaId ?? dados.coloniaId];
  return [...new Set(ids.filter(texto))];
}

// Há operação na fila (em qualquer estado) ligada a alguma destas entidades, nos
// dois sentidos: a operação é de uma delas, ou referencia uma delas (ex.: excluir
// online uma colônia cuja avaliação ainda está na fila)? Nesse caso a escrita
// nova também vai para a fila, depois delas.
export const temPendenciaRelacionada = (fila: readonly OperacaoFila[], ids: readonly string[]) =>
  fila.some((op) => ids.includes(op.entidadeId) || op.relacionadas.some((id) => ids.includes(id)));

// Só a primeira operação de uma entidade na fila leva a versão editada
// (`baseUpdatedAt`). As seguintes vão sem: levar a mesma base faria a segunda
// entrar em conflito com a primeira, aplicada antes no servidor. Se a primeira
// parar (conflito ou erro), as seguintes ficam bloqueadas (`proximoLote`).
export function baseParaUpdate(fila: readonly OperacaoFila[], entidadeId: string, updatedAt: string | undefined) {
  return fila.some((op) => op.entidadeId === entidadeId) ? undefined : updatedAt;
}

export interface NovaOperacao {
  id: string;
  tipo: TipoOperacao;
  operacao: AcaoOperacao;
  entidadeId: string;
  coloniaId?: string;
  dados: Record<string, unknown>;
  criadoEm: string;
  // `updatedAt` da versão que o usuário editou (só update).
  updatedAtEditado?: string;
  // Linha local antes do update.
  base?: LinhaLocal;
}

// Operação pronta para gravar (sem a `ordem`, dada pelo banco na gravação).
export function montarOperacao(fila: readonly OperacaoFila[], nova: NovaOperacao): Omit<OperacaoFila, "ordem"> {
  const baseUpdatedAt =
    nova.operacao === "update" ? baseParaUpdate(fila, nova.entidadeId, nova.updatedAtEditado) : undefined;
  return {
    id: nova.id,
    tipo: nova.tipo,
    operacao: nova.operacao,
    entidadeId: nova.entidadeId,
    ...(nova.coloniaId && { coloniaId: nova.coloniaId }),
    dados: nova.dados,
    ...(baseUpdatedAt && { baseUpdatedAt }),
    criadoEm: nova.criadoEm,
    estado: "pendente",
    tentativas: 0,
    relacionadas: relacionadasDe(nova.tipo, nova.dados, nova.coloniaId),
    ...(nova.operacao === "update" && nova.base && { base: nova.base }),
  };
}

const porOrdem = (fila: readonly OperacaoFila[]) => [...fila].sort((a, b) => a.ordem - b.ordem);

// Próximas operações a enviar, na ordem em que foram feitas.
//  - Uma operação parada (conflito/erro) bloqueia as seguintes da mesma entidade
//    e as que referenciam essa entidade (ex.: avaliação de uma colônia cujo create
//    foi recusado); uma operação bloqueada bloqueia, por sua vez, as que dependem dela.
//  - O lote termina antes de uma operação que referencia uma entidade criada no
//    próprio lote: ela só vai depois que o servidor responder ao create (se ele for
//    recusado, a dependente fica bloqueada em vez de voltar como "não encontrada").
export function proximoLote(fila: readonly OperacaoFila[], max = MAX_LOTE): OperacaoFila[] {
  const bloqueadas = new Set<string>();
  const criadasNoLote = new Set<string>();
  const lote: OperacaoFila[] = [];
  for (const op of porOrdem(fila)) {
    if (lote.length >= max) break;
    const chaves = [op.entidadeId, ...op.relacionadas];
    if (op.estado !== "pendente" || chaves.some((id) => bloqueadas.has(id))) {
      bloqueadas.add(op.entidadeId);
      continue;
    }
    if (op.relacionadas.some((id) => criadasNoLote.has(id))) break;
    lote.push(op);
    if (op.operacao === "create") criadasNoLote.add(op.entidadeId);
  }
  return lote;
}

// Formato do POST /sync (sem os campos de controle local).
export function paraEnvio(op: OperacaoFila): OperacaoSync {
  return {
    id: op.id,
    tipo: op.tipo,
    operacao: op.operacao,
    entidadeId: op.entidadeId,
    ...(op.coloniaId && { coloniaId: op.coloniaId }),
    dados: op.dados,
    ...(op.baseUpdatedAt && { baseUpdatedAt: op.baseUpdatedAt }),
    criadoEm: op.criadoEm,
  };
}

export interface MudancasFila {
  remover: string[];
  atualizar: OperacaoFila[];
}

// Resultado do servidor → mudanças na fila. `aplicado` e `duplicado` saem;
// `conflito` e `erro` ficam parados, com a versão do servidor ou a mensagem.
// Operação enviada sem resultado na resposta continua pendente.
export function aplicarResultados(lote: readonly OperacaoFila[], resultados: readonly ResultadoOperacaoSync[]): MudancasFila {
  const porId = new Map(resultados.map((r) => [r.id, r]));
  const mudancas: MudancasFila = { remover: [], atualizar: [] };
  for (const op of lote) {
    const r = porId.get(op.id);
    if (!r) continue;
    if (r.status === "aplicado" || r.status === "duplicado") {
      mudancas.remover.push(op.id);
      continue;
    }
    mudancas.atualizar.push({
      ...op,
      estado: r.status,
      tentativas: op.tentativas + 1,
      ultimoErro: r.erro ?? (r.status === "conflito" ? "Conflito com a versão do servidor." : "Recusada pelo servidor."),
      ...(r.status === "conflito" && { servidor: r.servidor }),
    });
  }
  return mudancas;
}
