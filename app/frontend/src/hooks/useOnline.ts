import { useSyncExternalStore } from "react";

function assinar(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// Estado de conexão do navegador (navigator.onLine), reativo.
export function useOnline(): boolean {
  return useSyncExternalStore(assinar, () => navigator.onLine, () => true);
}
