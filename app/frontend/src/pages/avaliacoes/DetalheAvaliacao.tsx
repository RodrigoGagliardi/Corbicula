import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, CloudSun, Minus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { GaleriaFotos } from "../../components/features/GaleriaFotos";
import { BarraScore } from "../../components/features/SeloScore";
import { Botao } from "../../components/ui/Botao";
import { CabecalhoPagina, Cartao, Selo } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useAvaliacao, useAvaliacoes, useColonia } from "../../hooks/useDados";
import { avaliacoesApi } from "../../services/api/endpoints";
import type { Classificacao } from "../../types/api";
import { formatarDataHora, ROTULO_CLIMA } from "../../utils/format";
import { COR_STATUS, ROTULO_CLASSIFICACAO, ROTULO_STATUS } from "../../utils/score";

const COR_CLASSIFICACAO: Record<Classificacao, string> = {
  bom: "bg-green-100 text-green-800",
  medio: "bg-amber-100 text-amber-800",
  ruim: "bg-red-100 text-red-800",
};

export function DetalheAvaliacao() {
  const { coloniaId = "", id = "" } = useParams();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const estado = useLocation().state as { nova?: boolean; fotoFalhou?: boolean } | null;
  const { data: avaliacao, isLoading, error, refetch } = useAvaliacao(coloniaId, id);
  const { data: colonia } = useColonia(coloniaId);
  const { data: historico } = useAvaliacoes(coloniaId);

  // O clima chega segundos depois de salvar (enriquecimento assíncrono no
  // backend). Numa avaliação recém-criada, busca de novo algumas vezes.
  const semClima = avaliacao && avaliacao.temperatura === null && avaliacao.condicaoClimatica === null;
  const [tentativasClima, setTentativasClima] = useState(0);
  useEffect(() => {
    if (!estado?.nova || !semClima || tentativasClima >= 3) return;
    const t = setTimeout(() => {
      setTentativasClima((n) => n + 1);
      void refetch();
    }, 3000);
    return () => clearTimeout(t);
  }, [estado?.nova, semClima, tentativasClima, refetch]);

  const excluir = useMutation({
    mutationFn: () => avaliacoesApi.excluir(coloniaId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.colonias });
      navegar(`/colonias/${coloniaId}`, { replace: true });
    },
  });

  if (isLoading) return <Carregando />;
  if (error || !avaliacao) return <ErroCarregamento erro={error} tentarDeNovo={() => refetch()} />;

  // Avaliação imediatamente anterior (por data da inspeção) para comparação.
  const anterior = historico
    ?.filter((a) => a.dataAvaliacao < avaliacao.dataAvaliacao)
    .sort((a, b) => b.dataAvaliacao.localeCompare(a.dataAvaliacao))[0];
  const diferenca = anterior ? avaliacao.scoreGeral - anterior.scoreGeral : null;
  const cor = COR_STATUS[avaliacao.statusGeral];
  const temClima = avaliacao.temperatura !== null || avaliacao.condicaoClimatica !== null;

  return (
    <>
      <CabecalhoPagina
        voltar={
          <Link to={`/colonias/${coloniaId}`} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="size-4" aria-hidden /> {colonia?.codigo ?? "Colônia"}
          </Link>
        }
        titulo="Avaliação"
        subtitulo={formatarDataHora(avaliacao.dataAvaliacao)}
      />

      {estado?.nova && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          <CheckCircle2 className="size-4" aria-hidden /> Avaliação salva.
          {estado.fotoFalhou && " A foto não pôde ser enviada — tente adicioná-la abaixo."}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Cartao className={`${cor.fundo} border-transparent`}>
          <p className="text-sm text-stone-600">Score</p>
          <p className={`text-5xl font-bold ${cor.texto}`}>{avaliacao.scoreGeral}</p>
          <p className={`font-semibold ${cor.texto}`}>{ROTULO_STATUS[avaliacao.statusGeral]}</p>
          <div className="mt-3">
            <BarraScore score={avaliacao.scoreGeral} status={avaliacao.statusGeral} />
          </div>
          {diferenca !== null && (
            <p className="mt-3 flex items-center gap-1 text-sm text-stone-600">
              {diferenca > 0 ? (
                <ArrowUp className="size-4 text-excelente" aria-hidden />
              ) : diferenca < 0 ? (
                <ArrowDown className="size-4 text-critica" aria-hidden />
              ) : (
                <Minus className="size-4" aria-hidden />
              )}
              {diferenca === 0 ? "Igual à" : `${diferenca > 0 ? "+" : ""}${diferenca} em relação à`} avaliação anterior
            </p>
          )}
        </Cartao>

        <Cartao className="md:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
            <CloudSun className="size-4" aria-hidden /> Clima no momento da inspeção
          </h2>
          {temClima ? (
            <dl className="grid grid-cols-3 gap-3 text-center">
              <Dado rotulo="Temperatura" valor={avaliacao.temperatura !== null ? `${avaliacao.temperatura} °C` : "—"} />
              <Dado rotulo="Umidade" valor={avaliacao.umidade !== null ? `${avaliacao.umidade}%` : "—"} />
              <Dado rotulo="Condição" valor={avaliacao.condicaoClimatica ? ROTULO_CLIMA[avaliacao.condicaoClimatica] : "—"} />
            </dl>
          ) : (
            <p className="text-sm text-stone-500">
              Ainda não disponível. O clima é buscado automaticamente em segundo plano; se a colônia e o meliponário não
              tiverem coordenadas, ele não pode ser obtido.
            </p>
          )}
          <p className="mt-3 text-xs text-stone-400">Dados: Open-Meteo.com (CC BY 4.0)</p>
        </Cartao>

        <Cartao className="md:col-span-3">
          <h2 className="mb-3 font-semibold text-stone-800">Parâmetros avaliados</h2>
          <ul className="divide-y divide-stone-100">
            {avaliacao.parametros.map((p) => (
              <li key={p.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-stone-800">{p.parametro.nome}</span>
                  <Selo className={COR_CLASSIFICACAO[p.classificacao]}>{ROTULO_CLASSIFICACAO[p.classificacao]}</Selo>
                </div>
                {p.observacoes && <p className="mt-1 text-sm text-stone-500">{p.observacoes}</p>}
              </li>
            ))}
          </ul>
        </Cartao>

        {(avaliacao.observacoesGerais || avaliacao.acoesTomadas.length > 0) && (
          <Cartao className="md:col-span-3 space-y-3">
            {avaliacao.observacoesGerais && (
              <div>
                <h2 className="mb-1 font-semibold text-stone-800">Observações</h2>
                <p className="text-sm whitespace-pre-line text-stone-700">{avaliacao.observacoesGerais}</p>
              </div>
            )}
            {avaliacao.acoesTomadas.length > 0 && (
              <div>
                <h2 className="mb-1 font-semibold text-stone-800">Ações tomadas</h2>
                <ul className="flex flex-wrap gap-1.5">
                  {avaliacao.acoesTomadas.map((a) => (
                    <li key={a}>
                      <Selo className="bg-stone-100 text-stone-700">{a}</Selo>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Cartao>
        )}

        <Cartao className="md:col-span-3">
          <h2 className="mb-3 font-semibold text-stone-800">Fotos</h2>
          <GaleriaFotos vinculo={{ avaliacaoId: avaliacao.id }} />
        </Cartao>
      </div>

      <div className="mt-8 border-t border-stone-200 pt-6">
        <Botao
          variante="fantasma"
          tamanho="sm"
          className="text-red-700 hover:bg-red-50"
          carregando={excluir.isPending}
          onClick={() => {
            if (confirm("Excluir esta avaliação e suas fotos? Esta ação não pode ser desfeita.")) excluir.mutate();
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Excluir avaliação
        </Botao>
        <div className="mt-2">
          <MensagemErro erro={excluir.error} />
        </div>
      </div>
    </>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-2 py-3">
      <dt className="text-xs text-stone-500">{rotulo}</dt>
      <dd className="mt-0.5 font-semibold text-stone-800">{valor}</dd>
    </div>
  );
}
