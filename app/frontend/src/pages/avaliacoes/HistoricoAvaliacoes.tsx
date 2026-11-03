import { useMutation } from "@tanstack/react-query";
import { ClipboardCheck, ClipboardList, Download, Pencil } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { GraficoScore } from "../../components/charts/GraficoScore";
import { SeloScore } from "../../components/features/SeloScore";
import { Botao, LinkBotao } from "../../components/ui/Botao";
import { Selecao } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, EstadoVazio, MensagemErro } from "../../components/ui/Estados";
import { useAvaliacoes, useColonias, useHistoricoAvaliacoes, useParametros } from "../../hooks/useDados";
import { exportacaoApi } from "../../services/api/endpoints";
import type { AvaliacaoHistorico, Classificacao, FiltrosAvaliacoes, StatusAvaliacao } from "../../types/api";
import { formatarDataHora, ROTULO_CLIMA } from "../../utils/format";
import { inicioDoPeriodo, ROTULO_PERIODO, type Periodo } from "../../utils/periodo";
import { COR_STATUS, podeEditar, ROTULO_CLASSIFICACAO, ROTULO_STATUS, STATUS_AVALIACAO } from "../../utils/score";

// Filtros guardados na URL (sobrevivem ao abrir uma avaliação e voltar).
function useFiltrosAvaliacoes() {
  const [params, setParams] = useSearchParams();
  const periodo = (params.get("periodo") as Periodo | null) ?? "tudo";
  const status = (params.get("status") as StatusAvaliacao | null) ?? undefined;
  const coloniaId = params.get("colonia") ?? undefined;
  const parametroId = params.get("parametro") ?? undefined;
  // A classificação só faz sentido junto com um parâmetro ("Fluxo de entrada foi Ruim").
  const classificacao = parametroId ? ((params.get("classificacao") as Classificacao | null) ?? undefined) : undefined;

  const alterar = (mudancas: Record<string, string | undefined>) =>
    setParams(
      (p) => {
        for (const [chave, valor] of Object.entries(mudancas)) {
          if (valor) p.set(chave, valor);
          else p.delete(chave);
        }
        return p;
      },
      { replace: true }
    );

  const desde = inicioDoPeriodo(periodo);
  const filtros: FiltrosAvaliacoes = {
    ...(coloniaId && { coloniaId }),
    ...(status && { status }),
    ...(parametroId && { parametroId }),
    ...(classificacao && { classificacao }),
    ...(desde && { desde }),
  };
  return { periodo, status, coloniaId, parametroId, classificacao, desde, filtros, alterar, filtrando: params.size > 0 };
}

export function HistoricoAvaliacoes() {
  const f = useFiltrosAvaliacoes();
  const { data: avaliacoes, isLoading, error, refetch } = useHistoricoAvaliacoes(f.filtros);
  const exportar = useMutation({ mutationFn: (formato: "csv" | "json") => exportacaoApi.avaliacoes(f.filtros, formato) });

  const acoes = (
    <>
      <Botao variante="secundario" onClick={() => exportar.mutate("csv")} carregando={exportar.isPending && exportar.variables === "csv"}>
        <Download className="size-4" aria-hidden /> CSV
      </Botao>
      <Botao variante="secundario" onClick={() => exportar.mutate("json")} carregando={exportar.isPending && exportar.variables === "json"}>
        <Download className="size-4" aria-hidden /> JSON
      </Botao>
      <LinkBotao to={`/app/avaliacoes/nova${f.coloniaId ? `?colonia=${f.coloniaId}` : ""}`} variante="destaque">
        <ClipboardCheck className="size-4" aria-hidden /> Nova avaliação
      </LinkBotao>
    </>
  );

  return (
    <>
      <CabecalhoPagina titulo="Avaliações" subtitulo="Histórico de inspeções de todas as colônias." acoes={acoes} />
      <MensagemErro erro={exportar.error} />
      <BarraFiltros {...f} />

      {isLoading ? (
        <Carregando />
      ) : error || !avaliacoes ? (
        <ErroCarregamento erro={error} tentarDeNovo={() => refetch()} />
      ) : avaliacoes.length === 0 ? (
        <EstadoVazio
          icone={<ClipboardList className="size-10" />}
          titulo={f.filtrando ? "Nenhuma avaliação nesse filtro" : "Nenhuma avaliação registrada"}
          descricao={f.filtrando ? "Tente outro período, status, colônia ou parâmetro." : "As inspeções registradas aparecem aqui, agrupadas por mês."}
          acao={!f.filtrando && <LinkBotao to="/app/avaliacoes/nova" variante="destaque">Avaliar uma colônia</LinkBotao>}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <ResumoFiltro avaliacoes={avaliacoes} />
            <EvolucaoColonia coloniaId={f.coloniaId} desde={f.desde} />
          </div>
          <LinhaDoTempo avaliacoes={avaliacoes} />
          {f.parametroId && (
            <p className="text-xs text-muted-foreground">
              A exportação usa os filtros de colônia, status e período; o filtro por parâmetro vale só para esta lista.
            </p>
          )}
        </div>
      )}
    </>
  );
}

// ─── Filtros ─────────────────────────────────────────────────────────────────

function BarraFiltros({ periodo, status, coloniaId, parametroId, classificacao, alterar }: ReturnType<typeof useFiltrosAvaliacoes>) {
  const { data: colonias } = useColonias();
  const { data: parametros } = useParametros();
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status da avaliação">
        {([undefined, ...STATUS_AVALIACAO] as (StatusAvaliacao | undefined)[]).map((s) => (
          <button
            key={s ?? "todos"}
            type="button"
            role="radio"
            aria-checked={status === s}
            onClick={() => alterar({ status: s })}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              status === s ? "border-sidebar bg-sidebar text-sidebar-primary" : "border-input text-muted-foreground hover:bg-muted"
            }`}
          >
            {s ? ROTULO_STATUS[s] : "Todos"}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Selecao aria-label="Período" value={periodo} onChange={(e) => alterar({ periodo: e.target.value === "tudo" ? undefined : e.target.value })}>
          {(Object.keys(ROTULO_PERIODO) as Periodo[]).map((p) => (
            <option key={p} value={p}>
              {ROTULO_PERIODO[p]}
            </option>
          ))}
        </Selecao>
        <Selecao aria-label="Colônia" value={coloniaId ?? ""} onChange={(e) => alterar({ colonia: e.target.value || undefined })}>
          <option value="">Todas as colônias</option>
          {colonias?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo}
              {c.especie ? ` — ${c.especie.nomePopular}` : ""}
            </option>
          ))}
        </Selecao>
        <Selecao
          aria-label="Parâmetro"
          value={parametroId ?? ""}
          onChange={(e) => alterar({ parametro: e.target.value || undefined, ...(!e.target.value && { classificacao: undefined }) })}
        >
          <option value="">Qualquer parâmetro</option>
          {parametros?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
              {p.ativo ? "" : " (inativo)"}
            </option>
          ))}
        </Selecao>
        <Selecao
          aria-label="Classificação do parâmetro"
          value={classificacao ?? ""}
          disabled={!parametroId}
          title={parametroId ? undefined : "Escolha um parâmetro primeiro"}
          onChange={(e) => alterar({ classificacao: e.target.value || undefined })}
        >
          <option value="">{parametroId ? "Qualquer classificação" : "Classificação (escolha um parâmetro)"}</option>
          {(["bom", "medio", "ruim"] as Classificacao[]).map((c) => (
            <option key={c} value={c}>
              Avaliado como {ROTULO_CLASSIFICACAO[c]}
            </option>
          ))}
        </Selecao>
      </div>
    </div>
  );
}

// ─── Resumo e gráfico ────────────────────────────────────────────────────────

function ResumoFiltro({ avaliacoes }: { avaliacoes: AvaliacaoHistorico[] }) {
  const media = Math.round(avaliacoes.reduce((acc, a) => acc + a.scoreGeral, 0) / avaliacoes.length);
  const colonias = new Set(avaliacoes.map((a) => a.coloniaId)).size;
  return (
    <Cartao className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Inspeções</p>
          <p className="font-display text-3xl font-bold text-foreground">{avaliacoes.length}</p>
          <p className="text-xs text-muted-foreground">
            em {colonias} colônia{colonias > 1 ? "s" : ""}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Score médio</p>
          <p className="font-display text-3xl font-bold text-foreground">{media}</p>
          <p className="text-xs text-muted-foreground">média simples</p>
        </div>
      </div>
      <ul className="space-y-1.5" aria-label="Avaliações por status">
        {STATUS_AVALIACAO.map((s) => {
          const n = avaliacoes.filter((a) => a.statusGeral === s).length;
          const pct = Math.round((n / avaliacoes.length) * 100);
          return (
            <li key={s}>
              <div className="flex justify-between text-xs">
                <span className={`font-medium ${COR_STATUS[s].texto}`}>{ROTULO_STATUS[s]}</span>
                <span className="text-muted-foreground">
                  {n} · {pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${COR_STATUS[s].barra}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}

// Usa todas as inspeções da colônia no período, mesmo com filtro de status ou
// parâmetro: uma curva só com as avaliações "críticas" não mostraria evolução.
function EvolucaoColonia({ coloniaId, desde }: { coloniaId: string | undefined; desde: string | undefined }) {
  const { data: avaliacoes } = useAvaliacoes(coloniaId ?? "");
  const noPeriodo = (avaliacoes ?? []).filter((a) => !desde || a.dataAvaliacao.slice(0, 10) >= desde);

  return (
    <Cartao className="md:col-span-2">
      <h2 className="mb-2 font-semibold text-foreground">Evolução do score</h2>
      {!coloniaId ? (
        <p className="text-sm text-muted-foreground">Escolha uma colônia no filtro para ver a evolução do score dela ao longo das inspeções.</p>
      ) : !avaliacoes ? (
        <Carregando />
      ) : noPeriodo.length < 2 ? (
        <p className="text-sm text-muted-foreground">São necessárias ao menos duas inspeções da colônia no período para traçar a curva.</p>
      ) : (
        <>
          <GraficoScore avaliacoes={noPeriodo} />
          <p className="mt-2 text-xs text-muted-foreground">
            Todas as {noPeriodo.length} inspeções da colônia no período (os filtros de status e parâmetro não se aplicam ao gráfico). Linhas
            tracejadas: limites de Excelente (80), Boa (60) e Atenção (40).
          </p>
        </>
      )}
    </Cartao>
  );
}

// ─── Linha do tempo ──────────────────────────────────────────────────────────

const rotuloMes = (iso: string) => {
  const texto = new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Agrupa por mês (fuso local) mantendo a ordem da API (mais recente primeiro).
function agruparPorMes(avaliacoes: AvaliacaoHistorico[]) {
  const grupos = new Map<string, AvaliacaoHistorico[]>();
  for (const a of avaliacoes) {
    const d = new Date(a.dataAvaliacao);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), a]);
  }
  return [...grupos.entries()];
}

function LinhaDoTempo({ avaliacoes }: { avaliacoes: AvaliacaoHistorico[] }) {
  return (
    <div className="space-y-4">
      {agruparPorMes(avaliacoes).map(([chave, doMes]) => (
        <section key={chave} aria-labelledby={`mes-${chave}`}>
          <h2 id={`mes-${chave}`} className="mb-2 flex items-baseline gap-2 font-display font-semibold text-foreground">
            {rotuloMes(doMes[0]!.dataAvaliacao)}
            <span className="text-sm font-normal text-muted-foreground">
              {doMes.length} inspeç{doMes.length > 1 ? "ões" : "ão"}
            </span>
          </h2>
          <Cartao className="p-0 md:p-0">
            <ul className="divide-y divide-border">
              {doMes.map((a) => (
                <ItemAvaliacao key={a.id} avaliacao={a} />
              ))}
            </ul>
          </Cartao>
        </section>
      ))}
    </div>
  );
}

function ItemAvaliacao({ avaliacao: a }: { avaliacao: AvaliacaoHistorico }) {
  const detalhe = `/app/colonias/${a.coloniaId}/avaliacoes/${a.id}`;
  const extras = [
    `${a._count.parametros} parâmetro${a._count.parametros > 1 ? "s" : ""}`,
    a.condicaoClimatica && ROTULO_CLIMA[a.condicaoClimatica],
    a.temperatura !== null && `${a.temperatura} °C`,
    a.acoesTomadas.length > 0 && `${a.acoesTomadas.length} aç${a.acoesTomadas.length > 1 ? "ões" : "ão"}`,
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-2 pr-2">
      <Link to={detalhe} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 hover:bg-background">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm text-foreground">
            <span className="font-mono font-semibold">{a.colonia.codigo}</span>
            <span className="text-muted-foreground">
              {" "}
              · {a.colonia.especie?.nomePopular ?? "Espécie não identificada"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {formatarDataHora(a.dataAvaliacao)} · {extras.join(" · ")}
          </p>
          {a.observacoesGerais && <p className="truncate text-xs text-muted-foreground">{a.observacoesGerais}</p>}
        </div>
        <SeloScore score={a.scoreGeral} status={a.statusGeral} />
      </Link>
      {podeEditar(a.createdAt) && (
        <Link
          to={`${detalhe}/editar`}
          className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Editar avaliação de ${a.colonia.codigo}`}
          title="Editar (disponível por 7 dias após o registro)"
        >
          <Pencil className="size-4" aria-hidden />
        </Link>
      )}
    </li>
  );
}
