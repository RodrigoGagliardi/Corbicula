import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CloudUpload, ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFotos } from "../../hooks/useDados";
import { urlArquivo } from "../../services/api/client";
import { anexarFoto, fotosGuardadas, idDoVinculo } from "../../services/offline/fotos";
import { ehErroDeConexao } from "../../services/offline/leituraLocal";
import type { FotoPendente, VinculoFoto } from "../../services/offline/tipos";
import { formatarData } from "../../utils/format";
import { classesBotao } from "../ui/Botao";
import { MensagemErro, NotaSemConexao } from "../ui/Estados";

// Foto guardada no aparelho, mostrada a partir dos bytes locais.
function FotoGuardada({ foto }: { foto: FotoPendente }) {
  const [url, setUrl] = useState<string>();
  // Os bytes de uma foto guardada não mudam: a prévia só é refeita quando muda a
  // foto (por id), não a cada releitura da galeria.
  const { id, bytes, tipo } = foto;
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([bytes], { type: tipo }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [id]); // bytes e tipo são fixos para um id
  const rotulo = foto.estado === "erro" ? `Não enviada: ${foto.ultimoErro ?? "recusada pelo servidor"}` : "Aguardando envio";
  return (
    <li className="relative overflow-hidden rounded-xl bg-muted" title={rotulo}>
      {url && <img src={url} alt={`Foto guardada no aparelho (${rotulo.toLowerCase()})`} className="aspect-square w-full object-cover opacity-80" />}
      <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-background/85 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
        <CloudUpload className="size-3 shrink-0" aria-hidden /> {foto.estado === "erro" ? "Não enviada" : "Aguardando envio"}
      </span>
    </li>
  );
}

// Galeria + upload opcional. Foto nunca é obrigatória (claude.md §8). Sem
// conexão, a foto fica guardada no aparelho e aparece aqui até subir.
export function GaleriaFotos({ vinculo }: { vinculo: VinculoFoto }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const { data: fotos, error } = useFotos(vinculo);
  // Começa com "fotos": as invalidações de ["fotos"] também relêem as guardadas.
  const { data: guardadas = [] } = useQuery({
    queryKey: ["fotos", "guardadas", idDoVinculo(vinculo)],
    queryFn: () => fotosGuardadas(vinculo),
  });

  const enviar = useMutation({
    mutationFn: (arquivo: File) => anexarFoto(arquivo, vinculo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fotos"] }),
  });

  return (
    <div className="space-y-3">
      {guardadas.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos guardadas no aparelho">
          {guardadas.map((f) => (
            <FotoGuardada key={f.id} foto={f} />
          ))}
        </ul>
      )}
      {fotos && fotos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((f) => (
            <li key={f.id} className="overflow-hidden rounded-xl bg-muted">
              <a href={urlArquivo(f.url)} target="_blank" rel="noreferrer">
                <img src={urlArquivo(f.url)} alt={f.legenda ?? `Foto de ${formatarData(f.createdAt)}`} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : !fotos && ehErroDeConexao(error) ? (
        // As fotos já enviadas ficam só no servidor (sem cópia offline); as guardadas aparecem acima.
        <NotaSemConexao>As fotos enviadas precisam de conexão para aparecer.</NotaSemConexao>
      ) : guardadas.length > 0 ? null : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageOff className="size-4" aria-hidden /> Nenhuma foto.
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) enviar.mutate(arquivo);
          e.target.value = "";
        }}
      />
      <button type="button" onClick={() => input.current?.click()} className={classesBotao("secundario", "sm")} disabled={enviar.isPending}>
        <Camera className="size-4" aria-hidden /> {enviar.isPending ? "Enviando…" : "Adicionar foto"}
      </button>
      <MensagemErro erro={enviar.error} />
    </div>
  );
}

