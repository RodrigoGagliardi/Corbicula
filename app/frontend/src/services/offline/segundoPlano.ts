import type { SessaoSegundoPlano } from "./sessaoSegundoPlano";

// Background Sync (melhoria progressiva, CAP-5). Onde o navegador oferece
// (Chromium/Android), uma pendência criada pede uma sincronização em segundo
// plano; quando a rede volta, mesmo com o app fechado, o Service Worker (sw.ts)
// roda o mesmo ciclo do app. Nos demais navegadores, nada é registrado.

export const TAG_SINCRONIZACAO = "corbicula-sincronizar";

interface RegistroComSync {
  sync?: { register(tag: string): Promise<void> };
}

// Pede ao navegador um evento `sync` quando houver rede. Registrar a mesma tag
// de novo não duplica. Sem suporte ou sem Service Worker registrado (ex.: modo
// dev), não faz nada. Nunca lança.
export async function pedirSincronizacaoEmSegundoPlano(): Promise<void> {
  try {
    if (typeof window === "undefined" || !("SyncManager" in window)) return;
    if (!("serviceWorker" in navigator)) return;
    // getRegistration, e não `ready`: sem SW registrado, `ready` nunca resolve.
    const registro = (await navigator.serviceWorker.getRegistration()) as (ServiceWorkerRegistration & RegistroComSync) | undefined;
    await registro?.sync?.register(TAG_SINCRONIZACAO);
  } catch {
    // Permissão negada ou navegador sem suporte: o app sincroniza quando abrir.
  }
}

export type DesfechoSegundoPlano = "sem-sessao" | "sincronizado";

export interface DependenciasSegundoPlano {
  lerSessao: () => Promise<SessaoSegundoPlano | null>;
  haJanelaAberta: () => Promise<boolean>;
  // Coloca a sessão espelhada no estado de sessão do contexto do SW.
  assumirSessao: (sessao: SessaoSegundoPlano) => void;
  // Ciclo do app (`sincronizar`); devolve se terminou com falha transitória.
  sincronizar: (usuarioId: string) => Promise<{ falhaTransitoria: boolean }>;
  // A nova tentativa por setTimeout do ciclo não serve no SW: quem tenta de novo é o navegador.
  cancelarNovaTentativa: (usuarioId: string) => void;
}

// Corpo do evento `sync` do Service Worker. Rejeita (o navegador tenta de novo
// mais tarde) com uma janela do app aberta e em falha transitória (rede, timeout,
// 5xx); 401, sessão ausente e recusas encerram. Nunca apaga a fila.
export async function sincronizarEmSegundoPlano(d: DependenciasSegundoPlano): Promise<DesfechoSegundoPlano> {
  // Com o app aberto, ele mesmo sincroniza. Rejeitar, e não resolver, mantém o
  // registro: online, o navegador dispara o evento na hora, e se o app fechar
  // antes da nova tentativa dele, a próxima tentativa do navegador cobre.
  if (await d.haJanelaAberta()) throw new Error("App aberto: ele mesmo sincroniza; o navegador tentará de novo.");
  const sessao = await d.lerSessao();
  if (!sessao) return "sem-sessao";
  d.assumirSessao(sessao);
  const resultado = await d.sincronizar(sessao.usuarioId);
  d.cancelarNovaTentativa(sessao.usuarioId);
  if (resultado.falhaTransitoria) throw new Error("Sincronização em segundo plano interrompida; o navegador tentará de novo.");
  return "sincronizado";
}
