import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function bootstrap() {
  await prisma.$connect();
  console.log("✅ Banco conectado com sucesso");

  const usuarios = await prisma.user.count();
  console.log("Usuários cadastrados:", usuarios);

}

bootstrap()
  .catch((e) => {
    console.error("❌ Erro ao iniciar aplicação:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });