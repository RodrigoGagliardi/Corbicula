import { clientsClaim } from "workbox-core";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { dependenciasDoServiceWorker } from "./services/offline/eventoSync";
import { sincronizarEmSegundoPlano, TAG_SINCRONIZACAO } from "./services/offline/segundoPlano";

// Service Worker do PWA (vite-plugin-pwa, estratégia injectManifest).
//  - App shell em cache: a interface abre offline.
//  - Fontes do Google guardadas no primeiro acesso.
//  - Background Sync (onde houver): com o app fechado, a fila e as fotos
//    guardadas sobem quando a rede volta, pelo mesmo ciclo do app.
// Os tipos do contexto do SW são declarados aqui: o tsconfig usa o lib DOM, e o
// Background Sync não está nos libs do TypeScript.

interface EventoSync extends Event {
  readonly tag: string;
  waitUntil(promessa: Promise<unknown>): void;
}

interface EscopoServiceWorker {
  __WB_MANIFEST: (string | PrecacheEntry)[];
  skipWaiting(): Promise<void>;
  clients: { matchAll(opcoes: { type: "window"; includeUncontrolled: boolean }): Promise<readonly unknown[]> };
  addEventListener(tipo: "sync", ouvinte: (evento: EventoSync) => void): void;
}

declare const self: EscopoServiceWorker;

// Atualização automática (registerType: "autoUpdate"): a versão nova assume na hora.
void self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

registerRoute(
  ({ url }) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url.href),
  new CacheFirst({
    cacheName: "fontes",
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

self.addEventListener("sync", (evento) => {
  if (evento.tag !== TAG_SINCRONIZACAO) return;
  evento.waitUntil(
    sincronizarEmSegundoPlano(
      dependenciasDoServiceWorker(async () => (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).length > 0)
    )
  );
});
