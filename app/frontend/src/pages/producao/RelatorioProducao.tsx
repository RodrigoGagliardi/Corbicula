import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Download, Droplets } from "lucide-react";
import { Link } from "react-router";
import { Botao, LinkBotao } from "../../components/ui/Botao";
import { CabecalhoPagina, Cartao, Selo } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, EstadoVazio, MensagemErro } from "../../components/ui/Estados";
import { useResumoProducao } from "../../hooks/useDados";
import { exportacaoApi } from "../../services/api/endpoints";
import type { GrupoProducao } from "../../types/api";
import { COR_PRODUTO, formatarQuantidade, ROTULO_PRODUTO } from "../../utils/producao";
import { BarraFiltrosProducao, useFiltrosProducao } from "./HistoricoProducao";

const MAX_RANKING = 10;

export function RelatorioProducao() {
  const { filtros, params } = useFiltrosProducao();
  const { data: resumo, isLoading, error, refetch } = useResumoProducao(filtros);
  const exportar = useMutation({ mutationFn: (formato: "csv" | "json") => exportacaoApi.producoes(filtros, formato) });

  return (
    <>
      <CabecalhoPagina
        voltar={
          <Link to={`/app/producao?${params}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Produção
          </Link>
        }
        titulo="Relatório de produção"
        subtitulo="Totais, médias e ranking por produto, colônia e espécie."
        acoes={
          <>
            <Botao variante="secundario" onClick={() => exportar.mutate("csv")} carregando={exportar.isPending && exportar.variables === "csv"}>
              <Download className="size-4" aria-hidden /> CSV
            </Botao>
            <Botao variante="secundario" onClick={() => exportar.mutate("json")} carregando={exportar.isPending && exportar.variables === "json"}>
              <Download className="size-4" aria-hidden /> JSON
            </Botao>
          </>
        }
      />
      <BarraFiltrosProducao />
      <MensagemErro erro={exportar.error} />

      {isLoading ? (
        <Carregando />
      ) : error || !resumo ? (
        <ErroCarregamento erro={error} tentarDeNovo={() => refetch()} />
      ) : resumo.grupos.length === 0 ? (
        <EstadoVazio
          icone={<Droplets className="size-10" />}
          titulo="Sem colheitas nesse filtro"
          descricao="O relatório aparece assim que houver colheitas no período escolhido."
          acao={<LinkBotao to="/app/producao/nova" variante="destaque">Registrar colheita</LinkBotao>}
        />
      ) : (
        <div className="space-y-4">
          {resumo.grupos.map((g) => (
            <SecaoGrupo key={`${g.tipoProduto}-${g.unidade}`} grupo={g} />
          ))}
          <Cartao className="text-sm text-muted-foreground">
            <h2 className="mb-1 font-semibold text-foreground">Metodologia</h2>
            <p>
              Totais agrupados por produto e unidade: quantidades em ml e em g nunca são somadas, porque não há conversão
              volume → massa confiável sem a densidade medida. Médias são aritméticas simples (por colheita e por colônia
              produtora). A exportação traz os registros individuais para reanálise.
            </p>
          </Cartao>
        </div>
      )}
    </>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="font-display text-lg font-bold text-foreground">{valor}</p>
    </div>
  );
}

function SecaoGrupo({ grupo: g }: { grupo: GrupoProducao }) {
  const fmt = (n: number) => formatarQuantidade(n, g.unidade);
  const ranking = g.rankingColonias.slice(0, MAX_RANKING);
  const maior = ranking[0]?.total ?? 1;

  return (
    <Cartao className="space-y-5">
      <div className="flex items-center gap-2">
        <Selo className={COR_PRODUTO[g.tipoProduto]}>{ROTULO_PRODUTO[g.tipoProduto]}</Selo>
        <h2 className="font-semibold text-foreground">em {g.unidade === "ml" ? "mililitros (ml)" : "gramas (g)"}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Indicador rotulo="Total" valor={fmt(g.total)} />
        <Indicador rotulo="Colheitas" valor={String(g.colheitas)} />
        <Indicador rotulo="Média por colheita" valor={fmt(g.mediaPorColheita)} />
        <Indicador rotulo={`Média por colônia (${g.coloniasProdutoras})`} valor={fmt(g.mediaPorColonia)} />
      </div>

      <figure>
        <figcaption className="mb-2 text-sm font-semibold text-foreground">
          Ranking de colônias
          {g.rankingColonias.length > MAX_RANKING && (
            <span className="font-normal text-muted-foreground"> · {MAX_RANKING} maiores de {g.rankingColonias.length}</span>
          )}
        </figcaption>
        <ol className="space-y-1.5">
          {ranking.map((c) => (
            <li
              key={c.coloniaId}
              className="group grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-muted"
              title={`${c.codigo}: ${fmt(c.total)} em ${c.colheitas} colheita${c.colheitas > 1 ? "s" : ""}`}
            >
              <Link to={`/app/colonias/${c.coloniaId}`} className="truncate font-mono text-sm text-foreground hover:underline">
                {c.codigo}
              </Link>
              <div className="h-3 rounded-r bg-muted group-hover:bg-card" aria-hidden>
                <div className="h-full rounded-r bg-chart-1" style={{ width: `${Math.max((c.total / maior) * 100, 1)}%` }} />
              </div>
              <span className="text-right text-sm tabular-nums text-foreground">
                {fmt(c.total)} <span className="text-muted-foreground">· {c.colheitas}×</span>
              </span>
            </li>
          ))}
        </ol>
      </figure>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Por espécie</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Espécie</th>
                <th className="py-2 pr-3 text-right font-medium">Total</th>
                <th className="py-2 pr-3 text-right font-medium">Colônias</th>
                <th className="py-2 pr-3 text-right font-medium">Colheitas</th>
                <th className="py-2 text-right font-medium">Média/colônia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {g.porEspecie.map((e) => (
                <tr key={e.especieCodigo ?? "sem"}>
                  <td className="py-2 pr-3 text-foreground">
                    {e.nomeCientifico ? <i>{e.nomeCientifico}</i> : <span className="text-muted-foreground">Não identificada</span>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmt(e.total)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{e.colonias}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{e.colheitas}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(e.mediaPorColonia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Cartao>
  );
}
