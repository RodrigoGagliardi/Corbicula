import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Botao, LinkBotao } from "../../components/ui/Botao";
import { CabecalhoPagina, Cartao, Selo } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useParametros } from "../../hooks/useDados";
import { parametrosApi } from "../../services/api/endpoints";
import type { Parametro } from "../../types/api";
import { PARAMETROS_SUGERIDOS } from "../../utils/parametrosSugeridos";

export function ListaParametros() {
  const queryClient = useQueryClient();
  const boasVindas = (useLocation().state as { boasVindas?: boolean } | null)?.boasVindas;
  const { data: parametros, isLoading, error, refetch } = useParametros();
  const invalidar = () => queryClient.invalidateQueries({ queryKey: chaves.parametros });

  const usarSugeridos = useMutation({
    mutationFn: async () => {
      for (const p of PARAMETROS_SUGERIDOS) await parametrosApi.criar(p);
    },
    onSettled: invalidar,
  });

  const alterar = useMutation({
    mutationFn: (mudancas: { id: string; dados: Partial<Parametro> }[]) =>
      Promise.all(mudancas.map((m) => parametrosApi.atualizar(m.id, m.dados))),
    onSettled: invalidar,
  });

  const excluir = useMutation({ mutationFn: parametrosApi.excluir, onSettled: invalidar });

  const acoes = (
    <LinkBotao to="/parametros/novo">
      <Plus className="size-4" aria-hidden /> Novo parâmetro
    </LinkBotao>
  );

  if (isLoading) return <><CabecalhoPagina titulo="Parâmetros" /><Carregando /></>;
  if (error || !parametros) return <ErroCarregamento erro={error} tentarDeNovo={() => refetch()} />;

  // Troca a ordem com o vizinho. Reatribui 1..n a todos para corrigir empates antigos.
  const mover = (indice: number, direcao: -1 | 1) => {
    const lista = [...parametros];
    const alvo = indice + direcao;
    [lista[indice], lista[alvo]] = [lista[alvo]!, lista[indice]!];
    const mudancas = lista
      .map((p, i) => ({ id: p.id, ordemNova: i + 1, ordemAtual: p.ordem }))
      .filter((p) => p.ordemNova !== p.ordemAtual)
      .map((p) => ({ id: p.id, dados: { ordem: p.ordemNova } }));
    alterar.mutate(mudancas);
  };

  const ativos = parametros.filter((p) => p.ativo).length;

  return (
    <>
      <CabecalhoPagina
        titulo="Parâmetros"
        subtitulo="O que você observa em cada inspeção. Cada parâmetro é classificado como Bom, Médio ou Ruim."
        acoes={parametros.length > 0 ? acoes : undefined}
      />

      {parametros.length === 0 ? (
        <Cartao className="space-y-4 text-center">
          <Sparkles className="mx-auto size-10 text-mel-600" aria-hidden />
          <h2 className="text-lg font-semibold">{boasVindas ? "Bem-vindo(a) ao Corbicula!" : "Nenhum parâmetro ainda"}</h2>
          <p className="mx-auto max-w-md text-stone-600">
            Comece com um conjunto sugerido de 5 parâmetros (fluxo de entrada, potes de mel, discos de cria, condição da
            rainha e sanidade) — dá para editar tudo depois — ou crie os seus.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Botao onClick={() => usarSugeridos.mutate()} carregando={usarSugeridos.isPending}>
              Usar parâmetros sugeridos
            </Botao>
            <LinkBotao to="/parametros/novo" variante="secundario">
              Criar do zero
            </LinkBotao>
          </div>
          <MensagemErro erro={usarSugeridos.error} />
        </Cartao>
      ) : (
        <>
          <MensagemErro erro={alterar.error ?? excluir.error} />
          <ol className="space-y-3">
            {parametros.map((p, i) => {
              const usos = p._count.avaliacoesParametros;
              return (
                <li key={p.id}>
                  <Cartao className={p.ativo ? "" : "bg-stone-50 opacity-75"}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-stone-900">
                          <span className="mr-1 text-stone-400">{i + 1}.</span> {p.nome}
                        </h2>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {!p.ativo && <Selo className="bg-stone-200 text-stone-600">Inativo</Selo>}
                          {p.criteriosEspecie.length > 0 && (
                            <Selo className="bg-mel-100 text-mel-900">
                              Critérios próprios p/ {p.criteriosEspecie.length} espécie(s)
                            </Selo>
                          )}
                          <Selo className="bg-stone-100 text-stone-500">
                            {usos === 0 ? "Nunca usado" : `Usado em ${usos} avaliação(ões)`}
                          </Selo>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <IconeBotao rotulo="Subir" disabled={i === 0 || alterar.isPending} onClick={() => mover(i, -1)}>
                          <ArrowUp className="size-4" />
                        </IconeBotao>
                        <IconeBotao
                          rotulo="Descer"
                          disabled={i === parametros.length - 1 || alterar.isPending}
                          onClick={() => mover(i, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </IconeBotao>
                        <Link to={`/parametros/${p.id}/editar`} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label={`Editar ${p.nome}`}>
                          <Pencil className="size-4" />
                        </Link>
                        {usos === 0 && (
                          <IconeBotao
                            rotulo={`Excluir ${p.nome}`}
                            onClick={() => confirm(`Excluir o parâmetro "${p.nome}"?`) && excluir.mutate(p.id)}
                          >
                            <Trash2 className="size-4" />
                          </IconeBotao>
                        )}
                      </div>
                    </div>
                    <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-3 sm:gap-3">
                      <Criterio rotulo="Bom" texto={p.criterioBom} cor="text-excelente" />
                      <Criterio rotulo="Médio" texto={p.criterioMedio} cor="text-atencao" />
                      <Criterio rotulo="Ruim" texto={p.criterioRuim} cor="text-critica" />
                    </dl>
                    <label className="mt-3 inline-flex items-center gap-2 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        className="size-4 accent-mel-700"
                        checked={p.ativo}
                        disabled={alterar.isPending || (p.ativo && ativos === 1)}
                        onChange={(e) => alterar.mutate([{ id: p.id, dados: { ativo: e.target.checked } }])}
                      />
                      Ativo (aparece nas novas avaliações)
                    </label>
                  </Cartao>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-sm text-stone-500">
            Parâmetros já usados em avaliações não podem ser excluídos (preserva o histórico) — desative-os.
          </p>
        </>
      )}
    </>
  );
}

function Criterio({ rotulo, texto, cor }: { rotulo: string; texto: string; cor: string }) {
  return (
    <div>
      <dt className={`font-medium ${cor}`}>{rotulo}</dt>
      <dd className="text-stone-600">{texto}</dd>
    </div>
  );
}

function IconeBotao({
  rotulo,
  children,
  ...props
}: { rotulo: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={rotulo} title={rotulo} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-30" {...props}>
      {children}
    </button>
  );
}
