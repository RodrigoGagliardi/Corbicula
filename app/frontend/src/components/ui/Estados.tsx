import type { ReactNode } from "react";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { useOnline } from "../../hooks/useOnline";
import { ErroApi } from "../../services/api/client";
import { ehErroDeConexao } from "../../services/offline/leituraLocal";
import { Botao } from "./Botao";

// Aviso das telas cujas alterações exigem conexão (parâmetros, perfil,
// meliponário, exportação, resolver alertas). Some quando o app está online.
export function AvisoSemConexao({ children }: { children: ReactNode }) {
  const online = useOnline();
  if (online) return null;
  return (
    <p className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground" role="status">
      <WifiOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

// Nota curta no lugar de uma seção que só existe no servidor (resumo, fotos),
// quando ela não carregou por falta de conexão. Quem chama decide quando mostrar.
export function NotaSemConexao({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <WifiOff className="size-4 shrink-0" aria-hidden /> {children}
    </p>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

export function ErroCarregamento({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo?: () => void }) {
  const online = useOnline();
  // Falha de conexão não é erro do app: aviso neutro, no lugar do erro genérico.
  // Com o navegador online, quem não respondeu foi o servidor (fora do ar, endereço errado).
  if (ehErroDeConexao(erro)) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted px-6 py-10 text-center" role="status">
        <WifiOff className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium text-foreground">{online ? "Servidor indisponível" : "Sem conexão com o servidor"}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {online
            ? "Não foi possível falar com o servidor. Verifique se ele está no ar e tente de novo."
            : "Esta informação precisa de conexão para carregar. Ela aparece aqui quando o app estiver online."}
        </p>
        {tentarDeNovo && (
          <Botao variante="secundario" onClick={tentarDeNovo}>
            Tentar de novo
          </Botao>
        )}
      </div>
    );
  }
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
