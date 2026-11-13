import { useQuery } from "@tanstack/react-query";
import { estadoDosRegistros } from "../services/offline/decisoes";
import { useAuth } from "../store/auth";
import { useSincronizacao } from "../store/sincronizacao";

// Registros com mudança ou foto ainda não enviada ao servidor ("pendente") ou
// parada esperando decisão ("parada"). Relido quando os contadores mudam ou uma
// sincronização termina (e pelas invalidações de ["sincronizacao"]).
export function useRegistrosNaFila(): Map<string, "pendente" | "parada"> {
  const usuarioId = useAuth((s) => s.usuario?.id);
  const naFila = useSincronizacao((s) => s.naFila);
  const decisoes = useSincronizacao((s) => s.decisoes);
  const fotosPendentes = useSincronizacao((s) => s.fotosPendentes);
  const concluidas = useSincronizacao((s) => s.concluidas);
  const { data } = useQuery({
    queryKey: ["sincronizacao", "registros", usuarioId, naFila, decisoes, fotosPendentes, concluidas],
    queryFn: estadoDosRegistros,
    enabled: Boolean(usuarioId),
  });
  return data ?? VAZIO;
}

const VAZIO = new Map<string, "pendente" | "parada">();
