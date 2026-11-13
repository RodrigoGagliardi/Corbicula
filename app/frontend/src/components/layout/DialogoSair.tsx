import { CloudUpload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, type NavigateFunction } from "react-router";
import { create } from "zustand";
import { useOnline } from "../../hooks/useOnline";
import { apagarDadosLocais, pendenciasDoAparelho, type PendenciasDoAparelho } from "../../services/offline/sessao";
import { sincronizar } from "../../services/offline/sincronizacao";
import { useAuth } from "../../store/auth";
import { Botao, classesBotao } from "../ui/Botao";

// Logout (CAP-9). Sem pendências, apaga os dados locais do usuário e sai. Com
// pendências (fila ou fotos guardadas), abre o aviso com as opções: sincronizar
// agora (online), cancelar ou sair descartando. Expiração do token (401) não
// passa por aqui.

const useDialogoSair = create<{ pendencias: PendenciasDoAparelho | null }>()(() => ({ pendencias: null }));

// Sessão encerrada por outro caminho (401) com o aviso aberto: o aviso não
// reaparece para a próxima conta.
useAuth.subscribe((atual, anterior) => {
  if (atual.usuario?.id !== anterior.usuario?.id) useDialogoSair.setState({ pendencias: null });
});

// A sessão termina antes de apagar: as etapas de uma sincronização em andamento
// checam a sessão e param, sem reabrir (e recriar) o banco apagado.
async function sairDeVez(usuarioId: string, navegar: NavigateFunction) {
  useDialogoSair.setState({ pendencias: null });
  useAuth.getState().sair();
  navegar("/login", { replace: true });
  await apagarDadosLocais(usuarioId);
}

export function useSair() {
  const navegar = useNavigate();
  return async () => {
    const usuarioId = useAuth.getState().usuario?.id;
    if (!usuarioId) {
      useAuth.getState().sair();
      navegar("/login", { replace: true });
      return;
    }
    const pendencias = await pendenciasDoAparelho(usuarioId);
    if (pendencias.operacoes + pendencias.fotos === 0) await sairDeVez(usuarioId, navegar);
    else useDialogoSair.setState({ pendencias });
  };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function descreverPendencias({ operacoes, fotos }: PendenciasDoAparelho): string {
  const partes = [operacoes > 0 && plural(operacoes, "mudança", "mudanças"), fotos > 0 && plural(fotos, "foto", "fotos")].filter(Boolean);
  return partes.join(" e ");
}

export function DialogoSair() {
  const pendencias = useDialogoSair((s) => s.pendencias);
  const usuarioId = useAuth((s) => s.usuario?.id);
  const online = useOnline();
  const navegar = useNavigate();
  const [ocupado, setOcupado] = useState<"sincronizando" | "saindo" | null>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const fechar = () => useDialogoSair.setState({ pendencias: null });

  useEffect(() => {
    if (!pendencias) return;
    cancelar.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [pendencias]);

  if (!pendencias || !usuarioId) return null;
  const descricao = descreverPendencias(pendencias);
  // As paradas esperam uma decisão: sincronizar não as envia.
  const enviaveis = pendencias.operacoes - pendencias.decisoes + pendencias.fotos;

  const sincronizarESair = async () => {
    setOcupado("sincronizando");
    try {
      await sincronizar(usuarioId);
      const restantes = await pendenciasDoAparelho(usuarioId);
      if (restantes.operacoes + restantes.fotos === 0) await sairDeVez(usuarioId, navegar);
      else useDialogoSair.setState({ pendencias: restantes });
    } finally {
      setOcupado(null);
    }
  };

  const descartarESair = async () => {
    if (!window.confirm(`Sair e descartar ${descricao}? Elas não chegaram ao servidor e serão perdidas.`)) return;
    setOcupado("saindo");
    try {
      await sairDeVez(usuarioId, navegar);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center" onClick={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-sair"
        aria-describedby="texto-sair"
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 text-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titulo-sair" className="flex items-center gap-2 font-display text-lg font-semibold">
          <CloudUpload className="size-5" aria-hidden /> Há dados que não chegaram ao servidor
        </h2>
        <p id="texto-sair" className="text-sm">
          Este aparelho tem {descricao} ainda não {pendencias.operacoes + pendencias.fotos === 1 ? "enviada" : "enviadas"}. Ao sair,
          os dados guardados aqui são apagados.
          {!online && " Sem conexão agora: para não perder nada, cancele e saia quando a conexão voltar."}
        </p>
        {pendencias.decisoes > 0 && (
          <p className="text-sm">
            {pendencias.decisoes === 1 ? "1 mudança espera" : `${pendencias.decisoes} mudanças esperam`} uma decisão sua e não{" "}
            {pendencias.decisoes === 1 ? "sobe" : "sobem"} ao sincronizar:{" "}
            <Link to="/app/configuracoes/sync" onClick={fechar} className="font-medium underline decoration-accent decoration-2 underline-offset-2">
              resolver em Sincronização
            </Link>
            .
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button ref={cancelar} type="button" className={classesBotao("secundario", "sm")} onClick={fechar} disabled={ocupado !== null}>
            Cancelar
          </button>
          {online && enviaveis > 0 && (
            <Botao variante="primario" tamanho="sm" carregando={ocupado === "sincronizando"} disabled={ocupado !== null} onClick={() => void sincronizarESair()}>
              Sincronizar agora
            </Botao>
          )}
          <Botao variante="perigo" tamanho="sm" carregando={ocupado === "saindo"} disabled={ocupado !== null} onClick={() => void descartarESair()}>
            Sair e descartar
          </Botao>
        </div>
      </div>
    </div>
  );
}
