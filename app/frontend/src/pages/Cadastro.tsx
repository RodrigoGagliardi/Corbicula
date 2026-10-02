import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { LayoutPublico } from "../components/layout/LayoutPublico";
import { Botao } from "../components/ui/Botao";
import { Campo, Entrada } from "../components/ui/Campo";
import { MensagemErro } from "../components/ui/Estados";
import { authApi } from "../services/api/endpoints";
import { useAuth } from "../store/auth";

const SENHA_MINIMA = 6; // mesma regra do backend (auth.types.ts)

export function Cadastro() {
  const entrar = useAuth((s) => s.entrar);
  const navegar = useNavigate();
  const [dados, setDados] = useState({ nome: "", email: "", senha: "", confirmacao: "", meliponario: "" });
  const [tentou, setTentou] = useState(false);

  const alterar = (campo: keyof typeof dados) => (e: { target: { value: string } }) =>
    setDados((d) => ({ ...d, [campo]: e.target.value }));

  const erros = {
    nome: dados.nome.trim().length < 2 ? "Informe seu nome." : undefined,
    email: /^\S+@\S+\.\S+$/.test(dados.email.trim()) ? undefined : "E-mail inválido.",
    senha: dados.senha.length < SENHA_MINIMA ? `Use ao menos ${SENHA_MINIMA} caracteres.` : undefined,
    confirmacao: dados.confirmacao !== dados.senha ? "As senhas não coincidem." : undefined,
  };
  const valido = !Object.values(erros).some(Boolean);

  const cadastro = useMutation({
    mutationFn: () =>
      authApi.cadastrar({
        name: dados.nome.trim(),
        email: dados.email.trim(),
        password: dados.senha,
        ...(dados.meliponario.trim() && { meliponario: { nome: dados.meliponario.trim() } }),
      }),
    onSuccess: ({ token, user }) => {
      entrar(token, user);
      navegar("/parametros", { replace: true, state: { boasVindas: true } });
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (valido) cadastro.mutate();
  };

  const erro = (campo: keyof typeof erros) => (tentou ? erros[campo] : undefined);

  return (
    <LayoutPublico titulo="Criar conta" subtitulo="Gratuito e de código aberto.">
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo rotulo="Nome" obrigatorio erro={erro("nome")}>
          {(id) => <Entrada id={id} autoComplete="name" value={dados.nome} onChange={alterar("nome")} />}
        </Campo>
        <Campo rotulo="E-mail" obrigatorio erro={erro("email")}>
          {(id) => (
            <Entrada id={id} type="email" autoComplete="email" value={dados.email} onChange={alterar("email")} />
          )}
        </Campo>
        <Campo rotulo="Senha" obrigatorio erro={erro("senha")}>
          {(id) => (
            <Entrada id={id} type="password" autoComplete="new-password" value={dados.senha} onChange={alterar("senha")} />
          )}
        </Campo>
        <Campo rotulo="Confirmar senha" obrigatorio erro={erro("confirmacao")}>
          {(id) => (
            <Entrada
              id={id}
              type="password"
              autoComplete="new-password"
              value={dados.confirmacao}
              onChange={alterar("confirmacao")}
            />
          )}
        </Campo>
        <Campo rotulo="Nome do meliponário" ajuda="Opcional — pode ser configurado depois.">
          {(id) => <Entrada id={id} value={dados.meliponario} onChange={alterar("meliponario")} />}
        </Campo>
        <MensagemErro erro={cadastro.error} />
        <Botao type="submit" className="w-full" carregando={cadastro.isPending}>
          Criar conta
        </Botao>
      </form>
      <p className="mt-6 text-center text-sm text-stone-600">
        Já tem conta?{" "}
        <Link to="/login" className="font-medium text-mel-800 hover:underline">
          Entrar
        </Link>
      </p>
    </LayoutPublico>
  );
}
