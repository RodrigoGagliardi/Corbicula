import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ErroApi } from "../../services/api/client";
import { Botao } from "./Botao";

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

export function ErroCarregamento({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo?: () => void }) {
  const mensagem = erro instanceof ErroApi ? erro.mensagemAmigavel : "Não foi possível carregar os dados.";
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-6 py-10 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <p className="text-destructive">{mensagem}</p>
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
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-input bg-card px-6 py-12 text-center">
      <div className="text-primary">{icone}</div>
      <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      {descricao && <p className="max-w-sm text-muted-foreground">{descricao}</p>}
      {acao}
    </div>
  );
}

export function MensagemErro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const texto = erro instanceof ErroApi ? erro.mensagemAmigavel : "Algo deu errado. Tente novamente.";
  return (
    <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
      {texto}
    </p>
  );
}
