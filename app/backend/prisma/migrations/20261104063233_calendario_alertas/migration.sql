-- AlterTable
ALTER TABLE "colonias" ADD COLUMN     "frequenciaInspecaoDias" INTEGER;

-- CreateTable
CREATE TABLE "alertas_resolvidos" (
    "id" UUID NOT NULL,
    "chave" TEXT NOT NULL,
    "resolvidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,

    CONSTRAINT "alertas_resolvidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alertas_resolvidos_userId_chave_key" ON "alertas_resolvidos"("userId", "chave");

-- AddForeignKey
ALTER TABLE "alertas_resolvidos" ADD CONSTRAINT "alertas_resolvidos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
