import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellOff, CalendarClock, Check, ClipboardCheck, Eye, HeartPulse, RotateCcw, TrendingDown, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { SeloScore } from "../components/features/SeloScore";
import { Botao, LinkBotao } from "../components/ui/Botao";
import { CabecalhoPagina, Cartao } from "../components/ui/Cartao";
import { AvisoSemConexao, Carregando, ErroCarregamento, MensagemErro } from "../components/ui/Estados";
import { useAlertas } from "../hooks/useDados";
import { alertasApi } from "../services/api/endpoints";
import type { Alerta, RespostaAlertas, TipoAlerta } from "../types/api";
import { formatarData, tempoRelativo } from "../utils/format";

const TIPOS: { tipo: TipoAlerta; rotulo: string; icone: LucideIcon }[] = [
  { tipo: "score_baixo", rotulo: "Score baixo", icone: HeartPulse },
  { tipo: "parametro_ruim", rotulo: "Parâmetro ruim", icone: TriangleAlert },
  { tipo: "queda_score", rotulo: "Queda de score", icone: TrendingDown },
  { tipo: "sem_inspecao", rotulo: "Inspeção atrasada", icone: CalendarClock },
  { tipo: "nunca_avaliada", rotulo: "Nunca avaliada", icone: ClipboardCheck },
];
const POR_TIPO = Object.fromEntries(TIPOS.map((t) => [t.tipo, t])) as Record<TipoAlerta, (typeof TIPOS)[number]>;

const COR_GRAVIDADE = {
  alta: { borda: "border-l-critica", icone: "text-critica" },
  media: { borda: "border-l-atencao", icone: "text-atencao" },
} as const;

const CLASSE_LINK =
  "font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground";

export function Alertas() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const incluirResolvidos = params.get("resolvidos") === "1";
  const filtroTipo = params.get("tipo") as TipoAlerta | null;
  const { data, isLoading, error, refetch } = useAlertas(incluirResolvidos);

  const alterarParam = (chave: string, valor: string | null) =>
    setParams((p) => {
      if (valor) p.set(chave, valor);
      else p.delete(chave);
      return p;
    }, { replace: true });

  // Resolver/reabrir com atualização otimista: o cartão muda na hora e o
  // servidor confirma depois (o contador da navegação acompanha).
  const alternar = useMutation({
    mutationFn: (a: Alerta) => (a.resolvido ? alertasApi.reabrir(a.chave) : alertasApi.resolver(a.chave)),
    onMutate: async (a) => {
      await queryClient.cancelQueries({ queryKey: ["colonias", "alertas"] });
      const anteriores = queryClient.getQueriesData<RespostaAlertas>({ queryKey: ["colonias", "alertas"] });
      for (const [chave, resposta] of anteriores) {
        if (!resposta) continue;
        const incluiResolvidos = (chave[2] as { incluirResolvidos?: boolean } | undefined)?.incluirResolvidos;
        const alertas = resposta.alertas
          .map((x) => (x.chave === a.chave ? { ...x, resolvido: !a.resolvido } : x))
          .filter((x) => incluiResolvidos || !x.resolvido);
        const delta = a.resolvido ? 1 : -1;
        const totais = {
          ...resposta.totais,
          abertos: resposta.totais.abertos + delta,
          [a.gravidade]: resposta.totais[a.gravidade] + delta,
          resolvidos: resposta.totais.resolvidos - delta,
        };
        queryClient.setQueryData(chave, { ...resposta, alertas, totais });
      }
      return { anteriores };
    },
    onError: (_e, _a, ctx) => ctx?.anteriores.forEach(([chave, valor]) => queryClient.setQueryData(chave, valor)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["colonias", "alertas"] }),
  });

  if (isLoading) return <><CabecalhoPagina titulo="Alertas" /><Carregando /></>;
  // Com o último resultado em cache, um refetch que falhou (ex.: offline) não o substitui.
  if (!data) return <><CabecalhoPagina titulo="Alertas" /><ErroCarregamento erro={error} tentarDeNovo={() => refetch()} /></>;

  const { alertas, totais, criterios } = data;
  const contagem = (tipo: TipoAlerta) => alertas.filter((a) => a.tipo === tipo && !a.resolvido).length;
  const visiveis = alertas.filter((a) => !filtroTipo || a.tipo === filtroTipo);

  return (
    <>
      <CabecalhoPagina
        titulo="Alertas"
        subtitulo={
          totais.abertos === 0
            ? "Nenhum alerta aberto."
            : `${totais.abertos} aberto(s)${totais.alta ? ` · ${totais.alta} de gravidade alta` : ""}`
        }
      />
      <AvisoSemConexao>
        Sem conexão: os alertas são calculados no servidor e podem estar desatualizados; resolver ou reabrir exige conexão.
      </AvisoSemConexao>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrar por tipo">
          <Filtro ativo={!filtroTipo} onClick={() => alterarParam("tipo", null)}>
            Todos
          </Filtro>
          {TIPOS.filter((t) => contagem(t.tipo) > 0 || filtroTipo === t.tipo).map((t) => (
            <Filtro key={t.tipo} ativo={filtroTipo === t.tipo} onClick={() => alterarParam("tipo", t.tipo)}>
              {t.rotulo} <span className="opacity-70">{contagem(t.tipo)}</span>
            </Filtro>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={incluirResolvidos}
            onChange={(e) => alterarParam("resolvidos", e.target.checked ? "1" : null)}
          />
          Mostrar resolvidos ({totais.resolvidos})
        </label>
      </div>

      <MensagemErro erro={alternar.error} />

      {visiveis.length === 0 ? (
        <Cartao className="flex flex-col items-center gap-2 py-10 text-center">
          <BellOff className="size-10 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">{filtroTipo ? "Nenhum alerta deste tipo" : "Tudo em dia 🐝"}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Os alertas aparecem sozinhos a partir das inspeções: colônias atrasadas, com score baixo, queda de score ou
            algum parâmetro Ruim.
          </p>
        </Cartao>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((a) => (
            <li key={a.chave}>
              <CartaoAlerta alerta={a} pendente={alternar.isPending && alternar.variables?.chave === a.chave} aoAlternar={() => alternar.mutate(a)} />
            </li>
          ))}
        </ul>
      )}

      <Cartao className="mt-6 space-y-1 text-sm text-muted-foreground">
        <h2 className="font-semibold text-foreground">Como os alertas são calculados</h2>
        <p>{criterios.descricao}</p>
        <p>
          Inspeção atrasada: {criterios.diasSemInspecao} dias pela{" "}
          <Link to="/app/configuracoes/preferencias" className={CLASSE_LINK}>preferência geral</Link>, ou a frequência
          definida em cada colônia. Avisos por e-mail ou notificação ainda não existem: os alertas aparecem aqui e no
          contador do menu.
        </p>
      </Cartao>
    </>
  );
}

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
        ativo ? "border-sidebar bg-sidebar text-sidebar-primary" : "border-input bg-card text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function CartaoAlerta({ alerta: a, pendente, aoAlternar }: { alerta: Alerta; pendente: boolean; aoAlternar: () => void }) {
  const { icone: Icone, rotulo } = POR_TIPO[a.tipo];
  return (
    <Cartao className={`border-l-4 ${COR_GRAVIDADE[a.gravidade].borda} ${a.resolvido ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Icone className={`mt-0.5 size-5 shrink-0 ${COR_GRAVIDADE[a.gravidade].icone}`} aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {rotulo} · {a.gravidade === "alta" ? "gravidade alta" : "gravidade média"}
              {a.resolvido && " · resolvido"}
            </p>
            <h2 className="font-semibold text-foreground">{a.titulo}</h2>
            <p className="text-sm">
              <Link to={`/app/colonias/${a.colonia.id}`} className={`font-mono ${CLASSE_LINK}`}>{a.colonia.codigo}</Link>
              {a.colonia.especie && <span className="text-muted-foreground"> · {a.colonia.especie.nomePopular}</span>}
            </p>
            <p className="text-sm text-muted-foreground">{a.detalhe}</p>
            <p className="text-xs text-muted-foreground">
              {a.avaliacao
                ? `Última inspeção em ${formatarData(a.avaliacao.dataAvaliacao)} (${tempoRelativo(a.avaliacao.dataAvaliacao)})`
                : `Entrada em ${formatarData(a.desde)}`}
            </p>
          </div>
        </div>
        {a.avaliacao && <SeloScore score={a.avaliacao.scoreGeral} status={a.avaliacao.statusGeral} />}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <LinkBotao to={`/app/avaliacoes/nova?colonia=${a.colonia.id}`} tamanho="sm">
          <ClipboardCheck className="size-4" aria-hidden /> Avaliar agora
        </LinkBotao>
        {a.avaliacao && (
          <LinkBotao to={`/app/colonias/${a.colonia.id}/avaliacoes/${a.avaliacao.id}`} variante="secundario" tamanho="sm">
            <Eye className="size-4" aria-hidden /> Ver inspeção
          </LinkBotao>
        )}
        <Botao variante="fantasma" tamanho="sm" onClick={aoAlternar} disabled={pendente}>
          {a.resolvido ? <><RotateCcw className="size-4" aria-hidden /> Reabrir</> : <><Check className="size-4" aria-hidden /> Marcar como resolvido</>}
        </Botao>
      </div>
    </Cartao>
  );
}
