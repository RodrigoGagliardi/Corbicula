import { useAuth } from "../../store/auth";
import type { Usuario } from "../../types/api";
import type { DependenciasSegundoPlano } from "./segundoPlano";
import { espelharSessao, lerSessaoEspelhada } from "./sessaoSegundoPlano";
import { cancelarNovaTentativa, falhaTransitoria, sincronizar } from "./sincronizacao";

// Ligações do evento `sync` do Service Worker (sw.ts) com o ciclo do app.
// Ficam fora do sw.ts para serem testadas com o ciclo real.
export function dependenciasDoServiceWorker(haJanelaAberta: () => Promise<boolean>): DependenciasSegundoPlano {
  return {
    lerSessao: lerSessaoEspelhada,
    haJanelaAberta,
    // O ciclo só usa o id do usuário e o token; o resto do perfil não vem para o SW.
    assumirSessao: ({ usuarioId, token }) => useAuth.setState({ token, usuario: { id: usuarioId } as Usuario }),
    sincronizar: async (usuarioId) => {
      const tokenUsado = useAuth.getState().token;
      const resultado = await sincronizar(usuarioId);
      // 401 no SW: o client.ts encerra só a sessão em memória (o main.tsx não roda
      // aqui). A cópia com o token recusado sai, se ainda for a mesma, para os
      // próximos eventos não repetirem o 401; o app grava outra no novo login.
      if (!useAuth.getState().token && (await lerSessaoEspelhada())?.token === tokenUsado) await espelharSessao(null);
      return { falhaTransitoria: falhaTransitoria(resultado) };
    },
    cancelarNovaTentativa,
  };
}
