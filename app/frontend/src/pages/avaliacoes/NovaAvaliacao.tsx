import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, CloudSun, MessageSquarePlus, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { SeletorClassificacao } from "../../components/features/SeletorClassificacao";
import { SeloScore } from "../../components/features/SeloScore";
import { Botao, LinkBotao } from "../../components/ui/Botao";
import { AreaTexto, Campo, CLASSE_ENTRADA, Entrada } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, EstadoVazio, MensagemErro } from "../../components/ui/Estados";
import { chaves, useColonias, useParametros } from "../../hooks/useDados";
import { avaliacoesApi, fotosApi } from "../../services/api/endpoints";
import type { Classificacao, Colonia, Parametro } from "../../types/api";
import { correspondeBusca } from "../../utils/colonias";
import { paraInputDataHora, tempoRelativo } from "../../utils/format";
import { comprimirImagem } from "../../utils/imagem";
import { calcularScore } from "../../utils/score";

const ACOES = ["Alimentação artificial", "Limpeza realizada", "Divisão executada", "Tratamento aplicado", "Troca de caixa"];
const SUGESTOES_OBS = ["Colônia forte", "Rainha ativa", "Muitos forídeos", "Precisa limpeza", "Pouco alimento"];

export function NovaAvaliacao() {
  const [params, setParams] = useSearchParams();
  const coloniaId = params.get("colonia");
  const { data: colonias, isLoading, error } = useColonias();
  const parametros = useParametros();

  if (isLoading || parametros.isLoading) return <Carregando />;
  if (error || !colonias) return <ErroCarregamento erro={error} />;
  if (parametros.error || !parametros.data) return <ErroCarregamento erro={parametros.error} />;

  const ativos = parametros.data.filter((p) => p.ativo);
  if (ativos.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Nova avaliação" />
        <EstadoVazio
          icone={<SlidersHorizontal className="size-10" />}
          titulo="Nenhum parâmetro ativo"
          descricao="Defina o que você observa em cada inspeção (ex.: fluxo de entrada, potes de mel) antes de avaliar."
          acao={<LinkBotao to="/parametros">Configurar parâmetros</LinkBotao>}
        />
      </>
    );
  }

  const colonia = colonias.find((c) => c.id === coloniaId);
  if (!colonia) {
    return (
      <EscolherColonia
        colonias={colonias.filter((c) => c.status === "ativa")}
        onEscolher={(id) => setParams({ colonia: id })}
      />
    );
  }

  // key: trocar de colônia reinicia o formulário
  return <Formulario key={colonia.id} colonia={colonia} parametros={ativos} />;
}

// ─── Passo 1: escolher a colônia ─────────────────────────────────────────────

function EscolherColonia({ colonias, onEscolher }: { colonias: Colonia[]; onEscolher: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  const visiveis = colonias.filter((c) => correspondeBusca(c, busca));

  return (
    <>
      <CabecalhoPagina titulo="Nova avaliação" subtitulo="Qual colônia você vai inspecionar?" />
      {colonias.length === 0 ? (
        <EstadoVazio
          icone={<Search className="size-10" />}
          titulo="Nenhuma colônia ativa"
          acao={<LinkBotao to="/colonias/nova">Cadastrar colônia</LinkBotao>}
        />
      ) : (
        <>
          <input
            type="search"
            placeholder="Buscar colônia"
            aria-label="Buscar colônia"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${CLASSE_ENTRADA} mb-3`}
          />
          <ul className="space-y-2">
            {visiveis.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onEscolher(c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left hover:border-mel-300 hover:bg-mel-50"
                >
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-stone-900">{c.codigo}</p>
                    <p className="truncate text-sm text-stone-500">
                      {c.especie?.nomePopular ?? "Espécie não identificada"}
                      {c.localizacao && ` · ${c.localizacao}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-stone-500">
                    {c.ultimaAvaliacao ? `Avaliada ${tempoRelativo(c.ultimaAvaliacao.dataAvaliacao)}` : "Nunca avaliada"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ─── Passo 2: avaliar ────────────────────────────────────────────────────────

// Critério exibido: o específico da espécie da colônia, se configurado; senão o genérico.
function criteriosPara(p: Parametro, especieId: string | null) {
  const especifico = especieId ? p.criteriosEspecie.find((c) => c.especieId === especieId) : undefined;
  return especifico ?? p;
}

function Formulario({ colonia, parametros }: { colonia: Colonia; parametros: Parametro[] }) {
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const [classificacoes, setClassificacoes] = useState<Record<string, Classificacao>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [notaAberta, setNotaAberta] = useState<Record<string, boolean>>({});
  const [dataHora, setDataHora] = useState(() => paraInputDataHora(new Date()));
  const [observacoes, setObservacoes] = useState("");
  const [acoes, setAcoes] = useState<string[]>([]);
  const [foto, setFoto] = useState<File | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const avaliados = parametros.filter((p) => classificacoes[p.id]);
  const previa = useMemo(() => calcularScore(Object.values(classificacoes)), [classificacoes]);
  const faltam = parametros.length - avaliados.length;

  const salvar = useMutation({
    mutationFn: async () => {
      const avaliacao = await avaliacoesApi.criar(colonia.id, {
        dataAvaliacao: new Date(dataHora).toISOString(),
        parametros: avaliados.map((p) => ({
          parametroId: p.id,
          classificacao: classificacoes[p.id]!,
          observacoes: notas[p.id]?.trim() || null,
        })),
        observacoesGerais: observacoes.trim() || null,
        acoesTomadas: acoes.length ? acoes : null,
      });

      // A foto é enviada depois e nunca desfaz a avaliação: se falhar, a
      // avaliação continua salva e o aviso aparece no detalhe.
      let fotoFalhou = false;
      if (foto) {
        try {
          await fotosApi.enviar(await comprimirImagem(foto), { avaliacaoId: avaliacao.id });
        } catch {
          fotoFalhou = true;
        }
      }
      return { avaliacao, fotoFalhou };
    },
    onSuccess: ({ avaliacao, fotoFalhou }) => {
      queryClient.invalidateQueries({ queryKey: chaves.colonias });
      queryClient.invalidateQueries({ queryKey: ["fotos"] });
      navegar(`/colonias/${colonia.id}/avaliacoes/${avaliacao.id}`, { replace: true, state: { nova: true, fotoFalhou } });
    },
  });

  return (
    <>
      <CabecalhoPagina
        voltar={
          <Link to="/avaliacoes/nova" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="size-4" aria-hidden /> Trocar colônia
          </Link>
        }
        titulo={<span className="font-mono">{colonia.codigo}</span>}
        subtitulo={colonia.especie?.nomePopular ?? "Espécie não identificada"}
      />

      {/* Progresso + prévia do score, sempre visível no topo durante a rolagem */}
      <div className="sticky top-[57px] z-10 -mx-4 mb-4 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur md:top-0 md:mx-0 md:rounded-2xl md:border">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-stone-700">
            {avaliados.length} de {parametros.length} parâmetros
          </span>
          {previa ? <SeloScore score={previa.score} status={previa.status} /> : <span className="text-sm text-stone-400">Score: —</span>}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-mel-600 transition-all" style={{ width: `${(avaliados.length / parametros.length) * 100}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {parametros.map((p, i) => {
          const crit = criteriosPara(p, colonia.especieId);
          const escolhido = classificacoes[p.id];
          return (
            <Cartao key={p.id} className="space-y-3">
              <h2 className="font-semibold text-stone-900">
                <span className="mr-1 text-stone-400">{i + 1}.</span> {p.nome}
              </h2>
              <SeletorClassificacao
                rotulo={p.nome}
                valor={escolhido}
                onChange={(c) => setClassificacoes((atual) => ({ ...atual, [p.id]: c }))}
              />
              <dl className="space-y-1 text-sm">
                {(["bom", "medio", "ruim"] as const).map((c) => {
                  const texto = c === "bom" ? crit.criterioBom : c === "medio" ? crit.criterioMedio : crit.criterioRuim;
                  return (
                    <div key={c} className={`flex gap-2 ${escolhido && escolhido !== c ? "opacity-40" : ""}`}>
                      <dt className="w-12 shrink-0 font-medium text-stone-500">{c === "bom" ? "Bom" : c === "medio" ? "Médio" : "Ruim"}</dt>
                      <dd className="text-stone-700">{texto}</dd>
                    </div>
                  );
                })}
              </dl>
              {notaAberta[p.id] ? (
                <AreaTexto
                  aria-label={`Observação sobre ${p.nome}`}
                  placeholder="Observação (opcional)"
                  className="!min-h-16"
                  value={notas[p.id] ?? ""}
                  onChange={(e) => setNotas((n) => ({ ...n, [p.id]: e.target.value }))}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setNotaAberta((n) => ({ ...n, [p.id]: true }))}
                  className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
                >
                  <MessageSquarePlus className="size-4" aria-hidden /> Observação
                </button>
              )}
            </Cartao>
          );
        })}

        <Cartao className="space-y-4">
          <h2 className="font-semibold text-stone-900">Finalizar</h2>

          <Campo rotulo="Observações gerais">
            {(id) => (
              <>
                <AreaTexto id={id} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                <div className="flex flex-wrap gap-1.5">
                  {SUGESTOES_OBS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setObservacoes((o) => (o.trim() ? `${o.trim()}. ${s}` : s))}
                      className="rounded-full border border-stone-300 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Campo>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-700">Ações tomadas</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {ACOES.map((a) => (
                <label key={a} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-stone-50">
                  <input
                    type="checkbox"
                    className="size-5 accent-mel-700"
                    checked={acoes.includes(a)}
                    onChange={(e) => setAcoes((l) => (e.target.checked ? [...l, a] : l.filter((x) => x !== a)))}
                  />
                  {a}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">Foto da inspeção (opcional)</p>
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
            {foto ? (
              <div className="flex items-center gap-3">
                <PreviaFoto arquivo={foto} />
                <button type="button" onClick={() => setFoto(null)} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-red-700">
                  <X className="size-4" aria-hidden /> Remover
                </button>
              </div>
            ) : (
              <Botao type="button" variante="secundario" tamanho="sm" onClick={() => inputFoto.current?.click()}>
                <Camera className="size-4" aria-hidden /> Adicionar foto
              </Botao>
            )}
          </div>

          <Campo rotulo="Data e hora da inspeção">
            {(id) => (
              <Entrada
                id={id}
                type="datetime-local"
                max={paraInputDataHora(new Date())}
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
              />
            )}
          </Campo>

          <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <CloudSun className="mt-0.5 size-4 shrink-0" aria-hidden />
            Temperatura, umidade e condição do tempo são preenchidas automaticamente pela Open-Meteo, a partir das
            coordenadas da colônia ou do meliponário.
          </p>
        </Cartao>

        {faltam > 0 && avaliados.length > 0 && (
          <p className="text-sm text-mel-800">
            {faltam} parâmetro{faltam > 1 ? "s" : ""} sem classificação — {faltam > 1 ? "ficarão" : "ficará"} fora desta avaliação e do score.
          </p>
        )}
        <MensagemErro erro={salvar.error} />
        <Botao
          tamanho="lg"
          className="w-full"
          disabled={avaliados.length === 0}
          carregando={salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          Salvar avaliação
        </Botao>
      </div>
    </>
  );
}

// Prévia local da foto escolhida; libera a object URL ao trocar/desmontar.
function PreviaFoto({ arquivo }: { arquivo: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(arquivo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [arquivo]);
  return url ? <img src={url} alt="Prévia da foto" className="size-16 rounded-xl object-cover" /> : null;
}
