-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meliponarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "bioma" TEXT,
    "areaTotal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "meliponarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colonias" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "dataEntrada" TIMESTAMP(3) NOT NULL,
    "origem" TEXT NOT NULL,
    "tipoCaixa" TEXT NOT NULL,
    "dimensoesCaixa" TEXT,
    "localizacao" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "observacoes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,
    "especieId" UUID,
    "coloniaMaeId" UUID,

    CONSTRAINT "colonias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criterioBom" TEXT NOT NULL,
    "criterioMedio" TEXT NOT NULL,
    "criterioRuim" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_especies" (
    "id" UUID NOT NULL,
    "criterioBom" TEXT NOT NULL,
    "criterioMedio" TEXT NOT NULL,
    "criterioRuim" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parametroId" UUID NOT NULL,
    "especieId" UUID NOT NULL,

    CONSTRAINT "parametros_especies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" UUID NOT NULL,
    "dataAvaliacao" TIMESTAMP(3) NOT NULL,
    "duracaoMinutos" INTEGER,
    "temperatura" DOUBLE PRECISION,
    "umidade" DOUBLE PRECISION,
    "condicaoClimatica" TEXT,
    "observacoesGerais" TEXT,
    "acoesTomadas" TEXT,
    "scoreGeral" INTEGER NOT NULL,
    "statusGeral" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coloniaId" UUID NOT NULL,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes_parametros" (
    "id" UUID NOT NULL,
    "classificacao" TEXT NOT NULL,
    "valorNumerico" INTEGER,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avaliacaoId" UUID NOT NULL,
    "parametroId" UUID NOT NULL,

    CONSTRAINT "avaliacoes_parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "legenda" TEXT,
    "tamanhoKb" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coloniaId" UUID,
    "avaliacaoId" UUID,
    "avaliacaoParametroId" UUID,
    "producaoId" UUID,

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producoes" (
    "id" UUID NOT NULL,
    "dataColheita" TIMESTAMP(3) NOT NULL,
    "tipoProduto" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "unidade" TEXT NOT NULL,
    "caracteristicas" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coloniaId" UUID NOT NULL,

    CONSTRAINT "producoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especies" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nomePopular" TEXT NOT NULL,
    "nomeCientifico" TEXT NOT NULL,
    "genero" TEXT NOT NULL,
    "especie" TEXT NOT NULL,
    "subespecie" TEXT,
    "nomesAlternativos" TEXT,
    "caracteristicas" TEXT,
    "ocorrenciaBiomas" TEXT,
    "statusConservacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "especies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "operacao" TEXT NOT NULL,
    "entidadeId" UUID,
    "dados" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "ultimoErro" TEXT,
    "sincronizado" BOOLEAN NOT NULL DEFAULT false,
    "criadoNoCliente" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "meliponarios_userId_key" ON "meliponarios"("userId");

-- CreateIndex
CREATE INDEX "colonias_userId_idx" ON "colonias"("userId");

-- CreateIndex
CREATE INDEX "colonias_status_idx" ON "colonias"("status");

-- CreateIndex
CREATE INDEX "colonias_especieId_idx" ON "colonias"("especieId");

-- CreateIndex
CREATE UNIQUE INDEX "colonias_userId_codigo_key" ON "colonias"("userId", "codigo");

-- CreateIndex
CREATE INDEX "parametros_userId_ativo_idx" ON "parametros"("userId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_userId_nome_key" ON "parametros"("userId", "nome");

-- CreateIndex
CREATE INDEX "parametros_especies_parametroId_idx" ON "parametros_especies"("parametroId");

-- CreateIndex
CREATE INDEX "parametros_especies_especieId_idx" ON "parametros_especies"("especieId");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_especies_parametroId_especieId_key" ON "parametros_especies"("parametroId", "especieId");

-- CreateIndex
CREATE INDEX "avaliacoes_coloniaId_idx" ON "avaliacoes"("coloniaId");

-- CreateIndex
CREATE INDEX "avaliacoes_dataAvaliacao_idx" ON "avaliacoes"("dataAvaliacao");

-- CreateIndex
CREATE INDEX "avaliacoes_parametros_avaliacaoId_idx" ON "avaliacoes_parametros"("avaliacaoId");

-- CreateIndex
CREATE INDEX "avaliacoes_parametros_parametroId_idx" ON "avaliacoes_parametros"("parametroId");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_parametros_avaliacaoId_parametroId_key" ON "avaliacoes_parametros"("avaliacaoId", "parametroId");

-- CreateIndex
CREATE INDEX "fotos_coloniaId_idx" ON "fotos"("coloniaId");

-- CreateIndex
CREATE INDEX "fotos_avaliacaoId_idx" ON "fotos"("avaliacaoId");

-- CreateIndex
CREATE INDEX "fotos_avaliacaoParametroId_idx" ON "fotos"("avaliacaoParametroId");

-- CreateIndex
CREATE INDEX "fotos_producaoId_idx" ON "fotos"("producaoId");

-- CreateIndex
CREATE INDEX "producoes_coloniaId_idx" ON "producoes"("coloniaId");

-- CreateIndex
CREATE INDEX "producoes_tipoProduto_idx" ON "producoes"("tipoProduto");

-- CreateIndex
CREATE INDEX "producoes_dataColheita_idx" ON "producoes"("dataColheita");

-- CreateIndex
CREATE UNIQUE INDEX "especies_codigo_key" ON "especies"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "especies_nomeCientifico_key" ON "especies"("nomeCientifico");

-- CreateIndex
CREATE INDEX "especies_codigo_idx" ON "especies"("codigo");

-- CreateIndex
CREATE INDEX "especies_genero_idx" ON "especies"("genero");

-- CreateIndex
CREATE INDEX "sync_queue_userId_sincronizado_idx" ON "sync_queue"("userId", "sincronizado");

-- AddForeignKey
ALTER TABLE "meliponarios" ADD CONSTRAINT "meliponarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colonias" ADD CONSTRAINT "colonias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colonias" ADD CONSTRAINT "colonias_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colonias" ADD CONSTRAINT "colonias_coloniaMaeId_fkey" FOREIGN KEY ("coloniaMaeId") REFERENCES "colonias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_especies" ADD CONSTRAINT "parametros_especies_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "parametros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros_especies" ADD CONSTRAINT "parametros_especies_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_coloniaId_fkey" FOREIGN KEY ("coloniaId") REFERENCES "colonias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_parametros" ADD CONSTRAINT "avaliacoes_parametros_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "avaliacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_parametros" ADD CONSTRAINT "avaliacoes_parametros_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "parametros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_coloniaId_fkey" FOREIGN KEY ("coloniaId") REFERENCES "colonias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "avaliacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_avaliacaoParametroId_fkey" FOREIGN KEY ("avaliacaoParametroId") REFERENCES "avaliacoes_parametros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_producaoId_fkey" FOREIGN KEY ("producaoId") REFERENCES "producoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producoes" ADD CONSTRAINT "producoes_coloniaId_fkey" FOREIGN KEY ("coloniaId") REFERENCES "colonias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
