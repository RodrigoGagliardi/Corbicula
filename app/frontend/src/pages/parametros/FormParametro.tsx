import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { SeletorClassificacao } from "../../components/features/SeletorClassificacao";
import { Botao } from "../../components/ui/Botao";
import { AreaTexto, Campo, Entrada } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useParametros } from "../../hooks/useDados";
import { parametrosApi } from "../../services/api/endpoints";
import type { Parametro } from "../../types/api";

export function FormParametro() {
  const { id } = useParams();
  const { data: parametros, isLoading, error } = useParametros();
  if (isLoading) return <Carregando />;
  if (error || !parametros) return <ErroCarregamento erro={error} />;
  const parametro = id ? parametros.find((p) => p.id === id) : undefined;
  if (id && !parametro) return <ErroCarregamento erro={new Error("Parâmetro não encontrado")} />;
  return <Formulario parametro={parametro} proximaOrdem={parametros.length + 1} />;
}

function Formulario({ parametro, proximaOrdem }: { parametro?: Parametro | undefined; proximaOrdem: number }) {
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const [dados, setDados] = useState({
    nome: parametro?.nome ?? "",
    criterioBom: parametro?.criterioBom ?? "",
    criterioMedio: parametro?.criterioMedio ?? "",
    criterioRuim: parametro?.criterioRuim ?? "",
  });
  const [tentou, setTentou] = useState(false);
  const alterar = (campo: keyof typeof dados) => (e: { target: { value: string } }) =>
    setDados((d) => ({ ...d, [campo]: e.target.value }));

  const erros = {
    nome: dados.nome.trim().length < 2 ? "Use ao menos 2 caracteres." : undefined,
    criterioBom: dados.criterioBom.trim() ? undefined : "Descreva o que é Bom.",
    criterioMedio: dados.criterioMedio.trim() ? undefined : "Descreva o que é Médio.",
    criterioRuim: dados.criterioRuim.trim() ? undefined : "Descreva o que é Ruim.",
  };
  const valido = !Object.values(erros).some(Boolean);
  const erro = (c: keyof typeof erros) => (tentou ? erros[c] : undefined);

  const salvar = useMutation({
    mutationFn: () => {
      const payload = {
        nome: dados.nome.trim(),
        criterioBom: dados.criterioBom.trim(),
        criterioMedio: dados.criterioMedio.trim(),
        criterioRuim: dados.criterioRuim.trim(),
      };
      return parametro
        ? parametrosApi.atualizar(parametro.id, payload)
        : parametrosApi.criar({ ...payload, ordem: proximaOrdem });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.parametros });
      navegar("/parametros", { replace: true });
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (valido) salvar.mutate();
  };

  return (
    <>
      <CabecalhoPagina
        voltar={
          <Link to="/parametros" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="size-4" aria-hidden /> Parâmetros
          </Link>
        }
        titulo={parametro ? "Editar parâmetro" : "Novo parâmetro"}
        subtitulo="Critérios claros e observáveis tornam as avaliações comparáveis ao longo do tempo."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <Cartao className="space-y-4">
            <Campo rotulo="Nome" obrigatorio erro={erro("nome")}>
              {(id) => <Entrada id={id} placeholder="Ex.: Fluxo de entrada" value={dados.nome} onChange={alterar("nome")} />}
            </Campo>
            <Campo rotulo="Critério — Bom" obrigatorio erro={erro("criterioBom")}>
              {(id) => (
                <AreaTexto id={id} placeholder="Ex.: 20 ou mais abelhas por minuto" value={dados.criterioBom} onChange={alterar("criterioBom")} />
              )}
            </Campo>
            <Campo rotulo="Critério — Médio" obrigatorio erro={erro("criterioMedio")}>
              {(id) => (
                <AreaTexto id={id} placeholder="Ex.: 10 a 19 abelhas por minuto" value={dados.criterioMedio} onChange={alterar("criterioMedio")} />
              )}
            </Campo>
            <Campo rotulo="Critério — Ruim" obrigatorio erro={erro("criterioRuim")}>
              {(id) => (
                <AreaTexto id={id} placeholder="Ex.: menos de 10 abelhas por minuto" value={dados.criterioRuim} onChange={alterar("criterioRuim")} />
              )}
            </Campo>
          </Cartao>
          {parametro && parametro._count.avaliacoesParametros > 0 && (
            <p className="rounded-xl bg-mel-50 px-3 py-2 text-sm text-mel-900">
              Este parâmetro já foi usado em {parametro._count.avaliacoesParametros} avaliação(ões). Mudar os critérios
              afeta a interpretação das avaliações futuras — para mudanças grandes, prefira criar um parâmetro novo e
              desativar este.
            </p>
          )}
          <MensagemErro erro={salvar.error} />
          <Botao type="submit" tamanho="lg" className="w-full sm:w-auto" carregando={salvar.isPending}>
            Salvar
          </Botao>
        </form>

        <div>
          <p className="mb-2 text-sm font-medium text-stone-500">Prévia na avaliação</p>
          <Cartao className="space-y-3">
            <h2 className="font-semibold text-stone-900">{dados.nome || "Nome do parâmetro"}</h2>
            <SeletorClassificacao rotulo="Prévia" valor={undefined} onChange={() => {}} />
            <dl className="space-y-1 text-sm">
              {[
                ["Bom", dados.criterioBom],
                ["Médio", dados.criterioMedio],
                ["Ruim", dados.criterioRuim],
              ].map(([r, t]) => (
                <div key={r} className="flex gap-2">
                  <dt className="w-12 shrink-0 font-medium text-stone-500">{r}</dt>
                  <dd className="text-stone-700">{t || "—"}</dd>
                </div>
              ))}
            </dl>
          </Cartao>
        </div>
      </div>
    </>
  );
}
