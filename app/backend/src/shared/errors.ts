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

// Id que não é UUID (ex.: GET /colonias/abc) chega ao Postgres e volta como
// P2007 com o código 22P02 ("invalid input syntax for type uuid"). Para quem
// chama a API, um id malformado é um registro que não existe → 404. Só esse
// caso é reconhecido: outros erros de validação do banco seguem como 500, para
// não esconder bugs.
export function ehUuidInvalido(erro: unknown): boolean {
  const e = erro as { code?: unknown; meta?: { driverAdapterError?: { cause?: { originalCode?: unknown; originalMessage?: unknown } } } };
  const causa = e?.meta?.driverAdapterError?.cause;
  return (
    e?.code === "P2007" &&
    causa?.originalCode === "22P02" &&
    typeof causa.originalMessage === "string" &&
    causa.originalMessage.includes("type uuid")
  );
}
