import { useAuth } from "../../store/auth";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";

// Erro da API com status HTTP e mensagem já em português (vinda do backend).
export class ErroApi extends Error {
  readonly status: number;
  readonly detalhes: { campo: string; mensagem: string }[];

  constructor(status: number, mensagem: string, detalhes: { campo: string; mensagem: string }[] = []) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }

  // Mensagem do primeiro campo inválido, se houver, senão a mensagem geral.
  get mensagemAmigavel(): string {
    return this.detalhes[0]?.mensagem ?? this.message;
  }
}

type Corpo = object | FormData | undefined;

// Sem resposta neste prazo, a requisição é abortada e vira o erro de conexão
// (status 0): com sinal fraco, a escrita cai na fila offline e a leitura, na
// cópia local, em vez de esperar o limite do navegador.
export const TIMEOUT_PADRAO_MS = 30_000;
// Upload de foto, lote do /sync e pull (a carga inicial é a maior resposta): mais dados, mais tempo.
export const TIMEOUT_LONGO_MS = 120_000;

export interface OpcoesRequisicao {
  timeoutMs?: number;
}

async function requisicao<T>(metodo: string, caminho: string, corpo?: Corpo, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (corpo !== undefined && !(corpo instanceof FormData)) headers["Content-Type"] = "application/json";

  // O prazo cobre também a leitura do corpo da resposta.
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS);
  let res: Response;
  let dados: (T & { error?: string; detalhes?: { campo: string; mensagem: string }[] }) | null;
  try {
    try {
      res = await fetch(`${API_URL}${caminho}`, {
        method: metodo,
        headers,
        signal: controle.signal,
        ...(corpo !== undefined && { body: corpo instanceof FormData ? corpo : JSON.stringify(corpo) }),
      });
    } catch {
      throw new ErroApi(0, "Sem conexão com o servidor.");
    }

    // Token expirado/inválido: encerra a sessão; o roteador leva ao login.
    // A fila offline fica no IndexedDB e sobe no próximo login do mesmo usuário.
    if (res.status === 401 && token) useAuth.getState().sair();

    if (res.status === 204) return undefined as T;
    dados = await res.json().catch(() => {
      // Corpo interrompido pelo prazo: a resposta não chegou inteira.
      if (controle.signal.aborted) throw new ErroApi(0, "Sem conexão com o servidor.");
      return null;
    });
  } finally {
    clearTimeout(prazo);
  }

  if (!res.ok) {
    throw new ErroApi(res.status, dados?.error ?? `Erro ${res.status}`, dados?.detalhes ?? []);
  }
  return dados as T;
}

export const api = {
  get: <T>(caminho: string, opcoes?: OpcoesRequisicao) => requisicao<T>("GET", caminho, undefined, opcoes),
  post: <T>(caminho: string, corpo?: Corpo, opcoes?: OpcoesRequisicao) => requisicao<T>("POST", caminho, corpo, opcoes),
  patch: <T>(caminho: string, corpo?: Corpo) => requisicao<T>("PATCH", caminho, corpo),
  put: <T>(caminho: string, corpo?: Corpo) => requisicao<T>("PUT", caminho, corpo),
  delete: (caminho: string, corpo?: Corpo) => requisicao<void>("DELETE", caminho, corpo),
};

// Download autenticado (exportações): baixa o arquivo e dispara o "salvar" do
// navegador com o nome enviado pelo servidor.
export async function baixarArquivo(caminho: string, nomePadrao: string): Promise<void> {
  const token = useAuth.getState().token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${caminho}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ErroApi(0, "Sem conexão com o servidor.");
  }
  if (!res.ok) {
    const dados = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ErroApi(res.status, dados?.error ?? `Erro ${res.status}`);
  }
  const nome = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? nomePadrao;
  const url = URL.createObjectURL(await res.blob());
  const link = Object.assign(document.createElement("a"), { href: url, download: nome });
  link.click();
  URL.revokeObjectURL(url);
}

// URLs de arquivos servidos pelo backend (ex.: /uploads/fotos/<uuid>.jpg).
export const urlArquivo = (caminho: string) => `${API_URL}${caminho}`;
