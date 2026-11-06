import { useEffect, useRef } from "react";
import { pedirArmazenamentoPersistente, puxarAlteracoes } from "../services/offline/sincronizacao";
import { useAuth } from "../store/auth";
import { useOnline } from "./useOnline";

// Ao abrir o app logado (e após o login), atualiza o banco local com o pull
// incremental e pede armazenamento persistente. Não bloqueia a renderização nem
// mostra erro.
//  - O usuário só conta como carregado quando o pull dá `ok`; se falhar, há nova
//    tentativa na próxima vez que o app ficar online ou o layout remontar.
//  - Ao voltar para o app (aba visível de novo), online e logado, puxa outra vez:
//    retenta falhas com a rede ligada (5xx, backend subindo) e traz o que mudou
//    em outro dispositivo.
//  - Disparos repetidos (StrictMode, reconexão durante um pull) caem na mesma
//    request, pela deduplicação de `puxarAlteracoes`.
//  - A persistência é pedida uma vez por usuário a cada montagem.
export function useCargaLocal(): void {
  const usuarioId = useAuth((s) => s.usuario?.id);
  const online = useOnline();
  const carregado = useRef<string | null>(null);
  const persistenciaPedida = useRef<string | null>(null);

  useEffect(() => {
    if (!usuarioId || !online) return;

    if (persistenciaPedida.current !== usuarioId) {
      persistenciaPedida.current = usuarioId;
      void pedirArmazenamentoPersistente(usuarioId);
    }

    const puxar = () =>
      void puxarAlteracoes(usuarioId).then((resultado) => {
        if (resultado.ok) carregado.current = usuarioId;
      });
    const aoVoltar = () => {
      if (document.visibilityState === "visible") puxar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    if (carregado.current !== usuarioId) puxar();
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [usuarioId, online]);
}
