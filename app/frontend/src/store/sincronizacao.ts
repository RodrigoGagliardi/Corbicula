import { create } from "zustand";

// Estado observável da sincronização (não persistido: o que importa fica no IndexedDB).
// Quem escreve é services/offline/sincronizacao.ts; telas e layout só leem.
interface EstadoSincronizacao {
  // Há um ciclo de envio + pull em andamento.
  sincronizando: boolean;
  // Operações na fila do usuário da sessão (pendentes e paradas).
  naFila: number;
  // Incrementado quando uma sincronização muda dados (algo enviado ou trazido
  // pelo pull): o main.tsx invalida as queries para as telas relerem.
  concluidas: number;
}

export const useSincronizacao = create<EstadoSincronizacao>()(() => ({
  sincronizando: false,
  naFila: 0,
  concluidas: 0,
}));
