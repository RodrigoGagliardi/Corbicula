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

async function requisicao<T>(metodo: string, caminho: string, corpo?: Corpo): Promise<T> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (corpo !== undefined && !(corpo instanceof FormData)) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${caminho}`, {
      method: metodo,
      headers,
      ...(corpo !== undefined && { body: corpo instanceof FormData ? corpo : JSON.stringify(corpo) }),
    });
  } catch {
    throw new ErroApi(0, "Sem conexão com o servidor.");
  }

  // Token expirado/inválido: encerra a sessão; o roteador leva ao login.
  if (res.status === 401 && token) useAuth.getState().sair();

  if (res.status === 204) return undefined as T;
  const dados = (await res.json().catch(() => null)) as
    | (T & { error?: string; detalhes?: { campo: string; mensagem: string }[] })
    | null;

  if (!res.ok) {
    throw new ErroApi(res.status, dados?.error ?? `Erro ${res.status}`, dados?.detalhes ?? []);
  }
  return dados as T;
}

export const api = {
  get: <T>(caminho: string) => requisicao<T>("GET", caminho),
  post: <T>(caminho: string, corpo?: Corpo) => requisicao<T>("POST", caminho, corpo),
  patch: <T>(caminho: string, corpo?: Corpo) => requisicao<T>("PATCH", caminho, corpo),
  put: <T>(caminho: string, corpo?: Corpo) => requisicao<T>("PUT", caminho, corpo),
  delete: (caminho: string) => requisicao<void>("DELETE", caminho),
};

// URLs de arquivos servidos pelo backend (ex.: /uploads/fotos/<uuid>.jpg).
export const urlArquivo = (caminho: string) => `${API_URL}${caminho}`;
