import os from "node:os";
import path from "node:path";

// Os testes nunca tocam o banco de desenvolvimento: usam o mesmo servidor
// Postgres com um banco separado (<nome>_test), recriado a cada execução.
export function urlDoBancoDeTeste(): string {
  const base = process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (!base) throw new Error("Defina DATABASE_URL (ou TEST_DATABASE_URL) para rodar os testes.");
  const url = new URL(base);
  if (!url.pathname.endsWith("_test")) url.pathname = `${url.pathname}_test`;
  return url.toString();
}

export const UPLOADS_DIR_TESTE = path.join(os.tmpdir(), "corbicula-test-uploads");
