import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LocateFixed } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Botao } from "../../components/ui/Botao";
import { AreaTexto, Campo, Entrada, Selecao } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useColonia, useColonias, useEspecies } from "../../hooks/useDados";
import { coloniasApi } from "../../services/api/endpoints";
import type { ColoniaDetalhada, ColoniaInput, Origem, StatusColonia, TipoCaixa } from "../../types/api";
import { paraInputData, ROTULO_CAIXA, ROTULO_ORIGEM, ROTULO_STATUS_COLONIA } from "../../utils/format";

interface Estado {
  especieId: string;
  dataEntrada: string;
  origem: Origem;
  coloniaMaeId: string;
  coloniaDoadoraId: string;
  tipoCaixa: TipoCaixa;
  altura: string;
  largura: string;
  profundidade: string;
  localizacao: string;
  latitude: string;
  longitude: string;
  observacoes: string;
  status: StatusColonia;
}

function estadoInicial(colonia?: ColoniaDetalhada, maeSugerida?: string | null): Estado {
  return {
    especieId: colonia?.especieId ?? "",
    dataEntrada: colonia ? colonia.dataEntrada.slice(0, 10) : paraInputData(new Date()),
    origem: colonia?.origem ?? (maeSugerida ? "divisao" : "captura"),
    coloniaMaeId: colonia?.coloniaMaeId ?? maeSugerida ?? "",
    coloniaDoadoraId: colonia?.coloniaDoadoraCampeirasId ?? "",
    tipoCaixa: colonia?.tipoCaixa ?? "INPA",
    altura: colonia?.dimensoesCaixa?.altura?.toString() ?? "",
    largura: colonia?.dimensoesCaixa?.largura?.toString() ?? "",
    profundidade: colonia?.dimensoesCaixa?.profundidade?.toString() ?? "",
    localizacao: colonia?.localizacao ?? "",
    latitude: colonia?.latitude?.toString() ?? "",
    longitude: colonia?.longitude?.toString() ?? "",
    observacoes: colonia?.observacoes ?? "",
    status: colonia?.status ?? "ativa",
  };
}

const numeroOuNull = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const textoOuNull = (v: string) => (v.trim() === "" ? null : v.trim());

function paraPayload(e: Estado): ColoniaInput {
  const dim = { altura: numeroOuNull(e.altura), largura: numeroOuNull(e.largura), profundidade: numeroOuNull(e.profundidade) };
  const dimensoes = Object.fromEntries(Object.entries(dim).filter(([, v]) => v !== null));
  return {
    // Meio-dia local evita que a data "mude de dia" ao converter para UTC.
    dataEntrada: new Date(`${e.dataEntrada}T12:00:00`).toISOString(),
    origem: e.origem,
    tipoCaixa: e.tipoCaixa,
    especieId: e.especieId || null,
    coloniaMaeId: e.origem === "divisao" && e.coloniaMaeId ? e.coloniaMaeId : null,
    coloniaDoadoraCampeirasId: e.origem === "divisao" && e.coloniaDoadoraId ? e.coloniaDoadoraId : null,
    status: e.status,
    dimensoesCaixa: Object.keys(dimensoes).length ? dimensoes : null,
    localizacao: textoOuNull(e.localizacao),
    latitude: numeroOuNull(e.latitude),
    longitude: numeroOuNull(e.longitude),
    observacoes: textoOuNull(e.observacoes),
  };
}

export function FormColonia() {
  const { id } = useParams();
  const editando = Boolean(id);
  const { data: colonia, isLoading, error } = useColonia(id ?? "");

  if (editando && isLoading) return <Carregando />;
  if (editando && (error || !colonia)) return <ErroCarregamento erro={error} />;
  return <Formulario colonia={editando ? colonia : undefined} />;
}

function Formulario({ colonia }: { colonia?: ColoniaDetalhada | undefined }) {
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const { data: especies } = useEspecies();
  const { data: colonias } = useColonias();
  const [estado, setEstado] = useState(() => estadoInicial(colonia, params.get("mae")));
  const [tentou, setTentou] = useState(false);
  const [gps, setGps] = useState<"idle" | "buscando" | "erro">("idle");

  // Filha herda a espécie da mãe por padrão (divisão).
  useEffect(() => {
    if (colonia || !estado.coloniaMaeId || estado.especieId) return;
    const mae = colonias?.find((c) => c.id === estado.coloniaMaeId);
    if (mae?.especieId) setEstado((e) => ({ ...e, especieId: mae.especieId! }));
  }, [colonia, colonias, estado.coloniaMaeId, estado.especieId]);

  const alterar = <K extends keyof Estado>(campo: K, valor: Estado[K]) => setEstado((e) => ({ ...e, [campo]: valor }));

  const maeSelecionada = colonias?.find((c) => c.id === estado.coloniaMaeId);
  const doadoraSelecionada = colonias?.find((c) => c.id === estado.coloniaDoadoraId);
  // Espécie é imutável depois de definida; colônia COL-NNN pode ser identificada uma vez.
  const especieTravada = Boolean(colonia?.especieId);
  // Colônias formadas a partir desta (filhas e receptoras de campeiras): não podem ter entrado antes dela.
  const derivadas = colonia
    ? (colonias ?? []).filter((c) => c.coloniaMaeId === colonia.id || c.coloniaDoadoraCampeirasId === colonia.id)
    : [];
  const derivadaAnterior = derivadas.find((c) => c.dataEntrada.slice(0, 10) < estado.dataEntrada);
  const divisao = estado.origem === "divisao";
  const conflitoOrigem = (rel: typeof maeSelecionada, papel: string) =>
    !rel
      ? undefined
      : rel.especieId && estado.especieId && rel.especieId !== estado.especieId
        ? `A colônia ${papel} é de outra espécie: uma divisão não muda de espécie.`
        : estado.dataEntrada && estado.dataEntrada < rel.dataEntrada.slice(0, 10)
          ? `A data de entrada não pode ser anterior à da colônia ${papel} (${rel.codigo}).`
          : undefined;

  const hoje = paraInputData(new Date());
  const erros = {
    dataEntrada: !estado.dataEntrada
      ? "Informe a data de entrada."
      : estado.dataEntrada > hoje
        ? "A data de entrada não pode ser futura."
        : derivadaAnterior
          ? `A data de entrada não pode ser posterior à de ${derivadaAnterior.codigo}, formada a partir desta colônia.`
          : undefined,
    coloniaMaeId: !divisao ? undefined : !estado.coloniaMaeId ? "Selecione a colônia-mãe." : conflitoOrigem(maeSelecionada, "mãe"),
    coloniaDoadoraId: !divisao ? undefined : conflitoOrigem(doadoraSelecionada, "doadora"),
    latitude: estado.latitude && !Number.isFinite(numeroOuNull(estado.latitude)) ? "Número inválido." : undefined,
    longitude: estado.longitude && !Number.isFinite(numeroOuNull(estado.longitude)) ? "Número inválido." : undefined,
  };
  const valido = !Object.values(erros).some(Boolean);
  const erro = (c: keyof typeof erros) => (tentou ? erros[c] : undefined);

  const salvar = useMutation({
    mutationFn: () => (colonia ? coloniasApi.atualizar(colonia.id, paraPayload(estado)) : coloniasApi.criar(paraPayload(estado))),
    onSuccess: (salva) => {
      queryClient.invalidateQueries({ queryKey: chaves.colonias });
      navegar(`/app/colonias/${salva.id}`, { replace: true });
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (valido) salvar.mutate();
  };

  const usarLocalizacao = () => {
    if (!navigator.geolocation) return setGps("erro");
    setGps("buscando");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setEstado((e) => ({ ...e, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
        setGps("idle");
      },
      () => setGps("erro"),
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  };

  // Mãe possível: mesma espécie (ou sem espécie identificada) e fora da própria
  // descendência — a filha de uma colônia não pode ser a mãe dela.
  const descendentes = new Set<string>(colonia ? [colonia.id] : []);
  for (let novos = true; novos; ) {
    novos = false;
    for (const c of colonias ?? []) {
      if (c.coloniaMaeId && descendentes.has(c.coloniaMaeId) && !descendentes.has(c.id)) {
        descendentes.add(c.id);
        novos = true;
      }
    }
  }
  const maesPossiveis = (colonias ?? []).filter(
    (c) =>
      !descendentes.has(c.id) &&
      (!estado.especieId || !c.especieId || c.especieId === estado.especieId || c.id === estado.coloniaMaeId)
  );
  // Doadora: mesmas condições da mãe, mas outra colônia que não a mãe.
  const doadorasPossiveis = (colonias ?? []).filter(
    (c) =>
      !descendentes.has(c.id) &&
      c.id !== estado.coloniaMaeId &&
      (!estado.especieId || !c.especieId || c.especieId === estado.especieId || c.id === estado.coloniaDoadoraId)
  );

  return (
    <>
      <CabecalhoPagina
        voltar={
          <Link to={colonia ? `/app/colonias/${colonia.id}` : "/app/colonias"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </Link>
        }
        titulo={colonia ? `Editar ${colonia.codigo}` : "Nova colônia"}
        subtitulo={colonia ? undefined : "O código é gerado automaticamente a partir da espécie (ex.: TETRANGU-001)."}
      />

      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Cartao className="space-y-4">
          <h2 className="font-semibold text-foreground">Identificação</h2>
          <Campo
            rotulo="Espécie"
            ajuda={
              especieTravada
                ? "A espécie não pode ser alterada depois de definida."
                : colonia
                  ? "Ao identificar, o código passa a ser o da espécie (ex.: TETRANGU-004). Depois disso, não pode mais ser alterada."
                  : "Não poderá ser alterada depois. Deixe em branco se ainda não identificou — o código fica COL-NNN."
            }
          >
            {(id) => (
              <Selecao id={id} value={estado.especieId} disabled={especieTravada} onChange={(e) => alterar("especieId", e.target.value)}>
                <option value="">Não identificada</option>
                {especies?.map((esp) => (
                  <option key={esp.id} value={esp.id}>
                    {esp.nomePopular} — {esp.nomeCientifico}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Data de entrada" obrigatorio erro={erro("dataEntrada")}>
              {(id) => (
                <Entrada id={id} type="date" max={hoje} value={estado.dataEntrada} onChange={(e) => alterar("dataEntrada", e.target.value)} />
              )}
            </Campo>
            <Campo rotulo="Status">
              {(id) => (
                <Selecao id={id} value={estado.status} onChange={(e) => alterar("status", e.target.value as StatusColonia)}>
                  {(Object.keys(ROTULO_STATUS_COLONIA) as StatusColonia[]).map((s) => (
                    <option key={s} value={s}>
                      {ROTULO_STATUS_COLONIA[s]}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>
        </Cartao>

        <Cartao className="space-y-4">
          <h2 className="font-semibold text-foreground">Origem</h2>
          <fieldset>
            <legend className="sr-only">Tipo de origem</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(ROTULO_ORIGEM) as Origem[]).map((o) => (
                <label
                  key={o}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3 text-sm font-medium ${
                    estado.origem === o ? "border-sidebar bg-sidebar text-sidebar-primary" : "border-input text-muted-foreground"
                  }`}
                >
                  <input type="radio" name="origem" value={o} checked={estado.origem === o} onChange={() => alterar("origem", o)} className="sr-only" />
                  {ROTULO_ORIGEM[o]}
                </label>
              ))}
            </div>
          </fieldset>
          {divisao && (
            <Campo rotulo="Colônia-mãe" obrigatorio erro={erro("coloniaMaeId")} ajuda="Registra a genealogia (linhagem mãe → filha).">
              {(id) => (
                <Selecao
                  id={id}
                  value={estado.coloniaMaeId}
                  onChange={(e) => {
                    const maeId = e.target.value;
                    // a mãe não pode ser também a doadora
                    setEstado((s) => ({ ...s, coloniaMaeId: maeId, coloniaDoadoraId: s.coloniaDoadoraId === maeId ? "" : s.coloniaDoadoraId }));
                  }}
                >
                  <option value="">Selecione…</option>
                  {maesPossiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo}
                      {c.especie ? ` — ${c.especie.nomePopular}` : ""}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
          {divisao && (
            <Campo
              rotulo="Colônia doadora de campeiras"
              erro={erro("coloniaDoadoraId")}
              ajuda="Opcional: preencha se outra colônia doou campeiras para fortalecer esta divisão."
            >
              {(id) => (
                <Selecao id={id} value={estado.coloniaDoadoraId} onChange={(e) => alterar("coloniaDoadoraId", e.target.value)}>
                  <option value="">Nenhuma</option>
                  {doadorasPossiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo}
                      {c.especie ? ` — ${c.especie.nomePopular}` : ""}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        </Cartao>

        <Cartao className="space-y-4">
          <h2 className="font-semibold text-foreground">Caixa e localização</h2>
          <Campo rotulo="Tipo de caixa">
            {(id) => (
              <Selecao id={id} value={estado.tipoCaixa} onChange={(e) => alterar("tipoCaixa", e.target.value as TipoCaixa)}>
                {(Object.keys(ROTULO_CAIXA) as TipoCaixa[]).map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_CAIXA[t]}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            {(["altura", "largura", "profundidade"] as const).map((d) => (
              <Campo key={d} rotulo={`${d[0]!.toUpperCase()}${d.slice(1)} (cm)`}>
                {(id) => (
                  <Entrada id={id} inputMode="decimal" value={estado[d]} onChange={(e) => alterar(d, e.target.value)} />
                )}
              </Campo>
            ))}
          </div>
          <Campo rotulo="Localização no meliponário" ajuda="Ex.: Setor A, prateleira 2">
            {(id) => <Entrada id={id} value={estado.localizacao} onChange={(e) => alterar("localizacao", e.target.value)} />}
          </Campo>
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Latitude" erro={erro("latitude")}>
                {(id) => <Entrada id={id} inputMode="decimal" value={estado.latitude} onChange={(e) => alterar("latitude", e.target.value)} />}
              </Campo>
              <Campo rotulo="Longitude" erro={erro("longitude")}>
                {(id) => <Entrada id={id} inputMode="decimal" value={estado.longitude} onChange={(e) => alterar("longitude", e.target.value)} />}
              </Campo>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Botao type="button" variante="secundario" tamanho="sm" onClick={usarLocalizacao} carregando={gps === "buscando"}>
                <LocateFixed className="size-4" aria-hidden /> Usar localização atual
              </Botao>
              {gps === "erro" && <span className="text-sm text-destructive">Não foi possível obter a localização.</span>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Opcional. Com coordenadas, o clima de cada avaliação é preenchido automaticamente (sem coordenada da colônia,
              usa-se a do meliponário).
            </p>
          </div>
        </Cartao>

        <Cartao>
          <Campo rotulo="Observações">
            {(id) => <AreaTexto id={id} value={estado.observacoes} onChange={(e) => alterar("observacoes", e.target.value)} />}
          </Campo>
        </Cartao>

        <MensagemErro erro={salvar.error} />
        {tentou && !valido && <p className="text-sm text-destructive">Corrija os campos destacados.</p>}
        <div className="flex gap-3">
          <Botao type="submit" tamanho="lg" className="flex-1 sm:flex-none" carregando={salvar.isPending}>
            {colonia ? "Salvar alterações" : "Cadastrar colônia"}
          </Botao>
          <Botao type="button" variante="fantasma" tamanho="lg" onClick={() => navegar(-1)}>
            Cancelar
          </Botao>
        </div>
      </form>
    </>
  );
}
