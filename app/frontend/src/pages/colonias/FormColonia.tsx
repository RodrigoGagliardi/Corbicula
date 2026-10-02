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

  const hoje = paraInputData(new Date());
  const erros = {
    dataEntrada: !estado.dataEntrada
      ? "Informe a data de entrada."
      : estado.dataEntrada > hoje
        ? "A data de entrada não pode ser futura."
        : undefined,
    coloniaMaeId: estado.origem === "divisao" && !estado.coloniaMaeId ? "Selecione a colônia-mãe." : undefined,
    latitude: estado.latitude && !Number.isFinite(numeroOuNull(estado.latitude)) ? "Número inválido." : undefined,
    longitude: estado.longitude && !Number.isFinite(numeroOuNull(estado.longitude)) ? "Número inválido." : undefined,
  };
  const valido = !Object.values(erros).some(Boolean);
  const erro = (c: keyof typeof erros) => (tentou ? erros[c] : undefined);

  const salvar = useMutation({
    mutationFn: () => (colonia ? coloniasApi.atualizar(colonia.id, paraPayload(estado)) : coloniasApi.criar(paraPayload(estado))),
    onSuccess: (salva) => {
      queryClient.invalidateQueries({ queryKey: chaves.colonias });
      navegar(`/colonias/${salva.id}`, { replace: true });
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

  const maesPossiveis = (colonias ?? []).filter((c) => c.id !== colonia?.id);

  return (
    <>
      <CabecalhoPagina
        voltar={
          <Link to={colonia ? `/colonias/${colonia.id}` : "/colonias"} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </Link>
        }
        titulo={colonia ? `Editar ${colonia.codigo}` : "Nova colônia"}
        subtitulo={colonia ? undefined : "O código é gerado automaticamente a partir da espécie (ex.: TETRANGU-001)."}
      />

      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Cartao className="space-y-4">
          <h2 className="font-semibold text-stone-800">Identificação</h2>
          <Campo rotulo="Espécie" ajuda="Deixe em branco se ainda não identificou — o código fica COL-NNN.">
            {(id) => (
              <Selecao id={id} value={estado.especieId} onChange={(e) => alterar("especieId", e.target.value)}>
                <option value="">Não identificada</option>
                {especies?.map((esp) => (
                  <option key={esp.id} value={esp.id}>
                    {esp.nomePopular} — {esp.nomeCientifico}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          {colonia && colonia.especieId !== (estado.especieId || null) && (
            <p className="rounded-xl bg-mel-50 px-3 py-2 text-sm text-mel-900">
              O código <b className="font-mono">{colonia.codigo}</b> não muda ao trocar a espécie.
            </p>
          )}
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
          <h2 className="font-semibold text-stone-800">Origem</h2>
          <fieldset>
            <legend className="sr-only">Tipo de origem</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(ROTULO_ORIGEM) as Origem[]).map((o) => (
                <label
                  key={o}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-3 text-sm font-medium ${
                    estado.origem === o ? "border-mel-700 bg-mel-50 text-mel-900" : "border-stone-300 text-stone-600"
                  }`}
                >
                  <input type="radio" name="origem" value={o} checked={estado.origem === o} onChange={() => alterar("origem", o)} className="sr-only" />
                  {ROTULO_ORIGEM[o]}
                </label>
              ))}
            </div>
          </fieldset>
          {estado.origem === "divisao" && (
            <Campo rotulo="Colônia-mãe" obrigatorio erro={erro("coloniaMaeId")} ajuda="Registra a genealogia (linhagem mãe → filha).">
              {(id) => (
                <Selecao id={id} value={estado.coloniaMaeId} onChange={(e) => alterar("coloniaMaeId", e.target.value)}>
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
        </Cartao>

        <Cartao className="space-y-4">
          <h2 className="font-semibold text-stone-800">Caixa e localização</h2>
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
              {gps === "erro" && <span className="text-sm text-red-600">Não foi possível obter a localização.</span>}
            </div>
            <p className="mt-2 text-sm text-stone-500">
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
        {tentou && !valido && <p className="text-sm text-red-600">Corrija os campos destacados.</p>}
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
