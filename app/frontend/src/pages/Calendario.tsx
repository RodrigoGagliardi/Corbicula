import { CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, Droplets, GitBranch } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { SeloScore } from "../components/features/SeloScore";
import { Botao, LinkBotao } from "../components/ui/Botao";
import { CabecalhoPagina, Cartao, Selo } from "../components/ui/Cartao";
import { Carregando, ErroCarregamento } from "../components/ui/Estados";
import { useColonias, useHistoricoAvaliacoes, useProducoes } from "../hooks/useDados";
import { usePreferencias } from "../store/preferencias";
import type { AvaliacaoHistorico, Colonia, Producao } from "../types/api";
import {
  agruparPorDia,
  chaveDia,
  chaveMes,
  dataDaChave,
  gradeDoMes,
  lerMes,
  somarDias,
  somarMeses,
  sugestoesInspecao,
  type Sugestao,
} from "../utils/calendario";
import { formatarData } from "../utils/format";
import { COR_PRODUTO, formatarQuantidade, ROTULO_PRODUTO } from "../utils/producao";
import { COR_STATUS } from "../utils/score";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CLASSE_LINK =
  "font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground";

interface EventosDoDia {
  inspecoes: AvaliacaoHistorico[];
  colheitas: Producao[];
  divisoes: Colonia[];
  sugestoes: Sugestao[];
}

export function Calendario() {
  const [params, setParams] = useSearchParams();
  const hoje = new Date();
  const chaveHoje = chaveDia(hoje);
  const { ano, mes } = lerMes(params.get("mes"), hoje);
  const diaSelecionado = params.get("dia");
  const frequenciaGeral = usePreferencias((s) => s.diasInspecaoAtrasada);

  const grade = useMemo(() => gradeDoMes(ano, mes), [ano, mes]);
  const inicio = chaveDia(grade[0]![0]!);
  const fim = chaveDia(grade.at(-1)!.at(-1)!);
  // Busca com 1–2 dias de folga: o filtro do servidor é por data UTC e o
  // agrupamento aqui é pelo dia local.
  const periodo = { desde: somarDias(inicio, -1), ate: somarDias(fim, 2) };

  const colonias = useColonias();
  const avaliacoes = useHistoricoAvaliacoes(periodo);
  const producoes = useProducoes(periodo);

  const navegar = (alteracoes: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(alteracoes)) {
          if (v) p.set(k, v);
          else p.delete(k);
        }
        return p;
      },
      { replace: true }
    );
  const irParaMes = (delta: number) => {
    const alvo = somarMeses(ano, mes, delta);
    navegar({ mes: chaveMes(alvo.ano, alvo.mes), dia: null });
  };

  const mesPorExtenso = new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const tituloMes = mesPorExtenso.charAt(0).toUpperCase() + mesPorExtenso.slice(1); // "Novembro de 2026"
  const acoes = (
    <div className="flex items-center gap-1">
      <Botao variante="secundario" tamanho="sm" onClick={() => irParaMes(-1)} aria-label="Mês anterior">
        <ChevronLeft className="size-4" aria-hidden />
      </Botao>
      <Botao variante="secundario" tamanho="sm" onClick={() => navegar({ mes: null, dia: chaveHoje })}>
        Hoje
      </Botao>
      <Botao variante="secundario" tamanho="sm" onClick={() => irParaMes(1)} aria-label="Próximo mês">
        <ChevronRight className="size-4" aria-hidden />
      </Botao>
    </div>
  );
  const cabecalho = <CabecalhoPagina titulo="Calendário" subtitulo={tituloMes} acoes={acoes} />;

  const erro = colonias.error ?? avaliacoes.error ?? producoes.error;
  if (colonias.isLoading || avaliacoes.isLoading || producoes.isLoading) return <>{cabecalho}<Carregando /></>;
  if (erro || !colonias.data || !avaliacoes.data || !producoes.data) {
    return (
      <>
        {cabecalho}
        <ErroCarregamento erro={erro} tentarDeNovo={() => { colonias.refetch(); avaliacoes.refetch(); producoes.refetch(); }} />
      </>
    );
  }

  const dentro = (dia: string) => dia >= inicio && dia <= fim;
  const inspecoes = agruparPorDia(avaliacoes.data.filter((a) => dentro(chaveDia(a.dataAvaliacao))), (a) => chaveDia(a.dataAvaliacao));
  const colheitas = agruparPorDia(producoes.data.filter((p) => dentro(chaveDia(p.dataColheita))), (p) => chaveDia(p.dataColheita));
  const divisoes = agruparPorDia(
    colonias.data.filter((c) => c.origem === "divisao" && dentro(chaveDia(c.dataEntrada))),
    (c) => chaveDia(c.dataEntrada)
  );
  const sugestoes = agruparPorDia(sugestoesInspecao(colonias.data, frequenciaGeral, inicio, fim, hoje), (s) => s.dia);
  const eventos = (dia: string): EventosDoDia => ({
    inspecoes: inspecoes.get(dia) ?? [],
    colheitas: colheitas.get(dia) ?? [],
    divisoes: divisoes.get(dia) ?? [],
    sugestoes: sugestoes.get(dia) ?? [],
  });
  const selecionado = diaSelecionado && dentro(diaSelecionado) ? diaSelecionado : null;

  return (
    <>
      {cabecalho}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Cartao className="!p-2 md:!p-3">
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground" aria-hidden>
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="py-1.5">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border" role="grid" aria-label={`Calendário de ${tituloMes}`}>
            {grade.flat().map((data) => {
              const dia = chaveDia(data);
              return (
                <CelulaDia
                  key={dia}
                  data={data}
                  eventos={eventos(dia)}
                  doMes={data.getMonth() === mes}
                  hoje={dia === chaveHoje}
                  selecionado={dia === selecionado}
                  aoSelecionar={() => navegar({ dia: dia === selecionado ? null : dia })}
                />
              );
            })}
          </div>
          <Legenda />
        </Cartao>

        <aside className="space-y-4">
          {selecionado ? (
            <PainelDia dia={selecionado} eventos={eventos(selecionado)} />
          ) : (
            <p className="rounded-2xl border border-dashed border-input px-4 py-3 text-sm text-muted-foreground">
              Toque num dia para ver as inspeções, colheitas, divisões e as próximas inspeções sugeridas.
            </p>
          )}
          <Cartao className="space-y-1 text-sm text-muted-foreground">
            <h2 className="font-semibold text-foreground">Como as sugestões são calculadas</h2>
            <p>
              Última inspeção (ou a entrada, se a colônia nunca foi avaliada) + a frequência da colônia ou, sem ela, a{" "}
              <Link to="/app/configuracoes/preferencias" className={CLASSE_LINK}>preferência geral</Link> ({frequenciaGeral} dias).
              Inspeções vencidas aparecem hoje, como atrasadas. É uma sugestão de manejo, não uma previsão.
            </p>
          </Cartao>
        </aside>
      </div>
    </>
  );
}

function CelulaDia({
  data,
  eventos: e,
  doMes,
  hoje,
  selecionado,
  aoSelecionar,
}: {
  data: Date;
  eventos: EventosDoDia;
  doMes: boolean;
  hoje: boolean;
  selecionado: boolean;
  aoSelecionar: () => void;
}) {
  const atrasadas = e.sugestoes.filter((s) => s.atrasadaDesde).length;
  const total = e.inspecoes.length + e.colheitas.length + e.divisoes.length + e.sugestoes.length;
  const descricao = [
    e.inspecoes.length && `${e.inspecoes.length} inspeção(ões)`,
    e.colheitas.length && `${e.colheitas.length} colheita(s)`,
    e.divisoes.length && `${e.divisoes.length} divisão(ões)`,
    e.sugestoes.length && `${e.sugestoes.length} inspeção(ões) sugerida(s)${atrasadas ? `, ${atrasadas} atrasada(s)` : ""}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      role="gridcell"
      onClick={aoSelecionar}
      aria-pressed={selecionado}
      aria-label={`${data.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}${descricao ? `: ${descricao}` : ""}`}
      className={`flex min-h-16 flex-col items-stretch gap-1 p-1 text-left md:min-h-24 md:p-1.5 ${
        selecionado ? "bg-sidebar text-sidebar-foreground ring-2 ring-inset ring-accent" : doMes ? "bg-card hover:bg-muted" : "bg-background text-muted-foreground/60 hover:bg-muted"
      }`}
    >
      <span
        className={`flex size-6 items-center justify-center self-start rounded-full text-xs font-semibold ${
          hoje ? "bg-accent text-accent-foreground ring-2 ring-black" : ""
        }`}
      >
        {data.getDate()}
      </span>
      {total > 0 && (
        <span className="flex flex-wrap gap-0.5 md:gap-1" aria-hidden>
          {e.inspecoes.slice(0, 4).map((a) => (
            <span key={a.id} className={`size-2 rounded-full md:size-2.5 ${COR_STATUS[a.statusGeral].barra}`} />
          ))}
          {e.colheitas.length > 0 && <Droplets className="size-3 text-primary md:size-3.5" />}
          {e.divisoes.length > 0 && <GitBranch className="size-3 text-primary md:size-3.5" />}
          {e.sugestoes.length > 0 && (
            <span
              className={`size-2 rounded-full border-2 border-dashed md:size-2.5 ${atrasadas ? "border-critica" : "border-muted-foreground"}`}
            />
          )}
          {total > 6 && <span className="text-[10px] leading-none">+{total - 6}</span>}
        </span>
      )}
    </button>
  );
}

function Legenda() {
  const item = (marca: ReactNode, texto: string) => (
    <li className="flex items-center gap-1.5">
      {marca}
      {texto}
    </li>
  );
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
      {item(<span className={`size-2.5 rounded-full ${COR_STATUS.excelente.barra}`} />, "Inspeção (cor do score)")}
      {item(<Droplets className="size-3.5 text-primary" />, "Colheita")}
      {item(<GitBranch className="size-3.5 text-primary" />, "Divisão")}
      {item(<span className="size-2.5 rounded-full border-2 border-dashed border-muted-foreground" />, "Inspeção sugerida")}
      {item(<span className="size-2.5 rounded-full border-2 border-dashed border-critica" />, "Atrasada")}
    </ul>
  );
}

function PainelDia({ dia, eventos: e }: { dia: string; eventos: EventosDoDia }) {
  const titulo = dataDaChave(dia).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const vazio = !e.inspecoes.length && !e.colheitas.length && !e.divisoes.length && !e.sugestoes.length;
  return (
    <Cartao className="space-y-4">
      <h2 className="font-semibold text-foreground first-letter:uppercase">{titulo}</h2>
      {vazio && <p className="text-sm text-muted-foreground">Nada registrado nem sugerido neste dia.</p>}

      {e.sugestoes.length > 0 && (
        <Secao icone={<CalendarClock className="size-4" aria-hidden />} titulo="Inspeções sugeridas">
          {e.sugestoes.map((s) => (
            <li key={s.colonia.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/app/colonias/${s.colonia.id}`} className={`font-mono text-sm ${CLASSE_LINK}`}>{s.colonia.codigo}</Link>
                <p className="text-xs text-muted-foreground">
                  {s.atrasadaDesde ? (
                    <span className="font-medium text-critica">Atrasada há {s.diasAtraso} dia(s) (vencia em {formatarData(s.atrasadaDesde + "T12:00:00")})</span>
                  ) : (
                    `A cada ${s.frequencia} dias${s.frequenciaDaColonia ? " (desta colônia)" : ""}`
                  )}
                </p>
              </div>
              <LinkBotao to={`/app/avaliacoes/nova?colonia=${s.colonia.id}`} tamanho="sm" variante="secundario">
                <ClipboardCheck className="size-4" aria-hidden /> Avaliar
              </LinkBotao>
            </li>
          ))}
        </Secao>
      )}

      {e.inspecoes.length > 0 && (
        <Secao icone={<ClipboardCheck className="size-4" aria-hidden />} titulo="Inspeções realizadas">
          {e.inspecoes.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <Link to={`/app/colonias/${a.colonia.id}/avaliacoes/${a.id}`} className={`font-mono text-sm ${CLASSE_LINK}`}>
                {a.colonia.codigo}
              </Link>
              <SeloScore score={a.scoreGeral} status={a.statusGeral} />
            </li>
          ))}
        </Secao>
      )}

      {e.colheitas.length > 0 && (
        <Secao icone={<Droplets className="size-4" aria-hidden />} titulo="Colheitas">
          {e.colheitas.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <Link to={`/app/producao/${p.id}/editar`} className={`font-mono text-sm ${CLASSE_LINK}`}>{p.colonia.codigo}</Link>
              <Selo className={COR_PRODUTO[p.tipoProduto]}>
                {ROTULO_PRODUTO[p.tipoProduto]} · {formatarQuantidade(p.quantidade, p.unidade)}
              </Selo>
            </li>
          ))}
        </Secao>
      )}

      {e.divisoes.length > 0 && (
        <Secao icone={<GitBranch className="size-4" aria-hidden />} titulo="Divisões">
          {e.divisoes.map((c) => (
            <li key={c.id} className="text-sm">
              <Link to={`/app/colonias/${c.id}`} className={`font-mono ${CLASSE_LINK}`}>{c.codigo}</Link>
              <span className="text-muted-foreground"> entrou por divisão</span>
            </li>
          ))}
        </Secao>
      )}
    </Cartao>
  );
}

function Secao({ icone, titulo, children }: { icone: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icone} {titulo}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}
