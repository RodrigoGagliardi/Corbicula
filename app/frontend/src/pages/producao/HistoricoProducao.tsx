import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChartColumn, Droplets, Pencil, Plus, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { LinkBotao } from "../../components/ui/Botao";
import { Selecao } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao, Selo } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, EstadoVazio, MensagemErro } from "../../components/ui/Estados";
import { chaves, useColonias, useProducoes, useResumoProducao } from "../../hooks/useDados";
import { producoesApi } from "../../services/api/endpoints";
import type { FiltrosProducao, GrupoProducao, Producao, TipoProduto } from "../../types/api";
import { formatarData } from "../../utils/format";
import { inicioDoPeriodo, ROTULO_PERIODO, type Periodo } from "../../utils/periodo";
import { COR_PRODUTO, formatarQuantidade, ROTULO_PRODUTO, TIPOS_PRODUTO } from "../../utils/producao";

// Filtros guardados na URL (sobrevivem ao voltar de uma edição).
export function useFiltrosProducao() {
  const [params, setParams] = useSearchParams();
  const periodo = (params.get("periodo") as Periodo | null) ?? "tudo";
  const tipo = (params.get("tipo") as TipoProduto | null) ?? undefined;
  const coloniaId = params.get("colonia") ?? undefined;

  const alterar = (chave: string, valor: string | undefined) =>
    setParams(
      (p) => {
        if (valor) p.set(chave, valor);
        else p.delete(chave);
        return p;
      },
      { replace: true }
    );

  const filtros: FiltrosProducao = {
    ...(coloniaId && { coloniaId }),
    ...(tipo && { tipoProduto: tipo }),
    ...(inicioDoPeriodo(periodo) && { desde: inicioDoPeriodo(periodo) }),
  };
  return { periodo, tipo, coloniaId, filtros, alterar, params };
}

export function BarraFiltrosProducao({ comTipo = true }: { comTipo?: boolean }) {
  const { periodo, tipo, coloniaId, alterar } = useFiltrosProducao();
  const { data: colonias } = useColonias();
  return (
    <div className="mb-4 space-y-3">
      {comTipo && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de produto">
          {([undefined, ...TIPOS_PRODUTO] as (TipoProduto | undefined)[]).map((t) => (
            <button
              key={t ?? "todos"}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => alterar("tipo", t)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                tipo === t ? "border-sidebar bg-sidebar text-sidebar-primary" : "border-input text-muted-foreground hover:bg-muted"
              }`}
            >
              {t ? ROTULO_PRODUTO[t] : "Todos"}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Selecao aria-label="Período" value={periodo} onChange={(e) => alterar("periodo", e.target.value === "tudo" ? undefined : e.target.value)}>
          {(Object.keys(ROTULO_PERIODO) as Periodo[]).map((p) => (
            <option key={p} value={p}>
              {ROTULO_PERIODO[p]}
            </option>
          ))}
        </Selecao>
        <Selecao aria-label="Colônia" value={coloniaId ?? ""} onChange={(e) => alterar("colonia", e.target.value || undefined)}>
          <option value="">Todas as colônias</option>
          {colonias?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigo}
              {c.especie ? ` — ${c.especie.nomePopular}` : ""}
            </option>
          ))}
        </Selecao>
      </div>
    </div>
  );
}

export function CartaoTotal({ grupo }: { grupo: GrupoProducao }) {
  return (
    <Cartao className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Selo className={COR_PRODUTO[grupo.tipoProduto]}>{ROTULO_PRODUTO[grupo.tipoProduto]}</Selo>
        <span className="text-xs text-muted-foreground">
          {grupo.colheitas} colheita{grupo.colheitas > 1 ? "s" : ""}
        </span>
      </div>
      <p className="font-display text-2xl font-bold text-foreground">{formatarQuantidade(grupo.total, grupo.unidade)}</p>
      <p className="text-sm text-muted-foreground">
        Média por colônia: {formatarQuantidade(grupo.mediaPorColonia, grupo.unidade)}
        {grupo.melhorProdutora && grupo.coloniasProdutoras > 1 && (
          <>
            {" "}
            · Melhor: <span className="font-mono text-foreground">{grupo.melhorProdutora.codigo}</span>
          </>
        )}
      </p>
    </Cartao>
  );
}

export function HistoricoProducao() {
  const { filtros, params } = useFiltrosProducao();
  const { data: producoes, isLoading, error, refetch } = useProducoes(filtros);
  const { data: resumo } = useResumoProducao(filtros);
  const filtrando = params.size > 0;

  const acoes = (
    <>
      <LinkBotao to={`/app/producao/relatorio?${params}`} variante="secundario">
        <ChartColumn className="size-4" aria-hidden /> Relatório
      </LinkBotao>
      <LinkBotao to={`/app/producao/nova${filtros.coloniaId ? `?colonia=${filtros.coloniaId}` : ""}`} variante="destaque">
        <Plus className="size-4" aria-hidden /> Registrar colheita
      </LinkBotao>
    </>
  );

  return (
    <>
      <CabecalhoPagina titulo="Produção" subtitulo="Colheitas de mel, pólen, própolis e cera." acoes={acoes} />
      <BarraFiltrosProducao />

      {isLoading ? (
        <Carregando />
      ) : error || !producoes ? (
        <ErroCarregamento erro={error} tentarDeNovo={() => refetch()} />
      ) : producoes.length === 0 ? (
        <EstadoVazio
          icone={<Droplets className="size-10" />}
          titulo={filtrando ? "Nenhuma colheita nesse filtro" : "Nenhuma colheita registrada"}
          descricao={filtrando ? "Tente outro período, produto ou colônia." : "Registre a primeira colheita para acompanhar a produção do meliponário."}
          acao={!filtrando && <LinkBotao to="/app/producao/nova" variante="destaque">Registrar colheita</LinkBotao>}
        />
      ) : (
        <div className="space-y-4">
          {resumo && resumo.grupos.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {resumo.grupos.map((g) => (
                <CartaoTotal key={`${g.tipoProduto}-${g.unidade}`} grupo={g} />
              ))}
            </div>
          )}
          <Cartao className="p-0 md:p-0">
            <ul className="divide-y divide-border">
              {producoes.map((p) => (
                <ItemColheita key={p.id} producao={p} />
              ))}
            </ul>
          </Cartao>
          <p className="text-xs text-muted-foreground">Quantidades em ml e em g aparecem em totais separados: unidades diferentes nunca são somadas.</p>
        </div>
      )}
    </>
  );
}

function ItemColheita({ producao: p }: { producao: Producao }) {
  const queryClient = useQueryClient();
  const excluir = useMutation({
    mutationFn: () => producoesApi.excluir(p.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.producoes });
      queryClient.invalidateQueries({ queryKey: chaves.colonias });
    },
  });
  const caracteristicas = [p.caracteristicas?.cor, p.caracteristicas?.aroma, p.caracteristicas?.sabor].filter(Boolean).join(" · ");

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Selo className={COR_PRODUTO[p.tipoProduto]}>{ROTULO_PRODUTO[p.tipoProduto]}</Selo>
          <span className="font-semibold text-foreground">{formatarQuantidade(p.quantidade, p.unidade)}</span>
          <span className="text-sm text-muted-foreground">{formatarData(p.dataColheita)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link to={`/app/colonias/${p.colonia.id}`} className="font-mono text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground">
            {p.colonia.codigo}
          </Link>
          {p.colonia.especie && ` · ${p.colonia.especie.nomePopular}`}
          {caracteristicas && ` · ${caracteristicas}`}
        </p>
        {p.observacoes && <p className="text-sm whitespace-pre-line text-muted-foreground">{p.observacoes}</p>}
        <MensagemErro erro={excluir.error} />
      </div>
      <div className="flex shrink-0 gap-1">
        <Link to={`/app/producao/${p.id}/editar`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Editar colheita" title="Editar">
          <Pencil className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => window.confirm("Excluir esta colheita? As fotos dela também serão apagadas.") && excluir.mutate()}
          disabled={excluir.isPending}
          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Excluir colheita"
          title="Excluir"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
