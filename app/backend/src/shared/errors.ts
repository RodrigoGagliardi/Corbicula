// Erros tipados de domínio. O `code` é traduzido para status HTTP pelo
// error handler em server.ts (NOT_FOUND → 404, CONFLICT → 409, etc.).

function erroComCodigo(code: string, msg: string): Error {
  const err = new Error(msg);
  (err as NodeJS.ErrnoException).code = code;
  return err;
}

export const erroNaoEncontrado = (msg: string) => erroComCodigo("NOT_FOUND", msg);
export const erroConflito = (msg: string) => erroComCodigo("CONFLICT", msg);
export const erroRequisicao = (msg: string) => erroComCodigo("BAD_REQUEST", msg);
