import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, Droplets, GitBranchPlus, Pencil, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { GraficoScore } from "../../components/charts/GraficoScore";
import { GaleriaFotos } from "../../components/features/GaleriaFotos";
import { BarraScore, SeloScore } from "../../components/features/SeloScore";
import { Botao, LinkBotao } from "../../components/ui/Botao";
import { CabecalhoPagina, Cartao, Selo } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useAvaliacoes, useColonia, useResumoProducao } from "../../hooks/useDados";
import { coloniasApi } from "../../services/api/endpoints";
import {
  formatarData,
  formatarDataHora,
  ROTULO_CAIXA,
  ROTULO_CLIMA,
  ROTULO_ORIGEM,
  ROTULO_STATUS_COLONIA,
  tempoRelativo,
} from "../../utils/format";
import { COR_PRODUTO, formatarQuantidade, ROTULO_PRODUTO } from "../../utils/producao";

export function DetalheColonia() {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const { data: colonia, isLoading, error, refetch } = useColonia(id);
  const { data: avaliacoes } = useAvaliacoes(id);

  const excluir = useMutation({
    mutationFn: () => coloniasApi.excluir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.colonias });
      navegar("/app/colonias", { replace: true });
    },
  });

  if (isLoading) return <Carregando />;
  if (error || !colonia) return <ErroCarregamento erro={error} tentarDeNovo={() => refetch()} />;

  const dim = colonia.dimensoesCaixa;
  const dimensoes = dim && [dim.altura, dim.largura, dim.profundidade].some(Boolean)
    ? [dim.altura, dim.largura, dim.profundidade].map((v) => v ?? "?").join(" × ") + " cm"
    : null;

  return (
    <>
      <CabecalhoPagina
        voltar={
          <Link to="/app/colonias" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Colônias
          </Link>
        }
        titulo={<span className="font-mono">{colonia.codigo}</span>}
        subtitulo={
          colonia.especie ? (
            <>
              {colonia.especie.nomePopular} · <i>{colonia.especie.nomeCientifico}</i>
            </>
          ) : (
            "Espécie não identificada"
          )
        }
        acoes={
          <>
            {colonia.status === "ativa" && (
              <LinkBotao to={`/app/avaliacoes/nova?colonia=${colonia.id}`} variante="destaque">
                <ClipboardCheck className="size-4" aria-hidden /> Avaliar
              </LinkBotao>
            )}
            <LinkBotao to={`/app/colonias/${colonia.id}/editar`} variante="secundario">
              <Pencil className="size-4" aria-hidden /> Editar
            </LinkBotao>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Cartao className="md:col-span-2">
          <h2 className="mb-3 font-semibold text-foreground">Estado atual</h2>
          {colonia.ultimaAvaliacao ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SeloScore score={colonia.ultimaAvaliacao.scoreGeral} status={colonia.ultimaAvaliacao.statusGeral} />
                <span className="text-sm text-muted-foreground">
                  Última avaliação {tempoRelativo(colonia.ultimaAvaliacao.dataAvaliacao)} (
                  {formatarData(colonia.ultimaAvaliacao.dataAvaliacao)})
                </span>
              </div>
              <BarraScore score={colonia.ultimaAvaliacao.scoreGeral} status={colonia.ultimaAvaliacao.statusGeral} />
              {avaliacoes && <GraficoScore avaliacoes={avaliacoes} />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda sem avaliações.</p>
          )}
        </Cartao>

        <Cartao>
          <h2 className="mb-3 font-semibold text-foreground">Informações</h2>
          <dl className="space-y-2 text-sm">
            <Info rotulo="Status">
              <Selo className="bg-muted text-foreground">{ROTULO_STATUS_COLONIA[colonia.status]}</Selo>
            </Info>
            <Info rotulo="Entrada">{formatarData(colonia.dataEntrada)}</Info>
            <Info rotulo="Origem">{ROTULO_ORIGEM[colonia.origem]}</Info>
            <Info rotulo="Caixa">
              {ROTULO_CAIXA[colonia.tipoCaixa]}
              {dimensoes && <span className="text-muted-foreground"> · {dimensoes}</span>}
            </Info>
            {colonia.localizacao && <Info rotulo="Local">{colonia.localizacao}</Info>}
            {colonia.latitude !== null && colonia.longitude !== null && (
              <Info rotulo="Coordenadas">
                {colonia.latitude.toFixed(5)}, {colonia.longitude.toFixed(5)}
              </Info>
            )}
          </dl>
          {colonia.observacoes && <p className="mt-3 border-t border-border pt-3 text-sm whitespace-pre-line text-muted-foreground">{colonia.observacoes}</p>}
        </Cartao>

        <Cartao>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Genealogia</h2>
            <Link to={`/app/colonias/nova?mae=${colonia.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground">
              <GitBranchPlus className="size-4" aria-hidden /> Registrar divisão
            </Link>
          </div>
          <dl className="space-y-2 text-sm">
            <Info rotulo="Mãe">
              {colonia.coloniaMae ? (
                <Link to={`/app/colonias/${colonia.coloniaMae.id}`} className="font-mono text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground">
                  {colonia.coloniaMae.codigo}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Info>
            <Info rotulo="Filhas">
              {colonia.coloniasFilhas.length ? (
                <span className="flex flex-wrap justify-end gap-x-2">
                  {colonia.coloniasFilhas.map((f) => (
                    <Link key={f.id} to={`/app/colonias/${f.id}`} className="font-mono text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground">
                      {f.codigo}
                    </Link>
                  ))}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Info>
            {colonia.coloniaDoadoraCampeiras && (
              <Info rotulo="Doadora de campeiras">
                <Link to={`/app/colonias/${colonia.coloniaDoadoraCampeiras.id}`} className="font-mono text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground">
                  {colonia.coloniaDoadoraCampeiras.codigo}
                </Link>
              </Info>
            )}
            {colonia.coloniasReceptorasCampeiras.length > 0 && (
              <Info rotulo="Doou campeiras para">
                <span className="flex flex-wrap justify-end gap-x-2">
                  {colonia.coloniasReceptorasCampeiras.map((r) => (
                    <Link key={r.id} to={`/app/colonias/${r.id}`} className="font-mono text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground">
                      {r.codigo}
                    </Link>
                  ))}
                </span>
              </Info>
            )}
          </dl>
        </Cartao>

        <Cartao className="md:col-span-2">
          <h2 className="mb-3 font-semibold text-foreground">Avaliações ({avaliacoes?.length ?? 0})</h2>
          {!avaliacoes?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação registrada.</p>
          ) : (
            <ul className="divide-y divide-border">
              {avaliacoes.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/app/colonias/${colonia.id}/avaliacoes/${a.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-background"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{formatarDataHora(a.dataAvaliacao)}</p>
                      <p className="text-xs text-muted-foreground">
                        {a._count.parametros} parâmetros
                        {a.condicaoClimatica && ` · ${ROTULO_CLIMA[a.condicaoClimatica]}`}
                        {a.temperatura !== null && ` · ${a.temperatura} °C`}
                      </p>
                    </div>
                    <SeloScore score={a.scoreGeral} status={a.statusGeral} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <CartaoProducao coloniaId={colonia.id} ativa={colonia.status === "ativa"} />

        <Cartao className="md:col-span-3">
          <h2 className="mb-3 font-semibold text-foreground">Fotos</h2>
          <GaleriaFotos vinculo={{ coloniaId: colonia.id }} />
        </Cartao>
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <Botao
          variante="fantasma"
          tamanho="sm"
          className="text-destructive hover:bg-destructive/10"
          carregando={excluir.isPending}
          onClick={() => {
            if (confirm(`Excluir a colônia ${colonia.codigo}? Esta ação não pode ser desfeita.`)) excluir.mutate();
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Excluir colônia
        </Botao>
        <p className="mt-1 text-xs text-muted-foreground">
          Colônias com avaliações não podem ser excluídas — para encerrar, edite e marque como “Morta”; o histórico é preservado.
        </p>
        <div className="mt-2">
          <MensagemErro erro={excluir.error} />
        </div>
      </div>
    </>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}

// Totais de produção da colônia (um por produto + unidade; ml e g não se somam).
function CartaoProducao({ coloniaId, ativa }: { coloniaId: string; ativa: boolean }) {
  const { data: resumo } = useResumoProducao({ coloniaId });
  const grupos = resumo?.grupos ?? [];
  return (
    <Cartao>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Produção</h2>
        {ativa && (
          <Link
            to={`/app/producao/nova?colonia=${coloniaId}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground"
          >
            <Plus className="size-4" aria-hidden /> Colheita
          </Link>
        )}
      </div>
      {grupos.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Droplets className="size-4" aria-hidden /> Nenhuma colheita registrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {grupos.map((g) => (
            <li key={`${g.tipoProduto}-${g.unidade}`} className="flex items-center justify-between gap-2 text-sm">
              <Selo className={COR_PRODUTO[g.tipoProduto]}>{ROTULO_PRODUTO[g.tipoProduto]}</Selo>
              <span className="text-foreground">
                <b>{formatarQuantidade(g.total, g.unidade)}</b>
                <span className="text-muted-foreground"> · {g.colheitas}×</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {grupos.length > 0 && (
        <Link to={`/app/producao?colonia=${coloniaId}`} className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline">
          Ver colheitas
        </Link>
      )}
    </Cartao>
  );
}
