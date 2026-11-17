import { useEffect, useRef } from "react";
import { atualizarContagem, cancelarNovaTentativa, pedirArmazenamentoPersistente, sincronizar } from "../services/offline/sincronizacao";
import { useAuth } from "../store/auth";
import { useOnline } from "./useOnline";

// Ao abrir o app logado (e após o login), sincroniza o banco local: envia a fila
// de operações offline (POST /sync) e traz o pull incremental. Também pede
// armazenamento persistente. Não bloqueia a renderização nem mostra erro.
//  - O usuário só conta como carregado quando o pull dá `ok`; se falhar, há nova
//    tentativa na próxima vez que o app ficar online ou o layout remontar (e a
//    espera crescente de `sincronizar`, nas falhas transitórias).
//  - Ao voltar para o app (aba visível de novo), online e logado, sincroniza outra
//    vez: envia o que ficou pendente e traz o que mudou em outro dispositivo.
//  - Reconectar (offline → online) sempre sincroniza: a fila pode ter crescido.
//  - Disparos repetidos (StrictMode, reconexão durante um ciclo) caem no mesmo
//    ciclo, pela deduplicação de `sincronizar`.
//  - A persistência é pedida uma vez por usuário a cada montagem.
export function useCargaLocal(): void {
  const usuarioId = useAuth((s) => s.usuario?.id);
  const online = useOnline();
  const carregado = useRef<string | null>(null);
  const persistenciaPedida = useRef<string | null>(null);
  const estavaOffline = useRef(false);

  // Contador da fila, também offline (o app reabre com pendências).
  useEffect(() => {
    if (usuarioId) void atualizarContagem(usuarioId);
  }, [usuarioId]);

  useEffect(() => {
    if (!usuarioId) return;
    if (!online) {
      estavaOffline.current = true;
      // Sem rede, a nova tentativa agendada não adianta; o evento "online" volta a sincronizar.
      cancelarNovaTentativa(usuarioId);
      return;
    }

    if (persistenciaPedida.current !== usuarioId) {
      persistenciaPedida.current = usuarioId;
      void pedirArmazenamentoPersistente(usuarioId);
    }

    const sincronizarAgora = () =>
      void sincronizar(usuarioId).then((resultado) => {
        if (resultado.pull?.ok) carregado.current = usuarioId;
      });
    const aoVoltar = () => {
      if (document.visibilityState === "visible") sincronizarAgora();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    if (carregado.current !== usuarioId || estavaOffline.current) sincronizarAgora();
    estavaOffline.current = false;
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [usuarioId, online]);
}
