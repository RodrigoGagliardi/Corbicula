import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, FileUp, Info, LayoutTemplate } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Botao } from "../../components/ui/Botao";
import { CabecalhoPagina, Cartao, Selo } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useParametros, useTemplatesParametros } from "../../hooks/useDados";
import { parametrosApi } from "../../services/api/endpoints";
import type { ArquivoParametros, CriteriosTexto, ModoAplicacao, Parametro, ResumoAplicacao, TemplateParametros } from "../../types/api";
import { lerArquivoParametros, normalizarNome, previaAplicacao } from "../../utils/conjuntoParametros";
import { COR_STATUS } from "../../utils/score";

const CLASSE_LINK =
  "font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground";

type Origem = { tipo: "template"; template: TemplateParametros } | { tipo: "arquivo"; nome: string; dados: ArquivoParametros };

export function TemplatesParametros() {
  const queryClient = useQueryClient();
  const templates = useTemplatesParametros();
  const parametros = useParametros();
  const [aberto, setAberto] = useState<string | null>(null); // id do template ou "arquivo"
  const [arquivo, setArquivo] = useState<{ nome: string; dados: ArquivoParametros } | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ titulo: string; resumo: ResumoAplicacao } | null>(null);

  const aplicar = useMutation({
    mutationFn: ({ origem, modo }: { origem: Origem; modo: ModoAplicacao }) =>
      origem.tipo === "template"
        ? parametrosApi.aplicarTemplate(origem.template.id, modo)
        : parametrosApi.importar(origem.dados, modo),
    onSuccess: (resumo, { origem }) => {
      setResultado({ titulo: origem.tipo === "template" ? `Template ${origem.template.nome}` : `Arquivo ${origem.nome}`, resumo });
      setAberto(null);
      setArquivo(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaves.parametros }),
  });

  const exportar = useMutation({ mutationFn: parametrosApi.exportar });

  const voltar = (
    <Link to="/app/parametros" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden /> Parâmetros
    </Link>
  );
  const acoes = (
    <Botao variante="secundario" onClick={() => exportar.mutate()} carregando={exportar.isPending}>
      <Download className="size-4" aria-hidden /> Exportar meus parâmetros
    </Botao>
  );

  if (templates.isLoading || parametros.isLoading) return <><CabecalhoPagina titulo="Templates de parâmetros" voltar={voltar} /><Carregando /></>;
  if (templates.error || parametros.error || !templates.data || !parametros.data) {
    return (
      <>
        <CabecalhoPagina titulo="Templates de parâmetros" voltar={voltar} />
        <ErroCarregamento erro={templates.error ?? parametros.error} tentarDeNovo={() => { templates.refetch(); parametros.refetch(); }} />
      </>
    );
  }

  const atuais = parametros.data;
  const nomesAtuais = new Set(atuais.map((p) => normalizarNome(p.nome)));

  const abrirArquivo = async (file: File | undefined) => {
    setErroArquivo(null);
    setArquivo(null);
    if (!file) return;
    if (file.size > 1_000_000) return setErroArquivo("Arquivo grande demais (máx. 1 MB).");
    const lido = lerArquivoParametros(await file.text());
    if ("erro" in lido) return setErroArquivo(lido.erro);
    setArquivo({ nome: file.name, dados: lido.dados });
    setAberto("arquivo");
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Templates de parâmetros"
        subtitulo="Conjuntos prontos para começar ou padronizar as inspeções."
        voltar={voltar}
        acoes={acoes}
      />
      <MensagemErro erro={exportar.error} />

      {resultado && <ResumoResultado {...resultado} aoFechar={() => setResultado(null)} />}

      <Cartao className="mb-4 flex gap-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p>
            Os critérios são <strong className="text-foreground">referências gerais</strong>: o que é “bom” varia entre
            espécies. Depois de aplicar, ajuste os critérios ou defina critérios por espécie em cada parâmetro.
          </p>
          <p>
            Aplicar nunca altera um parâmetro que você já tem (os critérios dele podem estar em avaliações antigas).
            “Substituir” desativa os que ficam de fora — nada é excluído e o histórico continua íntegro.
          </p>
        </div>
      </Cartao>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.data.map((t, i) => {
          const anteriores = new Set(templates.data[i - 1]?.parametros.map((p) => p.nome) ?? []);
          const faltam = t.parametros.filter((p) => !nomesAtuais.has(normalizarNome(p.nome))).length;
          return (
            <Cartao key={t.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <LayoutTemplate className="size-5 text-primary" aria-hidden /> {t.nome}
                  </h2>
                  <p className="text-sm text-muted-foreground">{t.descricao}</p>
                </div>
                <Selo className="shrink-0 bg-muted text-muted-foreground">v{t.versao}</Selo>
              </div>
              <p className="text-sm font-medium text-foreground">
                {t.parametros.length} parâmetros ·{" "}
                {faltam === 0 ? <span className="text-muted-foreground">você já tem todos</span> : `${faltam} novo(s) para você`}
              </p>
              <ul className="space-y-1 text-sm">
                {t.parametros.map((p) => (
                  <li key={p.nome}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-muted">
                        <span className={anteriores.has(p.nome) ? "text-muted-foreground" : "font-medium text-foreground"}>{p.nome}</span>
                        {nomesAtuais.has(normalizarNome(p.nome)) && <Selo className="bg-muted text-muted-foreground">já tem</Selo>}
                      </summary>
                      <Criterios {...p} />
                    </details>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                {aberto === t.id ? (
                  <PainelAplicacao
                    atuais={atuais}
                    itens={t.parametros}
                    pendente={aplicar.isPending}
                    erro={aplicar.error}
                    aoAplicar={(modo) => aplicar.mutate({ origem: { tipo: "template", template: t }, modo })}
                    aoCancelar={() => { setAberto(null); aplicar.reset(); }}
                  />
                ) : (
                  <Botao variante={i === 0 && atuais.length === 0 ? "destaque" : "secundario"} onClick={() => { aplicar.reset(); setAberto(t.id); }}>
                    Usar este template
                  </Botao>
                )}
              </div>
            </Cartao>
          );
        })}
      </div>

      <Cartao className="mt-4 space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <FileUp className="size-5 text-primary" aria-hidden /> Importar de arquivo
        </h2>
        <p className="text-sm text-muted-foreground">
          Use um arquivo gerado por “Exportar meus parâmetros” — por exemplo, para padronizar a coleta entre pesquisadores
          ou meliponários. Critérios por espécie vêm junto.
        </p>
        <SeletorArquivo aoEscolher={abrirArquivo} />
        {erroArquivo && <p className="text-sm text-destructive" role="alert">{erroArquivo}</p>}
        {arquivo && aberto === "arquivo" && (
          <>
            <p className="text-sm text-foreground">
              <strong>{arquivo.nome}</strong>: {arquivo.dados.parametros.length} parâmetro(s)
              {arquivo.dados.exportadoEm && ` · exportado em ${new Date(arquivo.dados.exportadoEm).toLocaleDateString("pt-BR")}`}
            </p>
            <PainelAplicacao
              atuais={atuais}
              itens={arquivo.dados.parametros}
              pendente={aplicar.isPending}
              erro={aplicar.error}
              aoAplicar={(modo) => aplicar.mutate({ origem: { tipo: "arquivo", ...arquivo }, modo })}
              aoCancelar={() => { setArquivo(null); setAberto(null); aplicar.reset(); }}
            />
          </>
        )}
      </Cartao>
    </>
  );
}

function Criterios({ criterioBom, criterioMedio, criterioRuim }: CriteriosTexto) {
  return (
    <dl className="mt-1 mb-2 space-y-1 rounded-lg bg-background px-3 py-2 text-xs">
      <div><dt className="inline font-medium text-excelente">Bom: </dt><dd className="inline text-muted-foreground">{criterioBom}</dd></div>
      <div><dt className="inline font-medium text-atencao">Médio: </dt><dd className="inline text-muted-foreground">{criterioMedio}</dd></div>
      <div><dt className="inline font-medium text-critica">Ruim: </dt><dd className="inline text-muted-foreground">{criterioRuim}</dd></div>
    </dl>
  );
}

function SeletorArquivo({ aoEscolher }: { aoEscolher: (f: File | undefined) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
        <FileUp className="size-4" aria-hidden /> Escolher arquivo .json
      </label>
      <input
        id={id}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          aoEscolher(e.target.files?.[0]);
          e.target.value = ""; // permite escolher o mesmo arquivo de novo
        }}
      />
    </div>
  );
}

// Confirmação antes de aplicar: escolha do modo e prévia do que vai mudar.
function PainelAplicacao({
  atuais,
  itens,
  pendente,
  erro,
  aoAplicar,
  aoCancelar,
}: {
  atuais: Parametro[];
  itens: (CriteriosTexto & { nome: string; ativo?: boolean })[];
  pendente: boolean;
  erro: unknown;
  aoAplicar: (modo: ModoAplicacao) => void;
  aoCancelar: () => void;
}) {
  const [modo, setModo] = useState<ModoAplicacao>("mesclar");
  const previa = previaAplicacao(atuais, itens, modo);
  const nada = previa.novos.length + previa.reativar.length + previa.desativar.length === 0;
  const nome = useId();

  return (
    <div className="space-y-3 rounded-xl border border-input bg-background p-3">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-foreground">Como aplicar?</legend>
        {(
          [
            ["mesclar", "Mesclar", "Acrescenta o que falta e mantém seus parâmetros atuais."],
            ["substituir", "Substituir", "Seus parâmetros que não estão no conjunto são desativados (não excluídos)."],
          ] as const
        ).map(([valor, rotulo, descricao]) => (
          <label key={valor} className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="radio" name={nome} value={valor} checked={modo === valor} onChange={() => setModo(valor)} className="mt-1 accent-primary" />
            <span>
              <span className="font-medium text-foreground">{rotulo}</span>
              <span className="block text-muted-foreground">{descricao}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <ul className="space-y-1 text-sm" aria-live="polite">
        <LinhaPrevia rotulo="Serão criados" nomes={previa.novos} />
        <LinhaPrevia rotulo="Serão reativados" nomes={previa.reativar} />
        <LinhaPrevia rotulo="Serão desativados" nomes={previa.desativar} destaque />
        <LinhaPrevia rotulo="Já existem (mantidos como estão)" nomes={previa.existentes} />
        {previa.criteriosDiferentes.length > 0 && (
          <li className="text-xs text-muted-foreground">
            {previa.criteriosDiferentes.length === 1
              ? "1 dos que já existem tem critérios diferentes no conjunto — os seus são mantidos."
              : `${previa.criteriosDiferentes.length} dos que já existem têm critérios diferentes no conjunto — os seus são mantidos.`}
          </li>
        )}
        {nada && <li className="text-muted-foreground">Nada muda: você já tem este conjunto.</li>}
      </ul>

      <MensagemErro erro={erro} />
      <div className="flex flex-wrap gap-2">
        <Botao onClick={() => aoAplicar(modo)} carregando={pendente} disabled={nada}>
          {modo === "mesclar" ? "Mesclar" : "Substituir"}
        </Botao>
        <Botao variante="fantasma" onClick={aoCancelar} disabled={pendente}>
          Cancelar
        </Botao>
      </div>
    </div>
  );
}

function LinhaPrevia({ rotulo, nomes, destaque }: { rotulo: string; nomes: string[]; destaque?: boolean }) {
  if (nomes.length === 0) return null;
  return (
    <li>
      <span className={`font-medium ${destaque ? "text-atencao" : "text-foreground"}`}>
        {rotulo} ({nomes.length}):
      </span>{" "}
      <span className="text-muted-foreground">{nomes.join(", ")}</span>
    </li>
  );
}

function ResumoResultado({ titulo, resumo, aoFechar }: { titulo: string; resumo: ResumoAplicacao; aoFechar: () => void }) {
  const linhas: [string, string[]][] = [
    ["Criados", resumo.criados],
    ["Reativados", resumo.reativados],
    ["Desativados", resumo.desativados],
    ["Mantidos como estavam", resumo.existentes],
  ];
  return (
    <Cartao className="mb-4 space-y-2 border-primary">
      <h2 className="flex items-center gap-2 font-semibold text-foreground">
        <CheckCircle2 className="size-5 text-primary" aria-hidden /> {titulo} aplicado
      </h2>
      <ul className="space-y-1 text-sm">
        {linhas.filter(([, nomes]) => nomes.length > 0).map(([rotulo, nomes]) => (
          <li key={rotulo}>
            <span className="font-medium text-foreground">{rotulo} ({nomes.length}):</span>{" "}
            <span className="text-muted-foreground">{nomes.join(", ")}</span>
          </li>
        ))}
      </ul>
      {resumo.especiesIgnoradas.length > 0 && (
        <Aviso>
          Critérios de espécies que não estão no catálogo foram ignorados: {resumo.especiesIgnoradas.join(", ")}.
        </Aviso>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/app/parametros" className={CLASSE_LINK}>Ver e ajustar parâmetros</Link>
        <button onClick={aoFechar} className="text-muted-foreground hover:text-foreground">Fechar</button>
      </div>
    </Cartao>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return <p className={`rounded-lg px-3 py-2 text-sm ${COR_STATUS.atencao.fundo} ${COR_STATUS.atencao.texto}`}>{children}</p>;
}

