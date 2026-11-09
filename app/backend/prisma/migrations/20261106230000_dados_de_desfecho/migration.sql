-- AlterTable
ALTER TABLE "colonias" ADD COLUMN     "motivoStatus" TEXT,
ADD COLUMN     "motivoStatusDetalhe" TEXT,
ADD COLUMN     "statusDesde" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "avaliacoes" ADD COLUMN     "climaFonte" TEXT,
ADD COLUMN     "motivoInspecao" TEXT,
ADD COLUMN     "motivoInspecaoDetalhe" TEXT,
ADD COLUMN     "motivosAcoes" JSONB,
ADD COLUMN     "protocoloId" UUID;

-- CreateTable
CREATE TABLE "colonias_status_historico" (
    "id" UUID NOT NULL,
    "statusAnterior" TEXT,
    "statusNovo" TEXT NOT NULL,
    "dataPercebida" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "motivoDetalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coloniaId" UUID NOT NULL,

    CONSTRAINT "colonias_status_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocolos" (
    "id" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "conteudo" JSONB NOT NULL,
    "templateCodigo" TEXT,
    "templateVersao" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID NOT NULL,

    CONSTRAINT "protocolos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "colonias_status_historico_coloniaId_idx" ON "colonias_status_historico"("coloniaId");

-- CreateIndex
CREATE UNIQUE INDEX "protocolos_userId_hash_key" ON "protocolos"("userId", "hash");

-- CreateIndex
CREATE INDEX "avaliacoes_protocoloId_idx" ON "avaliacoes"("protocoloId");

-- AddForeignKey
ALTER TABLE "colonias_status_historico" ADD CONSTRAINT "colonias_status_historico_coloniaId_fkey" FOREIGN KEY ("coloniaId") REFERENCES "colonias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "protocolos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocolos" ADD CONSTRAINT "protocolos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
