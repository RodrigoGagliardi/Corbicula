import { deleteDB } from "idb";
import { useAuth } from "../../store/auth";
import { resetarSincronizacao } from "../../store/sincronizacao";
import { abrirBanco, fecharBanco, indexedDbDisponivel, lerFila, lerFotos, nomeBanco } from "./banco";
import { aguardarSincronizacao, cancelarNovaTentativa } from "./sincronizacao";

// Fim da sessão pelo usuário (logout ou exclusão da conta). Expiração do token
// (401) não passa por aqui: a fila e a cópia local ficam para o próximo login do
// mesmo usuário.

export interface PendenciasDoAparelho {
  // Operações na fila (inclusive as paradas) e fotos guardadas (inclusive as recusadas).
  operacoes: number;
  fotos: number;
  // Das operações, as paradas esperando decisão (sincronizar não as envia).
  decisoes: number;
}

const NADA: PendenciasDoAparelho = { operacoes: 0, fotos: 0, decisoes: 0 };

// O que ainda não chegou ao servidor neste aparelho. Sem banco: nada.
export async function pendenciasDoAparelho(usuarioId: string): Promise<PendenciasDoAparelho> {
  if (!indexedDbDisponivel()) return NADA;
  try {
    const db = await abrirBanco(usuarioId);
    const [fila, fotos] = await Promise.all([lerFila(db), lerFotos(db)]);
    return { operacoes: fila.length, fotos: fotos.length, decisoes: fila.filter((o) => o.estado !== "pendente").length };
  } catch {
    return NADA;
  }
}

// Prazo para apagar o banco: outra aba presa nele não pode travar o logout.
export const PRAZO_APAGAR_MS = 5_000;

// Encerra a sessão (se ainda for deste usuário) e apaga o banco local dele
// (cópia, fila, fotos). A ordem importa: com a sessão encerrada e o ciclo em
// andamento terminado, nada mais abre o banco e o recria depois de apagado. O
// banco de outro usuário no mesmo aparelho não é tocado. Nunca lança.
export async function apagarDadosLocais(usuarioId: string): Promise<void> {
  cancelarNovaTentativa(usuarioId);
  if (useAuth.getState().usuario?.id === usuarioId) useAuth.getState().sair();
  await aguardarSincronizacao(usuarioId);
  resetarSincronizacao();
  if (!indexedDbDisponivel()) return;
  try {
    await fecharBanco(usuarioId);
    let prazo: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      deleteDB(nomeBanco(usuarioId)),
      new Promise((_, rejeitar) => {
        prazo = setTimeout(() => rejeitar(new Error("outra aba está usando o banco local")), PRAZO_APAGAR_MS);
      }),
    ]).finally(() => clearTimeout(prazo));
  } catch (erro) {
    console.error("Não foi possível apagar os dados locais:", erro);
  }
}
