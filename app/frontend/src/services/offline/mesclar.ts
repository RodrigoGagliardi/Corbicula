import { TIPOS_PULL, type IdsPorTipo, type LinhasPull, type RespostaAlteracoes } from "./tipos";

// O que um pull muda no banco local, por store.
export interface PlanoPull {
  gravar: LinhasPull;
  remover: IdsPorTipo;
  // Próximo `desde`: sempre o `servidorEm` da resposta, nunca o relógio do cliente.
  desde: string;
}

// Regra do pull (função pura, sem IndexedDB):
//  - registros recebidos são gravados por id (substituem a cópia local);
//  - ids locais que sumiram de `idsAtuais` foram excluídos no servidor e saem do banco;
//  - um id com mudança local pendente nunca é sobrescrito nem removido — a fila de
//    operações offline ainda vai enviá-lo, e uma entidade criada offline não está em
//    `idsAtuais` até ser sincronizada.
// Os ids pendentes valem para todos os tipos (são UUIDs, não colidem entre stores).
export function mesclar(
  resposta: RespostaAlteracoes,
  idsLocais: IdsPorTipo,
  pendentes: ReadonlySet<string> = new Set()
): PlanoPull {
  const semPendencia = <T extends { id: string }>(linhas: T[]) => linhas.filter((l) => !pendentes.has(l.id));

  const remover = {} as IdsPorTipo;
  for (const tipo of TIPOS_PULL) {
    const atuais = new Set(resposta.idsAtuais[tipo]);
    remover[tipo] = idsLocais[tipo].filter((id) => !atuais.has(id) && !pendentes.has(id));
  }

  return {
    gravar: {
      colonias: semPendencia(resposta.colonias),
      avaliacoes: semPendencia(resposta.avaliacoes),
      producoes: semPendencia(resposta.producoes),
      parametros: semPendencia(resposta.parametros),
    },
    remover,
    desde: resposta.servidorEm,
  };
}
