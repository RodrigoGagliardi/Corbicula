import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ImageOff } from "lucide-react";
import { useRef } from "react";
import { useFotos } from "../../hooks/useDados";
import { urlArquivo } from "../../services/api/client";
import { fotosApi } from "../../services/api/endpoints";
import { formatarData } from "../../utils/format";
import { comprimirImagem } from "../../utils/imagem";
import { classesBotao } from "../ui/Botao";
import { MensagemErro } from "../ui/Estados";

// Galeria + upload opcional. Foto nunca é obrigatória (claude.md §8).
export function GaleriaFotos({ vinculo }: { vinculo: { coloniaId: string } | { avaliacaoId: string } }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const { data: fotos } = useFotos(vinculo);

  const enviar = useMutation({
    mutationFn: async (arquivo: File) => fotosApi.enviar(await comprimirImagem(arquivo), vinculo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fotos"] }),
  });

  return (
    <div className="space-y-3">
      {fotos && fotos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((f) => (
            <li key={f.id} className="overflow-hidden rounded-xl bg-stone-100">
              <a href={urlArquivo(f.url)} target="_blank" rel="noreferrer">
                <img src={urlArquivo(f.url)} alt={f.legenda ?? `Foto de ${formatarData(f.createdAt)}`} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-stone-500">
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

