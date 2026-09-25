import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { UPLOADS_DIR_TESTE, urlDoBancoDeTeste } from "./test-env.mts";

// Roda uma vez antes de toda a suíte: recria o banco de teste do zero com as
// migrations reais e popula o catálogo de espécies via seed. Cada arquivo de
// teste cria seus próprios usuários, então os arquivos não interferem entre si.
export default async function setup() {
  const env = { ...process.env, DATABASE_URL: urlDoBancoDeTeste() };
  const rodar = (cmd: string) => execSync(cmd, { env, stdio: "pipe" });

  rodar("npx prisma migrate reset --force");
  rodar("npx prisma db seed");
  await rm(UPLOADS_DIR_TESTE, { recursive: true, force: true });
}
