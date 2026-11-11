import type { LinhaLocal, OperacaoFila } from "./tipos";

// Junção por campos de um update que voltou do /sync como `conflito` (função pura).
// Para cada campo enviado, compara a base (linha local antes da edição), a versão
// local (o que a operação envia) e a do servidor (devolvida no conflito):
//  - mudou só no aparelho → vai a local;
//  - mudou só no servidor → fica a do servidor (o campo sai da operação);
//  - mudou nos dois para o mesmo valor → não é conflito (ex.: update que expirou
//    depois de aplicado);
//  - mudou nos dois para valores diferentes → decisão do usuário.
// A lista de parâmetros da avaliação, `motivosAcoes`, `dimensoesCaixa`,
// `acoesTomadas` e `caracteristicas` contam como um campo cada (sem junção
// dentro do campo). Datas comparam pelo instante.

export interface CampoConflito {
  campo: string;
  local: unknown;
  servidor: unknown;
}

export type ResultadoJuncao =
  // Reenviar só estes campos sobre a versão do servidor.
  | { tipo: "juntada"; dados: Record<string, unknown>; baseUpdatedAt: string }
  // O servidor já tem tudo o que a operação mandaria: sai da fila.
  | { tipo: "resolvida" }
  | { tipo: "decisao"; campos: CampoConflito[] };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

type Parametro = { parametroId: string; classificacao: string; observacoes?: string | null };

// Ordena as chaves para comparar objetos pelo conteúdo.
function estavel(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(estavel);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((k) => [k, estavel((valor as Record<string, unknown>)[k])])
    );
  }
  return valor;
}

// Forma comparável de um valor de campo.
export function normalizar(campo: string, valor: unknown): string {
  if (valor === undefined || valor === null || valor === "") return "null";
  if (campo === "parametros" && Array.isArray(valor)) {
    // Linhas locais, payload do formulário e versão REST têm parametroId/classificacao/observacoes.
    const lista = (valor as Parametro[])
      .map((p) => [p.parametroId, p.classificacao, p.observacoes || null] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return JSON.stringify(lista);
  }
  if (typeof valor === "string" && ISO.test(valor)) {
    const t = Date.parse(valor);
    if (!Number.isNaN(t)) return `t:${t}`;
  }
  if (typeof valor === "object") {
    // Objeto vazio conta como ausente (ex.: motivosAcoes {} = nada registrado).
    if (!Array.isArray(valor) && Object.keys(valor).length === 0) return "null";
    return JSON.stringify(estavel(valor));
  }
  return JSON.stringify(valor);
}

export const iguais = (campo: string, a: unknown, b: unknown) => normalizar(campo, a) === normalizar(campo, b);

const ler = (fonte: unknown, campo: string) => (fonte as Record<string, unknown> | undefined)?.[campo];

export function juntar(op: Pick<OperacaoFila, "dados" | "base" | "servidor">): ResultadoJuncao {
  const servidor = op.servidor as { updatedAt?: string } | undefined;
  const base: LinhaLocal | undefined = op.base;
  const dados: Record<string, unknown> = {};
  const campos: CampoConflito[] = [];

  for (const [campo, local] of Object.entries(op.dados)) {
    if (local === undefined) continue;
    const doServidor = ler(servidor, campo);
    if (iguais(campo, local, doServidor)) continue; // o servidor já tem esse valor
    // Sem base, não dá para saber quem mudou: cada diferença vai ao usuário.
    const mudouNoAparelho = !base || !iguais(campo, local, ler(base, campo));
    const mudouNoServidor = !base || !iguais(campo, doServidor, ler(base, campo));
    if (mudouNoAparelho && mudouNoServidor) campos.push({ campo, local, servidor: doServidor });
    else if (mudouNoAparelho) dados[campo] = local;
  }

  if (campos.length > 0) return { tipo: "decisao", campos };
  if (Object.keys(dados).length === 0) return { tipo: "resolvida" };
  // Sem o updatedAt do servidor não há base para o reenvio (iria sem checagem de
  // conflito): o usuário decide.
  if (!servidor?.updatedAt) {
    return { tipo: "decisao", campos: Object.entries(dados).map(([campo, local]) => ({ campo, local, servidor: ler(servidor, campo) })) };
  }
  return { tipo: "juntada", dados, baseUpdatedAt: servidor.updatedAt };
}

// Campos que a operação mudou em relação à base (o que o aparelho alterou). Os
// formulários enviam todos os campos; reenviar os não alterados por cima da versão
// do servidor desfaria, em silêncio, mudanças feitas lá. Sem base: todos.
export function camposDoAparelho(op: Pick<OperacaoFila, "dados" | "base">): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [campo, local] of Object.entries(op.dados)) {
    if (local === undefined) continue;
    if (!op.base || !iguais(campo, local, ler(op.base, campo))) saida[campo] = local;
  }
  return saida;
}
