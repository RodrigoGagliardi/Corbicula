import { Link } from "react-router";
import { CartaoAutenticacao } from "../components/layout/CartaoAutenticacao";

// O backend ainda não envia e-mails de recuperação; a tela existe para a rota
// do fluxo público e explica a situação em vez de simular um envio.
export function RecuperarSenha() {
  return (
    <CartaoAutenticacao titulo="Recuperar senha" subtitulo="Redefinição de senha por e-mail.">
      <div className="space-y-4 text-sm text-muted-foreground">
        <p className="rounded-xl bg-accent/25 px-3 py-2 text-foreground">
          A recuperação por e-mail ainda não está disponível nesta versão.
        </p>
        <p>
          Como o Corbicula roda localmente, quem administra a instalação pode redefinir a sua senha diretamente no banco de
          dados.
        </p>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Link to="/login" className="font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground">
          Entrar
        </Link>
      </p>
    </CartaoAutenticacao>
  );
}
