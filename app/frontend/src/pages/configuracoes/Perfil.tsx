import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Botao } from "../../components/ui/Botao";
import { Campo, Entrada } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { Carregando, ErroCarregamento, MensagemErro } from "../../components/ui/Estados";
import { chaves, useEu } from "../../hooks/useDados";
import { usuariosApi } from "../../services/api/endpoints";
import { useAuth } from "../../store/auth";
import type { Usuario } from "../../types/api";
import { formatarData } from "../../utils/format";
import { VoltarConfiguracoes } from "./Configuracoes";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Perfil() {
  const { data: usuario, isLoading, error, refetch } = useEu();
  return (
    <>
      <CabecalhoPagina voltar={<VoltarConfiguracoes />} titulo="Perfil" subtitulo="Seus dados de acesso." />
      {isLoading ? (
        <Carregando />
      ) : error || !usuario ? (
        <ErroCarregamento erro={error} tentarDeNovo={() => refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <DadosPessoais usuario={usuario} />
          <AlterarSenha />
          <ExcluirConta />
        </div>
      )}
    </>
  );
}

function Salvo({ visivel }: { visivel: boolean }) {
  if (!visivel) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground" role="status">
      <Check className="size-4 text-primary" aria-hidden /> Salvo
    </span>
  );
}

function DadosPessoais({ usuario }: { usuario: Usuario }) {
  const queryClient = useQueryClient();
  const atualizarUsuario = useAuth((s) => s.atualizarUsuario);
  const [dados, setDados] = useState({ name: usuario.name, email: usuario.email });
  const [tentou, setTentou] = useState(false);

  const erros = {
    name: dados.name.trim().length < 2 ? "Use ao menos 2 caracteres." : undefined,
    email: EMAIL_VALIDO.test(dados.email.trim()) ? undefined : "E-mail inválido.",
  };
  const erro = (c: keyof typeof erros) => (tentou ? erros[c] : undefined);

  const salvar = useMutation({
    mutationFn: () => usuariosApi.atualizarPerfil({ name: dados.name.trim(), email: dados.email.trim() }),
    onSuccess: (atualizado) => {
      atualizarUsuario(atualizado);
      queryClient.setQueryData(chaves.eu, atualizado);
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!erros.name && !erros.email) salvar.mutate();
  };

  return (
    <form onSubmit={enviar} noValidate>
      <Cartao className="space-y-4">
        <h2 className="font-semibold text-foreground">Dados pessoais</h2>
        <Campo rotulo="Nome" obrigatorio erro={erro("name")}>
          {(id) => (
            <Entrada id={id} autoComplete="name" value={dados.name} onChange={(e) => setDados((d) => ({ ...d, name: e.target.value }))} />
          )}
        </Campo>
        <Campo rotulo="E-mail" obrigatorio erro={erro("email")} ajuda="Usado para entrar no Corbicula.">
          {(id) => (
            <Entrada
              id={id}
              type="email"
              autoComplete="email"
              value={dados.email}
              onChange={(e) => setDados((d) => ({ ...d, email: e.target.value }))}
            />
          )}
        </Campo>
        <p className="text-sm text-muted-foreground">Conta criada em {formatarData(usuario.createdAt)}.</p>
        <MensagemErro erro={salvar.error} />
        <div className="flex items-center gap-3">
          <Botao type="submit" carregando={salvar.isPending}>
            Salvar
          </Botao>
          <Salvo visivel={salvar.isSuccess} />
        </div>
      </Cartao>
    </form>
  );
}

function AlterarSenha() {
  const vazio = { atual: "", nova: "", confirmacao: "" };
  const [dados, setDados] = useState(vazio);
  const [tentou, setTentou] = useState(false);

  const erros = {
    atual: dados.atual ? undefined : "Informe a senha atual.",
    nova: dados.nova.length >= 6 ? undefined : "Use ao menos 6 caracteres.",
    confirmacao: dados.confirmacao === dados.nova ? undefined : "As senhas não conferem.",
  };
  const erro = (c: keyof typeof erros) => (tentou ? erros[c] : undefined);

  const salvar = useMutation({
    mutationFn: () => usuariosApi.alterarSenha(dados.atual, dados.nova),
    onSuccess: () => {
      setDados(vazio);
      setTentou(false);
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (!Object.values(erros).some(Boolean)) salvar.mutate();
  };

  const campo = (c: keyof typeof dados, rotulo: string, autoComplete: string) => (
    <Campo rotulo={rotulo} obrigatorio erro={erro(c)}>
      {(id) => (
        <Entrada
          id={id}
          type="password"
          autoComplete={autoComplete}
          value={dados[c]}
          onChange={(e) => {
            salvar.reset();
            setDados((d) => ({ ...d, [c]: e.target.value }));
          }}
        />
      )}
    </Campo>
  );

  return (
    <form onSubmit={enviar} noValidate>
      <Cartao className="space-y-4">
        <h2 className="font-semibold text-foreground">Alterar senha</h2>
        {campo("atual", "Senha atual", "current-password")}
        {campo("nova", "Nova senha", "new-password")}
        {campo("confirmacao", "Repita a nova senha", "new-password")}
        <MensagemErro erro={salvar.error} />
        <div className="flex items-center gap-3">
          <Botao type="submit" variante="secundario" carregando={salvar.isPending}>
            Alterar senha
          </Botao>
          <Salvo visivel={salvar.isSuccess} />
        </div>
      </Cartao>
    </form>
  );
}

// Direito de exclusão (LGPD). Pede a senha e oferece o backup antes: não há
// como recuperar os dados depois.
function ExcluirConta() {
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const sair = useAuth((s) => s.sair);
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");

  const excluir = useMutation({
    mutationFn: () => usuariosApi.excluirConta(senha),
    onSuccess: () => {
      navegar("/", { replace: true });
      sair();
      queryClient.clear();
    },
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (senha) excluir.mutate();
  };

  return (
    <Cartao className="space-y-3 border-destructive/40 md:col-span-2">
      <h2 className="font-semibold text-destructive">Excluir conta</h2>
      <p className="text-sm text-muted-foreground">
        Apaga a conta e <strong className="text-foreground">todos os dados</strong>: meliponário, colônias, avaliações,
        fotos, produções e parâmetros. Não dá para desfazer. Antes, baixe o{" "}
        <Link to="/app/configuracoes/dados" className="text-foreground underline decoration-accent decoration-2 underline-offset-4">
          backup completo
        </Link>
        .
      </p>
      {aberto ? (
        <form onSubmit={enviar} className="space-y-3" noValidate>
          <Campo rotulo="Confirme com sua senha" obrigatorio>
            {(id) => (
              <Entrada
                id={id}
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => {
                  excluir.reset();
                  setSenha(e.target.value);
                }}
                className="max-w-sm"
              />
            )}
          </Campo>
          <MensagemErro erro={excluir.error} />
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" variante="perigo" disabled={!senha} carregando={excluir.isPending}>
              <Trash2 className="size-4" aria-hidden /> Excluir conta e dados
            </Botao>
            <Botao
              type="button"
              variante="fantasma"
              onClick={() => {
                setAberto(false);
                setSenha("");
                excluir.reset();
              }}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      ) : (
        <Botao variante="secundario" onClick={() => setAberto(true)}>
          <Trash2 className="size-4" aria-hidden /> Quero excluir minha conta
        </Botao>
      )}
    </Cartao>
  );
}
