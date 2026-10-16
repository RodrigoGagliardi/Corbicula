-- AlterTable
ALTER TABLE "colonias" ADD COLUMN     "coloniaDoadoraCampeirasId" UUID;

-- AddForeignKey
ALTER TABLE "colonias" ADD CONSTRAINT "colonias_coloniaDoadoraCampeirasId_fkey" FOREIGN KEY ("coloniaDoadoraCampeirasId") REFERENCES "colonias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
