import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { Botao, LinkBotao } from "../../components/ui/Botao";
import { CabecalhoPagina, Cartao, Selo } from "../../components/ui/Cartao";
import { Carregando, MensagemErro } from "../../components/ui/Estados";
import { useEspecies } from "../../hooks/useDados";
import { descartarPendencia, listarPendencias, manterAparelho, manterServidor, type Pendencia } from "../../services/offline/decisoes";
import { useAuth } from "../../store/auth";
import { formatarValorCampo, rotuloCampo, type ContextoValores } from "../../utils/pendencias";
import { VoltarConfiguracoes } from "./Configuracoes";
import { abrirBanco, indexedDbDisponivel } from "../../services/offline/banco";

// Tela 35 — Sincronização. Nesta etapa, a seção de pendências: mudanças que o
// servidor recusou ou que conflitam com outra versão no mesmo campo, com as
// decisões do usuário (CAP-6). Status, progresso e espaço usado vêm depois.

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// Nomes para os ids que aparecem nos valores (parâmetros, colônias, espécies).
function useNomes(): ContextoValores {
  const usuarioId = useAuth((s) => s.usuario?.id);
  const { data: especies } = useEspecies();
  const { data: nomes = {} } = useQuery({
    queryKey: ["sincronizacao", "nomes", usuarioId],
    enabled: Boolean(usuarioId) && indexedDbDisponivel(),
    queryFn: async () => {
      const db = await abrirBanco(usuarioId!);
      const [parametros, colonias] = await Promise.all([db.getAll("parametros"), db.getAll("colonias")]);
      return Object.fromEntries([...parametros.map((p) => [p.id, p.nome]), ...colonias.map((c) => [c.id, c.codigo])]);
    },
  });
  return { nomes: { ...nomes, ...Object.fromEntries((especies ?? []).map((e) => [e.id, e.nomePopular])) } };
}

function CartaoPendencia({ pendencia, ctx }: { pendencia: Pendencia; ctx: ContextoValores }) {
  const queryClient = useQueryClient();
  const { op, rotulo, rotaEdicao, rotaDetalhe, seguintes, dependentes } = pendencia;
  // Relê tudo também numa falha (ex.: pendência já resolvida em outra aba).
  const decidir = useMutation({
    mutationFn: ({ acao }: { nome: string; acao: () => Promise<void> }) => acao(),
    onSettled: () => queryClient.invalidateQueries(),
  });
  const girando = (nome: string) => decidir.isPending && decidir.variables?.nome === nome;
  const conflito = op.estado === "conflito";

  const confirmarServidor = () => {
    const extra = seguintes > 0 ? `\n\n${plural(seguintes, "outra edição", "outras edições")} deste registro feitas no aparelho também serão descartadas.` : "";
    if (window.confirm(`Manter a versão do servidor e descartar a do aparelho?${extra}`)) {
      decidir.mutate({ nome: "servidor", acao: () => manterServidor(op.id) });
    }
  };
  const confirmarDescarte = () => {
    // `dependentes.operacoes` já inclui as edições seguintes do mesmo registro.
    const partes = [
      dependentes.operacoes > 0 && plural(dependentes.operacoes, "outra mudança ligada a ela", "outras mudanças ligadas a ela"),
      dependentes.fotos > 0 && plural(dependentes.fotos, "foto guardada", "fotos guardadas"),
    ].filter(Boolean);
    const extra = partes.length ? `\n\nTambém serão descartadas: ${partes.join(" e ")}.` : "";
    if (window.confirm(`Descartar esta mudança? Ela não será enviada ao servidor.${extra}`)) {
      decidir.mutate({ nome: "descartar", acao: () => descartarPendencia(op.id) });
    }
  };

  return (
    <Cartao className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-foreground">
          {rotaDetalhe ? (
            <Link to={rotaDetalhe} className="hover:underline">
              {rotulo}
            </Link>
          ) : (
            rotulo
          )}
        </h3>
        <Selo className={conflito ? "bg-muted text-foreground" : "bg-destructive/10 text-destructive"}>
          {conflito ? "Conflito" : "Recusada pelo servidor"}
        </Selo>
      </div>

      {conflito && op.conflitos?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Campos alterados nos dois lados</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Campo</th>
                <th className="py-1 pr-3 font-medium">Neste aparelho</th>
                <th className="py-1 font-medium">No servidor</th>
              </tr>
            </thead>
            <tbody>
              {op.conflitos.map((c) => (
                <tr key={c.campo} className="border-t border-border align-top">
                  <th scope="row" className="py-2 pr-3 font-medium text-foreground">{rotuloCampo(c.campo)}</th>
                  <td className="py-2 pr-3 text-foreground">{formatarValorCampo(c.campo, c.local, ctx)}</td>
                  <td className="py-2 text-foreground">{formatarValorCampo(c.campo, c.servidor, ctx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-foreground">{op.ultimoErro ?? "O servidor não aceitou esta mudança."}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {conflito && (
          <>
            <Botao tamanho="sm" variante="secundario" carregando={girando("servidor")} disabled={decidir.isPending} onClick={confirmarServidor}>
              Manter a do servidor
            </Botao>
            <Botao
              tamanho="sm"
              variante="secundario"
              carregando={girando("aparelho")}
              disabled={decidir.isPending}
              onClick={() => decidir.mutate({ nome: "aparelho", acao: () => manterAparelho(op.id) })}
            >
              Manter a deste aparelho
            </Botao>
          </>
        )}
        {!rotaEdicao && !conflito && op.operacao !== "delete" && (
          <p className="w-full text-xs text-muted-foreground">Esta mudança não pode mais ser editada (prazo de 7 dias); resta descartá-la.</p>
        )}
        {rotaEdicao && (
          <LinkBotao to={rotaEdicao} tamanho="sm" variante="primario">
            Editar manualmente
          </LinkBotao>
        )}
        {!conflito && (
          <Botao tamanho="sm" variante="perigo" carregando={girando("descartar")} disabled={decidir.isPending} onClick={confirmarDescarte}>
            Descartar
          </Botao>
        )}
      </div>
      <MensagemErro erro={decidir.error} />
    </Cartao>
  );
}

export function Sincronizacao() {
  const { data: pendencias, isLoading, error } = useQuery({
    queryKey: ["sincronizacao", "pendencias"],
    queryFn: listarPendencias,
  });
  const ctx = useNomes();

  return (
    <>
      <CabecalhoPagina
        voltar={<VoltarConfiguracoes />}
        titulo="Sincronização"
        subtitulo="O que foi registrado sem conexão sobe sozinho quando ela volta. Aqui ficam as mudanças que precisam de uma decisão sua."
      />
      <section aria-labelledby="titulo-pendencias" className="space-y-3">
        <h2 id="titulo-pendencias" className="flex items-center gap-2 font-semibold text-foreground">
          <TriangleAlert className="size-4" aria-hidden /> Pendências
        </h2>
        {isLoading ? (
          <Carregando />
        ) : error ? (
          <MensagemErro erro={error} />
        ) : !pendencias?.length ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4" aria-hidden /> Nenhuma pendência: tudo o que foi registrado neste aparelho chegou ao servidor ou está na fila de envio.
          </p>
        ) : (
          pendencias.map((p) => <CartaoPendencia key={p.op.id} pendencia={p} ctx={ctx} />)
        )}
      </section>
    </>
  );
}
