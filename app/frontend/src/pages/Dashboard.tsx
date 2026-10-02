import { AlertTriangle, ClipboardCheck, Hexagon, Plus } from "lucide-react";
import { Link } from "react-router";
import { SeloScore } from "../components/features/SeloScore";
import { LinkBotao } from "../components/ui/Botao";
import { CabecalhoPagina, Cartao } from "../components/ui/Cartao";
import { Carregando, ErroCarregamento, EstadoVazio } from "../components/ui/Estados";
import { useColonias } from "../hooks/useDados";
import { useAuth } from "../store/auth";
import type { StatusAvaliacao } from "../types/api";
import { precisaAtencao } from "../utils/colonias";
import { COR_STATUS, ROTULO_STATUS } from "../utils/score";

const ORDEM_STATUS: StatusAvaliacao[] = ["excelente", "boa", "atencao", "critica"];

export function Dashboard() {
  const usuario = useAuth((s) => s.usuario);
  const { data: colonias, isLoading, error, refetch } = useColonias();

  const cabecalho = (
    <CabecalhoPagina
      titulo={usuario?.meliponario?.nome ?? "Meu meliponário"}
      subtitulo={`Olá, ${usuario?.name.split(" ")[0] ?? ""}!`}
      acoes={
        <LinkBotao to="/avaliacoes/nova" tamanho="md">
          <ClipboardCheck className="size-4" aria-hidden /> Nova avaliação
        </LinkBotao>
      }
    />
  );

  if (isLoading) return <>{cabecalho}<Carregando /></>;
  if (error || !colonias) return <>{cabecalho}<ErroCarregamento erro={error} tentarDeNovo={() => refetch()} /></>;

  if (colonias.length === 0) {
    return (
      <>
        {cabecalho}
        <EstadoVazio
          icone={<Hexagon className="size-10" />}
          titulo="Nenhuma colônia cadastrada"
          descricao="Cadastre sua primeira colônia para começar a registrar avaliações."
          acao={
            <LinkBotao to="/colonias/nova">
              <Plus className="size-4" aria-hidden /> Cadastrar colônia
            </LinkBotao>
          }
        />
      </>
    );
  }

  const ativas = colonias.filter((c) => c.status === "ativa");
  const avaliadas = ativas.filter((c) => c.ultimaAvaliacao);
  const porStatus = Object.fromEntries(
    ORDEM_STATUS.map((s) => [s, avaliadas.filter((c) => c.ultimaAvaliacao!.statusGeral === s).length])
  ) as Record<StatusAvaliacao, number>;
  const mediaScore = avaliadas.length
    ? Math.round(avaliadas.reduce((acc, c) => acc + c.ultimaAvaliacao!.scoreGeral, 0) / avaliadas.length)
    : null;
  const atencao = ativas.map((c) => ({ colonia: c, alerta: precisaAtencao(c) })).filter((x) => x.alerta);

  const porEspecie = new Map<string, number>();
  for (const c of ativas) {
    const nome = c.especie?.nomePopular ?? "Não identificada";
    porEspecie.set(nome, (porEspecie.get(nome) ?? 0) + 1);
  }
  const especies = [...porEspecie.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      {cabecalho}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Resumo rotulo="Colônias ativas" valor={ativas.length} detalhe={`${colonias.length - ativas.length} inativas/mortas`} />
        <Resumo
          rotulo="Score médio atual"
          valor={mediaScore ?? "—"}
          detalhe={`${avaliadas.length} de ${ativas.length} avaliadas`}
        />
        <Resumo rotulo="Precisam de atenção" valor={atencao.length} detalhe="críticas, em atenção ou atrasadas" />
        <Resumo rotulo="Espécies" valor={especies.length} detalhe="entre as colônias ativas" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Cartao>
          <h2 className="mb-3 font-semibold text-stone-800">Status das colônias ativas</h2>
          {avaliadas.length === 0 ? (
            <p className="text-sm text-stone-500">Nenhuma colônia ativa avaliada ainda.</p>
          ) : (
            <ul className="space-y-2.5">
              {ORDEM_STATUS.map((s) => {
                const pct = Math.round((porStatus[s] / avaliadas.length) * 100);
                return (
                  <li key={s}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className={`font-medium ${COR_STATUS[s].texto}`}>{ROTULO_STATUS[s]}</span>
                      <span className="text-stone-500">
                        {porStatus[s]} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-full rounded-full ${COR_STATUS[s].barra}`} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-stone-400">Considera a avaliação mais recente de cada colônia.</p>
        </Cartao>

        <Cartao>
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
            <AlertTriangle className="size-4 text-atencao" aria-hidden /> Precisam de atenção
          </h2>
          {atencao.length === 0 ? (
            <p className="text-sm text-stone-500">Tudo em dia. 🐝</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {atencao.slice(0, 5).map(({ colonia, alerta }) => (
                <li key={colonia.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link to={`/colonias/${colonia.id}`} className="font-mono font-medium hover:underline">
                      {colonia.codigo}
                    </Link>
                    <p className="truncate text-sm text-stone-500">{alerta!.motivo}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {colonia.ultimaAvaliacao && (
                      <SeloScore score={colonia.ultimaAvaliacao.scoreGeral} status={colonia.ultimaAvaliacao.statusGeral} />
                    )}
                    <Link
                      to={`/avaliacoes/nova?colonia=${colonia.id}`}
                      className="rounded-lg px-2 py-1 text-sm font-medium text-mel-800 hover:bg-mel-50"
                    >
                      Avaliar
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao className="md:col-span-2">
          <h2 className="mb-3 font-semibold text-stone-800">Colônias ativas por espécie</h2>
          <ul className="space-y-2">
            {especies.map(([nome, qtd]) => (
              <li key={nome} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-stone-700">{nome}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-mel-500" style={{ width: `${(qtd / ativas.length) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-stone-500">{qtd}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </>
  );
}

function Resumo({ rotulo, valor, detalhe }: { rotulo: string; valor: number | string; detalhe: string }) {
  return (
    <Cartao className="!p-4">
      <p className="text-sm text-stone-500">{rotulo}</p>
      <p className="mt-1 text-3xl font-bold text-stone-900">{valor}</p>
      <p className="mt-1 text-xs text-stone-400">{detalhe}</p>
    </Cartao>
  );
}
