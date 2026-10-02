import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ErroApi } from "../../services/api/client";
import { Botao } from "./Botao";

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-stone-500" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

export function ErroCarregamento({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo?: () => void }) {
  const mensagem = erro instanceof ErroApi ? erro.mensagemAmigavel : "Não foi possível carregar os dados.";
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
      <AlertTriangle className="size-8 text-red-600" aria-hidden />
      <p className="text-red-800">{mensagem}</p>
      {tentarDeNovo && (
        <Botao variante="secundario" onClick={tentarDeNovo}>
          Tentar de novo
        </Botao>
      )}
    </div>
  );
}

export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
      <div className="text-mel-600">{icone}</div>
      <h2 className="text-lg font-semibold text-stone-800">{titulo}</h2>
      {descricao && <p className="max-w-sm text-stone-500">{descricao}</p>}
      {acao}
    </div>
  );
}

export function MensagemErro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const texto = erro instanceof ErroApi ? erro.mensagemAmigavel : "Algo deu errado. Tente novamente.";
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      {texto}
    </p>
  );
}
