import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { GaleriaFotos } from "../../components/features/GaleriaFotos";
import { Botao } from "../../components/ui/Botao";
import { AreaTexto, Campo, Entrada, Selecao } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useColonias, useProducao } from "../../hooks/useDados";
import { fotosApi, producoesApi } from "../../services/api/endpoints";
import type { Producao, ProducaoInput, TipoProduto, Unidade } from "../../types/api";
import { paraInputData } from "../../utils/format";
import { comprimirImagem } from "../../utils/imagem";
import { ROTULO_PRODUTO, TIPOS_PRODUTO, UNIDADE_PADRAO } from "../../utils/producao";

interface Estado {
  coloniaId: string;
  dataColheita: string;
  tipoProduto: TipoProduto;
  quantidade: string;
  unidade: Unidade;
  cor: string;
  aroma: string;
  sabor: string;
  observacoes: string;
}

function estadoInicial(producao: Producao | undefined, coloniaSugerida: string | null): Estado {
  return {
    coloniaId: producao?.coloniaId ?? coloniaSugerida ?? "",
    dataColheita: producao ? producao.dataColheita.slice(0, 10) : paraInputData(new Date()),
    tipoProduto: producao?.tipoProduto ?? "mel",
    quantidade: producao ? String(producao.quantidade).replace(".", ",") : "",
    unidade: producao?.unidade ?? "ml",
    cor: producao?.caracteristicas?.cor ?? "",
    aroma: producao?.caracteristicas?.aroma ?? "",
    sabor: producao?.caracteristicas?.sabor ?? "",
    observacoes: producao?.observacoes ?? "",
  };
}

const numero = (v: string) => Number(v.trim().replace(",", "."));
const textoOuUndefined = (v: string) => (v.trim() === "" ? undefined : v.trim());

function paraPayload(e: Estado): ProducaoInput {
  const caracteristicas = { cor: textoOuUndefined(e.cor), aroma: textoOuUndefined(e.aroma), sabor: textoOuUndefined(e.sabor) };
  const preenchidas = Object.fromEntries(Object.entries(caracteristicas).filter(([, v]) => v !== undefined));
  return {
    coloniaId: e.coloniaId,
    // Meio-dia local evita que a data "mude de dia" ao converter para UTC.
    dataColheita: new Date(`${e.dataColheita}T12:00:00`).toISOString(),
    tipoProduto: e.tipoProduto,
    quantidade: numero(e.quantidade),
    unidade: e.unidade,
    caracteristicas: Object.keys(preenchidas).length ? preenchidas : null,
    observacoes: e.observacoes.trim() || null,
  };
}

export function FormColheita() {
  const { id } = useParams();
  const editando = Boolean(id);
  const { data: producao, isLoading, error } = useProducao(id ?? "");

  if (editando && isLoading) return <Carregando />;
  if (editando && (error || !producao)) return <ErroCarregamento erro={error} />;
  return <Formulario producao={editando ? producao : undefined} />;
}

function Formulario({ producao }: { producao?: Producao | undefined }) {
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const { data: colonias } = useColonias();
  const [estado, setEstado] = useState(() => estadoInicial(producao, params.get("colonia")));
  const [tentou, setTentou] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const alterar = <K extends keyof Estado>(campo: K, valor: Estado[K]) => setEstado((e) => ({ ...e, [campo]: valor }));
  const escolherProduto = (tipo: TipoProduto) => setEstado((e) => ({ ...e, tipoProduto: tipo, unidade: UNIDADE_PADRAO[tipo] }));

  // Colônias ativas primeiro; inativas/mortas só aparecem se já forem a escolhida.
  const opcoes = (colonias ?? [])
    .filter((c) => c.status === "ativa" || c.id === estado.coloniaId)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));

  const hoje = paraInputData(new Date());
  const qtd = numero(estado.quantidade);
  const erros = {
    coloniaId: !estado.coloniaId ? "Selecione a colônia." : undefined,
    dataColheita: !estado.dataColheita
      ? "Informe a data da colheita."
      : estado.dataColheita > hoje
        ? "A data da colheita não pode ser futura."
        : undefined,
    quantidade: !estado.quantidade.trim()
      ? "Informe a quantidade."
      : !Number.isFinite(qtd) || qtd <= 0
        ? "A quantidade deve ser um número maior que zero."
        : undefined,
  };
  const valido = !Object.values(erros).some(Boolean);
  const erro = (c: keyof typeof erros) => (tentou ? erros[c] : undefined);

  const salvar = useMutation({
    mutationFn: async () => {
      const dados = paraPayload(estado);
      if (producao) {
        const { coloniaId: _colonia, ...resto } = dados;
        return { salva: await producoesApi.atualizar(producao.id, resto), fotoFalhou: false };
      }
      const salva = await producoesApi.criar(dados);
      // A foto sobe depois e nunca desfaz a colheita (foto é opcional — CLAUDE.md §8).
      let fotoFalhou = false;
      if (foto) {
        try {
          await fotosApi.enviar(await comprimirImagem(foto), { producaoId: salva.id });
        } catch {
          fotoFalhou = true;
        }
      }
      return { salva, fotoFalhou };
    },
    onSuccess: ({ fotoFalhou }) => {
      queryClient.invalidateQueries({ queryKey: chaves.producoes });
      queryClient.invalidateQueries({ queryKey: chaves.colonias });
      queryClient.invalidateQueries({ queryKey: ["fotos"] });
      if (fotoFalhou) window.alert("A colheita foi salva, mas a foto não pôde ser enviada. Você pode adicioná-la editando a colheita.");
      navegar("/app/producao", { replace: true });
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
          <Link to="/app/producao" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Produção
          </Link>
        }
        titulo={producao ? "Editar colheita" : "Registrar colheita"}
        subtitulo={producao ? `Colônia ${producao.colonia.codigo}` : "Registro rápido: colônia, produto e quantidade."}
      />

      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Cartao className="space-y-4">
          {producao ? (
            <p className="text-sm text-muted-foreground">
              A colônia de uma colheita não muda. Se registrou na colônia errada, exclua a colheita e registre de novo.
            </p>
          ) : (
            <Campo rotulo="Colônia" obrigatorio erro={erro("coloniaId")}>
              {(id) => (
                <Selecao id={id} value={estado.coloniaId} onChange={(e) => alterar("coloniaId", e.target.value)}>
                  <option value="">Selecione…</option>
                  {opcoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo}
                      {c.especie ? ` — ${c.especie.nomePopular}` : ""}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-foreground">
              Produto <span className="text-destructive">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIPOS_PRODUTO.map((t) => (
                <label
                  key={t}
                  className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium ${
                    estado.tipoProduto === t ? "border-sidebar bg-sidebar text-sidebar-primary" : "border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <input type="radio" name="tipoProduto" value={t} checked={estado.tipoProduto === t} onChange={() => escolherProduto(t)} className="sr-only" />
                  {ROTULO_PRODUTO[t]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Quantidade" obrigatorio erro={erro("quantidade")}>
              {(id) => (
                <div className="flex gap-2">
                  <Entrada
                    id={id}
                    inputMode="decimal"
                    placeholder="Ex.: 250"
                    value={estado.quantidade}
                    onChange={(e) => alterar("quantidade", e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex shrink-0 rounded-xl border border-input p-0.5" role="radiogroup" aria-label="Unidade">
                    {(["ml", "g"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        role="radio"
                        aria-checked={estado.unidade === u}
                        onClick={() => alterar("unidade", u)}
                        className={`w-12 rounded-lg text-sm font-semibold ${estado.unidade === u ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Campo>
            <Campo rotulo="Data da colheita" obrigatorio erro={erro("dataColheita")}>
              {(id) => <Entrada id={id} type="date" max={hoje} value={estado.dataColheita} onChange={(e) => alterar("dataColheita", e.target.value)} />}
            </Campo>
          </div>
        </Cartao>

        <Cartao className="space-y-4">
          <div>
            <h2 className="font-semibold text-foreground">Características (opcional)</h2>
            <p className="text-sm text-muted-foreground">Descrição livre, útil para comparar safras e espécies.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Cor">{(id) => <Entrada id={id} placeholder="Ex.: âmbar claro" value={estado.cor} onChange={(e) => alterar("cor", e.target.value)} />}</Campo>
            <Campo rotulo="Aroma">{(id) => <Entrada id={id} placeholder="Ex.: floral" value={estado.aroma} onChange={(e) => alterar("aroma", e.target.value)} />}</Campo>
            <Campo rotulo="Sabor">{(id) => <Entrada id={id} placeholder="Ex.: ácido" value={estado.sabor} onChange={(e) => alterar("sabor", e.target.value)} />}</Campo>
          </div>
          <Campo rotulo="Observações">
            {(id) => <AreaTexto id={id} value={estado.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} />}
          </Campo>
        </Cartao>

        <Cartao className="space-y-3">
          <h2 className="font-semibold text-foreground">Foto (opcional)</h2>
          {producao ? (
            <GaleriaFotos vinculo={{ producaoId: producao.id }} />
          ) : (
            <>
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
                  <button type="button" onClick={() => setFoto(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive">
                    <X className="size-4" aria-hidden /> Remover
                  </button>
                </div>
              ) : (
                <Botao type="button" variante="secundario" tamanho="sm" onClick={() => inputFoto.current?.click()}>
                  <Camera className="size-4" aria-hidden /> Adicionar foto
                </Botao>
              )}
            </>
          )}
        </Cartao>

        <MensagemErro erro={salvar.error} />
        {tentou && !valido && <p className="text-sm text-destructive">Corrija os campos destacados.</p>}
        <div className="flex gap-2">
          <Botao type="submit" variante="destaque" tamanho="lg" className="flex-1 sm:flex-none" carregando={salvar.isPending}>
            {producao ? "Salvar alterações" : "Registrar colheita"}
          </Botao>
          <Botao type="button" variante="fantasma" tamanho="lg" onClick={() => navegar(-1)}>
            Cancelar
          </Botao>
        </div>
      </form>
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
