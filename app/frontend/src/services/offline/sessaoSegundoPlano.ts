import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { useAuth } from "../../store/auth";
import { indexedDbDisponivel } from "./banco";

// Cópia da sessão (usuário + token) para o Service Worker, que não lê o
// localStorage onde o zustand guarda a sessão. Gravada a cada mudança da sessão
// (main.tsx) e apagada no logout e no 401; sem ela, o SW não sincroniza.
// O token aqui tem a mesma exposição do localStorage (mesma origem, legível por JS).

export interface SessaoSegundoPlano {
  usuarioId: string;
  token: string;
}

interface EsquemaSessao extends DBSchema {
  sessao: { key: string; value: SessaoSegundoPlano };
}

const NOME_BANCO = "corbicula-sessao";
const CHAVE = "atual";

let conexao: Promise<IDBPDatabase<EsquemaSessao>> | null = null;

function abrir(): Promise<IDBPDatabase<EsquemaSessao>> {
  if (!conexao) {
    conexao = openDB<EsquemaSessao>(NOME_BANCO, 1, {
      upgrade(db) {
        db.createObjectStore("sessao");
      },
      // Outra aba ou o SW pede uma versão nova: fecha esta para não travá-la.
      blocking() {
        void conexao?.then((db) => db.close());
        conexao = null;
      },
      terminated() {
        conexao = null;
      },
    });
    conexao.catch(() => {
      conexao = null;
    });
  }
  return conexao;
}

// Grava a sessão atual, ou apaga a cópia quando não há sessão. Nunca lança.
export async function espelharSessao(sessao: SessaoSegundoPlano | null): Promise<void> {
  if (!indexedDbDisponivel()) return;
  try {
    const db = await abrir();
    if (sessao) await db.put("sessao", sessao, CHAVE);
    else await db.delete("sessao", CHAVE);
  } catch (erro) {
    console.error("Não foi possível guardar a sessão para a sincronização em segundo plano:", erro);
  }
}

// Espelha a sessão atual e cada mudança dela (login, token renovado, troca de
// conta, logout, 401). Chamada uma vez no main.tsx; devolve o cancelamento.
export function observarSessao(): () => void {
  const espelhar = () => {
    const { token, usuario } = useAuth.getState();
    void espelharSessao(token && usuario ? { usuarioId: usuario.id, token } : null);
  };
  // Sessão que já estava no localStorage (ex.: logado antes desta versão).
  espelhar();
  return useAuth.subscribe((atual, anterior) => {
    if (atual.token !== anterior.token || atual.usuario?.id !== anterior.usuario?.id) espelhar();
  });
}

// Sessão espelhada, ou null (sem sessão, sem IndexedDB ou com falha). Nunca lança.
export async function lerSessaoEspelhada(): Promise<SessaoSegundoPlano | null> {
  if (!indexedDbDisponivel()) return null;
  try {
    return (await (await abrir()).get("sessao", CHAVE)) ?? null;
  } catch {
    return null;
  }
}
