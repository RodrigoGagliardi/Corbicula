import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, LocateFixed } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Botao } from "../../components/ui/Botao";
import { Campo, Entrada, Selecao } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useEu } from "../../hooks/useDados";
import { usuariosApi } from "../../services/api/endpoints";
import { useAuth } from "../../store/auth";
import type { Meliponario, MeliponarioInput } from "../../types/api";
import { VoltarConfiguracoes } from "./Configuracoes";

// Biomas do RS. Um valor diferente já salvo continua aparecendo na lista.
const BIOMAS = ["Pampa", "Mata Atlântica"];

// Aceita vírgula decimal ("-30,03"). Vazio → undefined; inválido → NaN.
const paraNumero = (texto: string) => (texto.trim() ? Number(texto.trim().replace(",", ".")) : undefined);
const paraTexto = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function PaginaMeliponario() {
  const { data: usuario, isLoading, error, refetch } = useEu();
  return (
    <>
      <CabecalhoPagina
        voltar={<VoltarConfiguracoes />}
        titulo="Meliponário"
        subtitulo="As coordenadas daqui são usadas no clima automático das colônias que não têm coordenadas próprias."
      />
      {isLoading ? (
        <Carregando />
      ) : error || !usuario ? (
        <ErroCarregamento erro={error} tentarDeNovo={() => refetch()} />
      ) : (
        <Formulario meliponario={usuario.meliponario} />
      )}
    </>
  );
}

function Formulario({ meliponario }: { meliponario: Meliponario | null }) {
  const queryClient = useQueryClient();
  const [dados, setDados] = useState({
    nome: meliponario?.nome ?? "",
    endereco: meliponario?.endereco ?? "",
    cidade: meliponario?.cidade ?? "",
    estado: meliponario?.estado ?? "",
    bioma: meliponario?.bioma ?? "",
    latitude: paraTexto(meliponario?.latitude),
    longitude: paraTexto(meliponario?.longitude),
    areaTotal: paraTexto(meliponario?.areaTotal),
  });
  const [tentou, setTentou] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string>();

  const alterar = (campo: keyof typeof dados) => (e: { target: { value: string } }) =>
    setDados((d) => ({ ...d, [campo]: e.target.value }));

  const lat = paraNumero(dados.latitude);
  const lon = paraNumero(dados.longitude);
  const area = paraNumero(dados.areaTotal);
  const erros = {
    nome: dados.nome.trim().length < 2 ? "Use ao menos 2 caracteres." : undefined,
    latitude:
      lat !== undefined && !(lat >= -90 && lat <= 90)
        ? "Latitude entre -90 e 90 (ex.: -30,0346)."
        : lat === undefined && lon !== undefined
          ? "Informe a latitude junto com a longitude."
          : undefined,
    longitude:
      lon !== undefined && !(lon >= -180 && lon <= 180)
        ? "Longitude entre -180 e 180 (ex.: -51,2177)."
        : lon === undefined && lat !== undefined
          ? "Informe a longitude junto com a latitude."
          : undefined,
    areaTotal: area !== undefined && !(area > 0) ? "Use um número maior que zero." : undefined,
  };
  const erro = (c: keyof typeof erros) => (tentou ? erros[c] : undefined);

  const salvar = useMutation({
    mutationFn: () => {
      const texto = (v: string) => (v.trim() ? v.trim() : undefined);
      const payload: MeliponarioInput = { nome: dados.nome.trim() };
      for (const campo of ["endereco", "cidade", "estado", "bioma"] as const) {
        const v = texto(dados[campo]);
        if (v) payload[campo] = v;
      }
      if (lat !== undefined) payload.latitude = lat;
      if (lon !== undefined) payload.longitude = lon;
      if (area !== undefined) payload.areaTotal = area;
      return usuariosApi.salvarMeliponario(payload);
    },
    onSuccess: (salvo) => {
      const usuario = useAuth.getState().usuario;
      if (usuario) useAuth.getState().atualizarUsuario({ ...usuario, meliponario: salvo });
      queryClient.invalidateQueries({ queryKey: chaves.eu });
    },
  });

  const usarLocalizacao = () => {
    setErroLocal(undefined);
    if (!("geolocation" in navigator)) {
      setErroLocal("Este navegador não informa a localização.");
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocalizando(false);
        setDados((d) => ({ ...d, latitude: coords.latitude.toFixed(5), longitude: coords.longitude.toFixed(5) }));
      },
      () => {
        setLocalizando(false);
        setErroLocal("Não foi possível obter a localização. Verifique a permissão do navegador ou digite as coordenadas.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!Object.values(erros).some(Boolean)) salvar.mutate();
  };

  const biomas = dados.bioma && !BIOMAS.includes(dados.bioma) ? [...BIOMAS, dados.bioma] : BIOMAS;

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Cartao className="space-y-4">
          <h2 className="font-semibold text-foreground">Identificação</h2>
          <Campo rotulo="Nome" obrigatorio erro={erro("nome")}>
            {(id) => <Entrada id={id} placeholder="Ex.: Meliponário do Sítio" value={dados.nome} onChange={alterar("nome")} />}
          </Campo>
          <Campo rotulo="Endereço">
            {(id) => <Entrada id={id} autoComplete="street-address" value={dados.endereco} onChange={alterar("endereco")} />}
          </Campo>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Campo rotulo="Cidade">
              {(id) => <Entrada id={id} autoComplete="address-level2" value={dados.cidade} onChange={alterar("cidade")} />}
            </Campo>
            <Campo rotulo="UF">
              {(id) => (
                <Entrada id={id} autoComplete="address-level1" placeholder="RS" maxLength={2} value={dados.estado} onChange={alterar("estado")} />
              )}
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Bioma">
              {(id) => (
                <Selecao id={id} value={dados.bioma} onChange={alterar("bioma")}>
                  <option value="">Não informado</option>
                  {biomas.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo rotulo="Área total (m²)" erro={erro("areaTotal")}>
              {(id) => <Entrada id={id} inputMode="decimal" value={dados.areaTotal} onChange={alterar("areaTotal")} />}
            </Campo>
          </div>
        </Cartao>

        <Cartao className="space-y-4">
          <div>
            <h2 className="font-semibold text-foreground">Coordenadas</h2>
            <p className="text-sm text-muted-foreground">
              Graus decimais (WGS 84). Sem coordenadas aqui nem na colônia, o clima não é preenchido automaticamente (a avaliação é salva do mesmo jeito).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Latitude" erro={erro("latitude")}>
              {(id) => <Entrada id={id} inputMode="decimal" placeholder="-30,0346" value={dados.latitude} onChange={alterar("latitude")} />}
            </Campo>
            <Campo rotulo="Longitude" erro={erro("longitude")}>
              {(id) => <Entrada id={id} inputMode="decimal" placeholder="-51,2177" value={dados.longitude} onChange={alterar("longitude")} />}
            </Campo>
          </div>
          <Botao type="button" variante="secundario" onClick={usarLocalizacao} carregando={localizando}>
            <LocateFixed className="size-4" aria-hidden /> Usar minha localização
          </Botao>
          {erroLocal && (
            <p className="text-sm text-destructive" role="alert">
              {erroLocal}
            </p>
          )}
        </Cartao>
      </div>

      <MensagemErro erro={salvar.error} />
      <div className="flex items-center gap-3">
        <Botao type="submit" tamanho="lg" className="w-full sm:w-auto" carregando={salvar.isPending}>
          Salvar
        </Botao>
        {salvar.isSuccess && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground" role="status">
            <Check className="size-4 text-primary" aria-hidden /> Salvo
          </span>
        )}
      </div>
    </form>
  );
}
