import { create } from "zustand";

// Estado observável da sincronização (não persistido: o que importa fica no IndexedDB).
// Quem escreve é services/offline/sincronizacao.ts; telas e layout só leem.
interface EstadoSincronizacao {
  // Há um ciclo de envio + pull em andamento.
  sincronizando: boolean;
  // Operações na fila do usuário da sessão (pendentes e paradas).
  naFila: number;
  // Fotos guardadas offline esperando envio.
  fotosPendentes: number;
  // Operações paradas esperando decisão do usuário (conflito ou recusa).
  decisoes: number;
  // Itens enviados / total do ciclo em andamento (operações e fotos); null fora de um ciclo.
  progresso: { feitas: number; total: number } | null;
  // A última tentativa falhou por rede ou servidor com o navegador online.
  servidorInacessivel: boolean;
  // Quando o último pull bem-sucedido foi aplicado (meta.ultimoPull).
  ultimaSincronizacao: string | null;
  // Incrementado quando uma sincronização muda dados (algo enviado ou trazido
  // pelo pull): o main.tsx invalida as queries para as telas relerem.
  concluidas: number;
}

const INICIAL: EstadoSincronizacao = {
  sincronizando: false,
  naFila: 0,
  fotosPendentes: 0,
  decisoes: 0,
  progresso: null,
  servidorInacessivel: false,
  ultimaSincronizacao: null,
  concluidas: 0,
};

export const useSincronizacao = create<EstadoSincronizacao>()(() => ({
  sincronizando: false,
  naFila: 0,
  fotosPendentes: 0,
  decisoes: 0,
  progresso: null,
  servidorInacessivel: false,
  ultimaSincronizacao: null,
  concluidas: 0,
}));

// Zera tudo (logout, troca de usuário): os números da conta anterior não aparecem
// para a próxima. `concluidas` continua crescendo, para a invalidação das telas.
export function resetarSincronizacao(): void {
  useSincronizacao.setState((s) => ({ ...INICIAL, concluidas: s.concluidas }));
}
