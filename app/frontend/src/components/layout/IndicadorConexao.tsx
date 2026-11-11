import { CloudOff, RefreshCw, TriangleAlert, Wifi, WifiOff } from "lucide-react";
import { Link } from "react-router";
import { useOnline } from "../../hooks/useOnline";
import { sincronizar } from "../../services/offline/sincronizacao";
import { useAuth } from "../../store/auth";
import { useSincronizacao } from "../../store/sincronizacao";

// Status da conexão e da sincronização (sidebar e barra superior do mobile):
//  - Offline, Servidor inacessível, Sincronizando (com o progresso) ou Online;
//  - quantas mudanças e fotos ainda não chegaram ao servidor;
//  - atalho para as decisões pendentes (tela de Sincronização).
// Online, o status é também o botão "Sincronizar agora".

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function IndicadorConexao({ compacto = false, className = "" }: { compacto?: boolean; className?: string }) {
  const online = useOnline();
  const usuarioId = useAuth((s) => s.usuario?.id);
  const sincronizando = useSincronizacao((s) => s.sincronizando);
  const progresso = useSincronizacao((s) => s.progresso);
  const servidorInacessivel = useSincronizacao((s) => s.servidorInacessivel);
  const naFila = useSincronizacao((s) => s.naFila);
  const fotosPendentes = useSincronizacao((s) => s.fotosPendentes);
  const decisoes = useSincronizacao((s) => s.decisoes);

  // As paradas aparecem no atalho das decisões, não no contador de envio.
  const naoEnviados = Math.max(0, naFila - decisoes) + fotosPendentes;
  const estado = !online
    ? "Offline"
    : sincronizando
      ? progresso
        ? `Sincronizando ${progresso.feitas}/${progresso.total}`
        : "Sincronizando"
      : servidorInacessivel
        ? "Servidor inacessível"
        : "Online";
  const Icone = !online ? WifiOff : sincronizando ? RefreshCw : servidorInacessivel ? CloudOff : Wifi;
  const resumo = naoEnviados > 0 ? `${estado} · ${plural(naoEnviados, "não enviado", "não enviados")}` : estado;
  const titulo = !online
    ? "Sem conexão — o que você salvar fica no aparelho e é enviado quando a conexão voltar"
    : servidorInacessivel && !sincronizando
      ? "O servidor não respondeu — toque para tentar de novo"
      : sincronizando
        ? "Sincronizando…"
        : "Conectado — toque para sincronizar agora";

  const conteudo = (
    <>
      <span className="relative">
        <Icone className={`size-4 shrink-0 ${sincronizando ? "animate-spin" : ""}`} aria-hidden />
        {compacto && naoEnviados > 0 && (
          <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-accent-foreground">
            {naoEnviados}
          </span>
        )}
      </span>
      {compacto ? <span className="sr-only">{resumo}</span> : resumo}
    </>
  );

  const status =
    online && usuarioId ? (
      <button
        type="button"
        onClick={() => void sincronizar(usuarioId)}
        disabled={sincronizando}
        className="inline-flex items-center gap-1.5 rounded-md text-left text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait"
        title={titulo}
        aria-label={sincronizando ? resumo : `${resumo}. Sincronizar agora`}
      >
        {conteudo}
      </button>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium" role="status" title={titulo}>
        {conteudo}
      </span>
    );

  return (
    <div className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      {status}
      {decisoes > 0 && (
        <Link
          to="/app/configuracoes/sync"
          className="inline-flex items-center gap-1 rounded-md text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          title="Mudanças que esperam uma decisão sua"
          aria-label={plural(decisoes, "pendência de decisão", "pendências de decisão")}
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {compacto ? <span aria-hidden>{decisoes}</span> : plural(decisoes, "decisão", "decisões")}
        </Link>
      )}
    </div>
  );
}
