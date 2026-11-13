import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CloudUpload, HardDrive, RefreshCw, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { Botao, LinkBotao } from "../../components/ui/Botao";
import { CabecalhoPagina, Cartao, Selo } from "../../components/ui/Cartao";
import { Carregando, MensagemErro } from "../../components/ui/Estados";
import { useEspecies } from "../../hooks/useDados";
import { useOnline } from "../../hooks/useOnline";
import {
  descartarPendencia,
  listarFila,
  listarPendencias,
  manterAparelho,
  manterServidor,
  type Pendencia,
} from "../../services/offline/decisoes";
import { sincronizar } from "../../services/offline/sincronizacao";
import { useAuth } from "../../store/auth";
import { useSincronizacao } from "../../store/sincronizacao";
import { formatarDataHora, tempoRelativo } from "../../utils/format";
import { formatarValorCampo, rotuloCampo, type ContextoValores } from "../../utils/pendencias";
import { VoltarConfiguracoes } from "./Configuracoes";
import { abrirBanco, indexedDbDisponivel, lerMeta } from "../../services/offline/banco";

// Tela 35 — Sincronização (CAP-6, CAP-7, CAP-8): status e progresso, botão
// "Sincronizar agora", última sincronização, fila de envio, fotos aguardando,
// armazenamento do aparelho e as pendências que esperam decisão do usuário.

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// Nomes para os ids que aparecem nos valores (parâmetros, colônias, espécies).
function useNomes(): ContextoValores {
  const usuarioId = useAuth((s) => s.usuario?.id);
  const { data: especies } = useEspecies();
  const { data: nomes = {} } = useQuery({
    queryKey: ["sincronizacao", "nomes", usuarioId],
    enabled: Boolean(usuarioId) && indexedDbDisponivel(),
    queryFn: async () => {
      const db = await abrirBanco(usuarioId!);
      const [parametros, colonias] = await Promise.all([db.getAll("parametros"), db.getAll("colonias")]);
      return Object.fromEntries([...parametros.map((p) => [p.id, p.nome]), ...colonias.map((c) => [c.id, c.codigo])]);
    },
  });
  return { nomes: { ...nomes, ...Object.fromEntries((especies ?? []).map((e) => [e.id, e.nomePopular])) } };
}

function CartaoPendencia({ pendencia, ctx }: { pendencia: Pendencia; ctx: ContextoValores }) {
  const queryClient = useQueryClient();
  const { op, rotulo, rotaEdicao, rotaDetalhe, seguintes, dependentes } = pendencia;
  // Relê tudo também numa falha (ex.: pendência já resolvida em outra aba).
  const decidir = useMutation({
    mutationFn: ({ acao }: { nome: string; acao: () => Promise<void> }) => acao(),
    onSettled: () => queryClient.invalidateQueries(),
  });
  const girando = (nome: string) => decidir.isPending && decidir.variables?.nome === nome;
  const conflito = op.estado === "conflito";

  const confirmarServidor = () => {
    const extra = seguintes > 0 ? `\n\n${plural(seguintes, "outra edição", "outras edições")} deste registro feitas no aparelho também serão descartadas.` : "";
    if (window.confirm(`Manter a versão do servidor e descartar a do aparelho?${extra}`)) {
      decidir.mutate({ nome: "servidor", acao: () => manterServidor(op.id) });
    }
  };
  const confirmarDescarte = () => {
    // `dependentes.operacoes` já inclui as edições seguintes do mesmo registro.
    const partes = [
      dependentes.operacoes > 0 && plural(dependentes.operacoes, "outra mudança ligada a ela", "outras mudanças ligadas a ela"),
      dependentes.fotos > 0 && plural(dependentes.fotos, "foto guardada", "fotos guardadas"),
    ].filter(Boolean);
    const extra = partes.length ? `\n\nTambém serão descartadas: ${partes.join(" e ")}.` : "";
    if (window.confirm(`Descartar esta mudança? Ela não será enviada ao servidor.${extra}`)) {
      decidir.mutate({ nome: "descartar", acao: () => descartarPendencia(op.id) });
    }
  };

  return (
    <Cartao className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-foreground">
          {rotaDetalhe ? (
            <Link to={rotaDetalhe} className="hover:underline">
              {rotulo}
            </Link>
          ) : (
            rotulo
          )}
        </h3>
        <Selo className={conflito ? "bg-muted text-foreground" : "bg-destructive/10 text-destructive"}>
          {conflito ? "Conflito" : "Recusada pelo servidor"}
        </Selo>
      </div>

      {conflito && op.conflitos?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Campos alterados nos dois lados</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Campo</th>
                <th className="py-1 pr-3 font-medium">Neste aparelho</th>
                <th className="py-1 font-medium">No servidor</th>
              </tr>
            </thead>
            <tbody>
              {op.conflitos.map((c) => (
                <tr key={c.campo} className="border-t border-border align-top">
                  <th scope="row" className="py-2 pr-3 font-medium text-foreground">{rotuloCampo(c.campo)}</th>
                  <td className="py-2 pr-3 text-foreground">{formatarValorCampo(c.campo, c.local, ctx)}</td>
                  <td className="py-2 text-foreground">{formatarValorCampo(c.campo, c.servidor, ctx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-foreground">{op.ultimoErro ?? "O servidor não aceitou esta mudança."}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {conflito && (
          <>
            <Botao tamanho="sm" variante="secundario" carregando={girando("servidor")} disabled={decidir.isPending} onClick={confirmarServidor}>
              Manter a do servidor
            </Botao>
            <Botao
              tamanho="sm"
              variante="secundario"
              carregando={girando("aparelho")}
              disabled={decidir.isPending}
              onClick={() => decidir.mutate({ nome: "aparelho", acao: () => manterAparelho(op.id) })}
            >
              Manter a deste aparelho
            </Botao>
          </>
        )}
        {!rotaEdicao && !conflito && op.operacao !== "delete" && (
          <p className="w-full text-xs text-muted-foreground">Esta mudança não pode mais ser editada (prazo de 7 dias); resta descartá-la.</p>
        )}
        {rotaEdicao && (
          <LinkBotao to={rotaEdicao} tamanho="sm" variante="primario">
            Editar manualmente
          </LinkBotao>
        )}
        {!conflito && (
          <Botao tamanho="sm" variante="perigo" carregando={girando("descartar")} disabled={decidir.isPending} onClick={confirmarDescarte}>
            Descartar
          </Botao>
        )}
      </div>
      <MensagemErro erro={decidir.error} />
    </Cartao>
  );
}

const ROTULO_ACAO = { create: "Criar", update: "Editar", delete: "Excluir" } as const;

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;

function SecaoStatus() {
  const online = useOnline();
  const usuarioId = useAuth((s) => s.usuario?.id);
  const sincronizando = useSincronizacao((s) => s.sincronizando);
  const progresso = useSincronizacao((s) => s.progresso);
  const servidorInacessivel = useSincronizacao((s) => s.servidorInacessivel);
  const ultima = useSincronizacao((s) => s.ultimaSincronizacao);
  const estado = !online ? "Sem conexão" : sincronizando ? "Sincronizando" : servidorInacessivel ? "Servidor inacessível" : "Conectado";
  const pct = progresso && progresso.total > 0 ? Math.round((progresso.feitas / progresso.total) * 100) : null;

  return (
    <Cartao className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">{estado}</h2>
          <p className="text-sm text-muted-foreground">
            {ultima ? (
              <>
                Última sincronização: <time dateTime={ultima} title={formatarDataHora(ultima)}>{tempoRelativo(ultima)}</time>
              </>
            ) : (
              "Ainda não houve sincronização neste aparelho."
            )}
          </p>
        </div>
        <Botao
          tamanho="sm"
          variante="primario"
          carregando={sincronizando}
          disabled={!online || !usuarioId}
          onClick={() => usuarioId && void sincronizar(usuarioId)}
        >
          <RefreshCw className="size-4" aria-hidden /> Sincronizar agora
        </Botao>
      </div>
      {sincronizando && progresso && (
        <div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Progresso da sincronização"
            aria-valuemin={0}
            aria-valuemax={progresso.total}
            aria-valuenow={progresso.feitas}
          >
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct ?? 0}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {progresso.feitas} de {progresso.total} itens enviados
          </p>
        </div>
      )}
      {!online && <p className="text-sm text-muted-foreground">O que você salvar fica neste aparelho e sobe sozinho quando a conexão voltar.</p>}
      {online && servidorInacessivel && !sincronizando && (
        <p className="text-sm text-muted-foreground">O servidor não respondeu. O app tenta de novo sozinho; os dados continuam guardados aqui.</p>
      )}
    </Cartao>
  );
}

function SecaoFila() {
  const usuarioId = useAuth((s) => s.usuario?.id);
  const naFila = useSincronizacao((s) => s.naFila);
  const fotosPendentes = useSincronizacao((s) => s.fotosPendentes);
  const concluidas = useSincronizacao((s) => s.concluidas);
  const { data: fila = [], isLoading, error } = useQuery({
    queryKey: ["sincronizacao", "fila", usuarioId, naFila, concluidas],
    queryFn: listarFila,
    enabled: Boolean(usuarioId),
  });
  const aguardando = fila.filter((p) => p.op.estado === "pendente");

  return (
    <section aria-labelledby="titulo-fila" className="space-y-3">
      <h2 id="titulo-fila" className="flex items-center gap-2 font-semibold text-foreground">
        <CloudUpload className="size-4" aria-hidden /> Aguardando envio
      </h2>
      {isLoading ? (
        <Carregando />
      ) : error ? (
        <MensagemErro erro={error} />
      ) : aguardando.length === 0 && fotosPendentes === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4" aria-hidden /> Nada aguardando envio.
        </p>
      ) : (
        <Cartao className="space-y-2">
          {aguardando.length > 0 && (
            <ul className="divide-y divide-border text-sm">
              {aguardando.map(({ op, rotulo, rotaDetalhe }) => (
                <li key={op.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-foreground">
                    <span className="font-medium">{ROTULO_ACAO[op.operacao]}</span> ·{" "}
                    {rotaDetalhe ? (
                      <Link to={rotaDetalhe} className="hover:underline">
                        {rotulo}
                      </Link>
                    ) : (
                      rotulo
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    feita {tempoRelativo(op.criadoEm)}
                    {op.tentativas > 0 && ` · ${op.tentativas} tentativa${op.tentativas > 1 ? "s" : ""}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {fotosPendentes > 0 && (
            <p className="text-sm text-foreground">
              {fotosPendentes} foto{fotosPendentes > 1 ? "s" : ""} guardada{fotosPendentes > 1 ? "s" : ""} neste aparelho
            </p>
          )}
        </Cartao>
      )}
    </section>
  );
}

function SecaoArmazenamento() {
  const usuarioId = useAuth((s) => s.usuario?.id);
  const { data } = useQuery({
    queryKey: ["sincronizacao", "armazenamento", usuarioId],
    enabled: Boolean(usuarioId),
    queryFn: async () => {
      const estimativa = await navigator.storage?.estimate?.().catch(() => undefined);
      // Banco bloqueado (ex.: modo privado) não esconde a estimativa de espaço.
      const persistente = indexedDbDisponivel()
        ? await abrirBanco(usuarioId!)
            .then(lerMeta)
            .then((m) => m.armazenamentoPersistente)
            .catch(() => null)
        : null;
      return { usado: estimativa?.usage ?? null, cota: estimativa?.quota ?? null, persistente };
    },
  });

  return (
    <section aria-labelledby="titulo-armazenamento" className="space-y-3">
      <h2 id="titulo-armazenamento" className="flex items-center gap-2 font-semibold text-foreground">
        <HardDrive className="size-4" aria-hidden /> Armazenamento neste aparelho
      </h2>
      <Cartao className="space-y-2 text-sm">
        <p className="text-foreground">
          {data?.usado != null
            ? `Espaço usado: ${megabytes(data.usado)}${data.cota ? ` de ${megabytes(data.cota)} disponíveis` : ""}`
            : "O navegador não informa o espaço usado."}
        </p>
        <p className="text-foreground">
          {data?.persistente === true
            ? "Armazenamento persistente: o navegador não apaga estes dados para liberar espaço."
            : data?.persistente === false
              ? "Armazenamento não persistente."
              : "Persistência do armazenamento ainda não verificada."}
        </p>
        {data?.persistente === false && (
          <p className="rounded-xl border border-border bg-muted px-3 py-2 text-foreground" role="status">
            Sem armazenamento persistente, o navegador pode apagar os dados guardados neste aparelho se faltar espaço ou
            depois de dias sem uso (no Safari/iOS). Instale o app ("Adicionar à tela inicial") para protegê-los.
          </p>
        )}
      </Cartao>
    </section>
  );
}

export function Sincronizacao() {
  const { data: pendencias, isLoading, error } = useQuery({
    queryKey: ["sincronizacao", "pendencias"],
    queryFn: listarPendencias,
  });
  const ctx = useNomes();

  return (
    <>
      <CabecalhoPagina
        voltar={<VoltarConfiguracoes />}
        titulo="Sincronização"
        subtitulo="O que foi registrado sem conexão sobe sozinho quando ela volta. Aqui você acompanha o envio e decide o que precisar."
      />
      <div className="space-y-6">
      <SecaoStatus />
      <section aria-labelledby="titulo-pendencias" className="space-y-3">
        <h2 id="titulo-pendencias" className="flex items-center gap-2 font-semibold text-foreground">
          <TriangleAlert className="size-4" aria-hidden /> Pendências
        </h2>
        {isLoading ? (
          <Carregando />
        ) : error ? (
          <MensagemErro erro={error} />
        ) : !pendencias?.length ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4" aria-hidden /> Nenhuma mudança esperando decisão.
          </p>
        ) : (
          pendencias.map((p) => <CartaoPendencia key={p.op.id} pendencia={p} ctx={ctx} />)
        )}
      </section>
      <SecaoFila />
      <SecaoArmazenamento />
      </div>
    </>
  );
}
