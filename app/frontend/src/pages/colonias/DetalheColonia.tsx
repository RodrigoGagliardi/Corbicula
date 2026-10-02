import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, GitBranchPlus, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { GraficoScore } from "../../components/charts/GraficoScore";
import { GaleriaFotos } from "../../components/features/GaleriaFotos";
import { BarraScore, SeloScore } from "../../components/features/SeloScore";
import { Botao, LinkBotao } from "../../components/ui/Botao";
import { CabecalhoPagina, Cartao, Selo } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useAvaliacoes, useColonia } from "../../hooks/useDados";
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
      navegar("/colonias", { replace: true });
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
          <Link to="/colonias" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
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
              <LinkBotao to={`/avaliacoes/nova?colonia=${colonia.id}`}>
                <ClipboardCheck className="size-4" aria-hidden /> Avaliar
              </LinkBotao>
            )}
            <LinkBotao to={`/colonias/${colonia.id}/editar`} variante="secundario">
              <Pencil className="size-4" aria-hidden /> Editar
            </LinkBotao>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Cartao className="md:col-span-2">
          <h2 className="mb-3 font-semibold text-stone-800">Estado atual</h2>
          {colonia.ultimaAvaliacao ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SeloScore score={colonia.ultimaAvaliacao.scoreGeral} status={colonia.ultimaAvaliacao.statusGeral} />
                <span className="text-sm text-stone-500">
                  Última avaliação {tempoRelativo(colonia.ultimaAvaliacao.dataAvaliacao)} (
                  {formatarData(colonia.ultimaAvaliacao.dataAvaliacao)})
                </span>
              </div>
              <BarraScore score={colonia.ultimaAvaliacao.scoreGeral} status={colonia.ultimaAvaliacao.statusGeral} />
              {avaliacoes && <GraficoScore avaliacoes={avaliacoes} />}
            </div>
          ) : (
            <p className="text-sm text-stone-500">Ainda sem avaliações.</p>
          )}
        </Cartao>

        <Cartao>
          <h2 className="mb-3 font-semibold text-stone-800">Informações</h2>
          <dl className="space-y-2 text-sm">
            <Info rotulo="Status">
              <Selo className="bg-stone-100 text-stone-700">{ROTULO_STATUS_COLONIA[colonia.status]}</Selo>
            </Info>
            <Info rotulo="Entrada">{formatarData(colonia.dataEntrada)}</Info>
            <Info rotulo="Origem">{ROTULO_ORIGEM[colonia.origem]}</Info>
            <Info rotulo="Caixa">
              {ROTULO_CAIXA[colonia.tipoCaixa]}
              {dimensoes && <span className="text-stone-500"> · {dimensoes}</span>}
            </Info>
            {colonia.localizacao && <Info rotulo="Local">{colonia.localizacao}</Info>}
            {colonia.latitude !== null && colonia.longitude !== null && (
              <Info rotulo="Coordenadas">
                {colonia.latitude.toFixed(5)}, {colonia.longitude.toFixed(5)}
              </Info>
            )}
          </dl>
          {colonia.observacoes && <p className="mt-3 border-t border-stone-100 pt-3 text-sm whitespace-pre-line text-stone-600">{colonia.observacoes}</p>}
        </Cartao>

        <Cartao>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-stone-800">Genealogia</h2>
            <Link to={`/colonias/nova?mae=${colonia.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-mel-800 hover:underline">
              <GitBranchPlus className="size-4" aria-hidden /> Registrar divisão
            </Link>
          </div>
          <dl className="space-y-2 text-sm">
            <Info rotulo="Mãe">
              {colonia.coloniaMae ? (
                <Link to={`/colonias/${colonia.coloniaMae.id}`} className="font-mono text-mel-800 hover:underline">
                  {colonia.coloniaMae.codigo}
                </Link>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </Info>
            <Info rotulo="Filhas">
              {colonia.coloniasFilhas.length ? (
                <span className="flex flex-wrap justify-end gap-x-2">
                  {colonia.coloniasFilhas.map((f) => (
                    <Link key={f.id} to={`/colonias/${f.id}`} className="font-mono text-mel-800 hover:underline">
                      {f.codigo}
                    </Link>
                  ))}
                </span>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </Info>
          </dl>
        </Cartao>

        <Cartao className="md:col-span-2">
          <h2 className="mb-3 font-semibold text-stone-800">Avaliações ({avaliacoes?.length ?? 0})</h2>
          {!avaliacoes?.length ? (
            <p className="text-sm text-stone-500">Nenhuma avaliação registrada.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {avaliacoes.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/colonias/${colonia.id}/avaliacoes/${a.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-stone-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-800">{formatarDataHora(a.dataAvaliacao)}</p>
                      <p className="text-xs text-stone-500">
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

        <Cartao className="md:col-span-3">
          <h2 className="mb-3 font-semibold text-stone-800">Fotos</h2>
          <GaleriaFotos vinculo={{ coloniaId: colonia.id }} />
        </Cartao>
      </div>

      <div className="mt-8 border-t border-stone-200 pt-6">
        <Botao
          variante="fantasma"
          tamanho="sm"
          className="text-red-700 hover:bg-red-50"
          carregando={excluir.isPending}
          onClick={() => {
            if (confirm(`Excluir a colônia ${colonia.codigo}? Esta ação não pode ser desfeita.`)) excluir.mutate();
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Excluir colônia
        </Botao>
        <p className="mt-1 text-xs text-stone-500">
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
      <dt className="text-stone-500">{rotulo}</dt>
      <dd className="text-right text-stone-800">{children}</dd>
    </div>
  );
}
