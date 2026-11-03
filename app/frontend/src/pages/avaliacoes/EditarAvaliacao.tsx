import { ArrowLeft, Clock } from "lucide-react";
import { Link, useParams } from "react-router";
import { LinkBotao } from "../../components/ui/Botao";
import { CabecalhoPagina } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, EstadoVazio } from "../../components/ui/Estados";
import { useAvaliacao, useColonia, useParametros } from "../../hooks/useDados";
import { formatarDataHora } from "../../utils/format";
import { fimDaEdicao, LIMITE_EDICAO_DIAS, podeEditar } from "../../utils/score";
import { FormularioAvaliacao } from "./NovaAvaliacao";

// Edição de uma avaliação nos primeiros 7 dias após o registro (regra do servidor).
export function EditarAvaliacao() {
  const { coloniaId = "", id = "" } = useParams();
  const avaliacao = useAvaliacao(coloniaId, id);
  const colonia = useColonia(coloniaId);
  const parametros = useParametros();

  if (avaliacao.isLoading || colonia.isLoading || parametros.isLoading) return <Carregando />;
  if (avaliacao.error || !avaliacao.data) return <ErroCarregamento erro={avaliacao.error} tentarDeNovo={() => avaliacao.refetch()} />;
  if (colonia.error || !colonia.data) return <ErroCarregamento erro={colonia.error} />;
  if (parametros.error || !parametros.data) return <ErroCarregamento erro={parametros.error} />;

  const detalhe = `/app/colonias/${coloniaId}/avaliacoes/${id}`;
  if (!podeEditar(avaliacao.data.createdAt)) {
    return (
      <>
        <CabecalhoPagina
          voltar={
            <Link to={detalhe} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" aria-hidden /> Avaliação
            </Link>
          }
          titulo="Editar avaliação"
        />
        <EstadoVazio
          icone={<Clock className="size-10" />}
          titulo="Prazo de edição encerrado"
          descricao={`Avaliações podem ser editadas por ${LIMITE_EDICAO_DIAS} dias após o registro; esta podia ser editada até ${formatarDataHora(
            fimDaEdicao(avaliacao.data.createdAt).toISOString()
          )}. O limite preserva o histórico usado nas análises.`}
          acao={<LinkBotao to={detalhe}>Voltar à avaliação</LinkBotao>}
        />
      </>
    );
  }

  // Parâmetros ativos + os que já estavam na avaliação (mesmo se desativados
  // depois), na ordem configurada.
  const naAvaliacao = new Set(avaliacao.data.parametros.map((p) => p.parametroId));
  const disponiveis = parametros.data
    .filter((p) => p.ativo || naAvaliacao.has(p.id))
    .sort((a, b) => a.ordem - b.ordem);

  return <FormularioAvaliacao colonia={colonia.data} parametros={disponiveis} avaliacao={avaliacao.data} />;
}
