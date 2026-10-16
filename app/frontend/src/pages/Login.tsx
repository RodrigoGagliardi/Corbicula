import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { CartaoAutenticacao } from "../components/layout/CartaoAutenticacao";
import { Botao } from "../components/ui/Botao";
import { Campo, Entrada } from "../components/ui/Campo";
import { MensagemErro } from "../components/ui/Estados";
import { authApi } from "../services/api/endpoints";
import { useAuth } from "../store/auth";

export function Login() {
  const entrar = useAuth((s) => s.entrar);
  const navegar = useNavigate();
  const destino = (useLocation().state as { de?: string } | null)?.de ?? "/app";
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const login = useMutation({
    mutationFn: () => authApi.entrar(email.trim(), senha),
    onSuccess: ({ token, user }) => {
      entrar(token, user);
      navegar(destino, { replace: true });
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <CartaoAutenticacao titulo="Entrar" subtitulo="Acesse seu meliponário.">
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo rotulo="E-mail">
          {(id) => (
            <Entrada
              id={id}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Senha">
          {(id) => (
            <Entrada
              id={id}
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          )}
        </Campo>
        <p className="-mt-2 text-right text-sm">
          <Link to="/recuperar-senha" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Esqueci minha senha
          </Link>
        </p>
        <MensagemErro erro={login.error} />
        <Botao type="submit" className="w-full" carregando={login.isPending} disabled={!email || !senha}>
          Entrar
        </Botao>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-medium text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:decoration-foreground">
          Criar conta
        </Link>
      </p>
    </CartaoAutenticacao>
  );
}
