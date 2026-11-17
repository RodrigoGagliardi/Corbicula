import { useMutation } from "@tanstack/react-query";
import { Archive, Download } from "lucide-react";
import { Link } from "react-router";
import { Botao } from "../../components/ui/Botao";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { AvisoSemConexao, MensagemErro } from "../../components/ui/Estados";
import { exportacaoApi } from "../../services/api/endpoints";
import { VoltarConfiguracoes } from "./Configuracoes";

type Recurso = "colonias" | "avaliacoes" | "producoes";
type Formato = "csv" | "json";

const DICIONARIO = "https://github.com/RodrigoGagliardi/Corbicula/blob/main/docs/exportacao.md";

const RECURSOS: { recurso: Recurso; titulo: string; descricao: string }[] = [
  {
    recurso: "colonias",
    titulo: "Colônias",
    descricao: "Uma linha por colônia, com espécie, origem, genealogia (mãe e doadora) e localização.",
  },
  {
    recurso: "avaliacoes",
    titulo: "Avaliações",
    descricao: "Formato longo (tidy): uma linha por avaliação × parâmetro, com score, status e clima.",
  },
  {
    recurso: "producoes",
    titulo: "Produção",
    descricao: "Uma linha por colheita, com quantidade e unidade (ml ou g) e características do produto.",
  },
];

const exportar = ({ recurso, formato }: { recurso: Recurso; formato: Formato }) => {
  if (recurso === "colonias") return exportacaoApi.colonias(formato);
  if (recurso === "avaliacoes") return exportacaoApi.avaliacoes({}, formato);
  return exportacaoApi.producoes({}, formato);
};

export function Dados() {
  const arquivo = useMutation({ mutationFn: exportar });
  const backup = useMutation({ mutationFn: exportacaoApi.backup });
  const baixando = (recurso: Recurso, formato: Formato) =>
    arquivo.isPending && arquivo.variables?.recurso === recurso && arquivo.variables.formato === formato;

  return (
    <>
      <CabecalhoPagina
        voltar={<VoltarConfiguracoes />}
        titulo="Exportar dados"
        subtitulo="Seus dados completos, prontos para R, Python ou planilhas."
      />
      <AvisoSemConexao>Sem conexão: os arquivos são gerados no servidor, e exportar exige conexão.</AvisoSemConexao>

      <div className="space-y-4">
        <Cartao className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
              <Archive className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground">Backup completo</h2>
              <p className="text-sm text-muted-foreground">
                Um arquivo JSON com perfil, meliponário, parâmetros, colônias, avaliações, produções e o registro das fotos
                (os arquivos de imagem não vão no backup).
              </p>
            </div>
          </div>
          <MensagemErro erro={backup.error} />
          <Botao onClick={() => backup.mutate()} carregando={backup.isPending}>
            <Download className="size-4" aria-hidden /> Baixar backup (JSON)
          </Botao>
        </Cartao>

        <div className="grid gap-4 md:grid-cols-3">
          {RECURSOS.map(({ recurso, titulo, descricao }) => (
            <Cartao key={recurso} className="flex flex-col gap-3">
              <div className="flex-1">
                <h2 className="font-semibold text-foreground">{titulo}</h2>
                <p className="text-sm text-muted-foreground">{descricao}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["csv", "json"] as const).map((formato) => (
                  <Botao
                    key={formato}
                    variante="secundario"
                    onClick={() => arquivo.mutate({ recurso, formato })}
                    carregando={baixando(recurso, formato)}
                  >
                    <Download className="size-4" aria-hidden /> {formato.toUpperCase()}
                  </Botao>
                ))}
              </div>
            </Cartao>
          ))}
        </div>
        <MensagemErro erro={arquivo.error} />

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            CSV em UTF-8 (RFC 4180), datas em ISO 8601 (UTC). O JSON traz os mesmos dados com metadados e a metodologia do
            score. Colunas e unidades estão no{" "}
            <a href={DICIONARIO} target="_blank" rel="noreferrer" className="text-foreground underline decoration-accent decoration-2 underline-offset-4">
              dicionário de dados
            </a>
            .
          </p>
          <p>
            Para exportar só um período ou uma colônia, use os filtros do{" "}
            <Link to="/app/avaliacoes" className="text-foreground underline decoration-accent decoration-2 underline-offset-4">
              histórico de avaliações
            </Link>{" "}
            ou do{" "}
            <Link to="/app/producao" className="text-foreground underline decoration-accent decoration-2 underline-offset-4">
              histórico de produção
            </Link>
            .
          </p>
          <p>Ainda não disponível: fotos em zip, restaurar backup e importar parâmetros.</p>
        </div>
      </div>
    </>
  );
}
