# Setup Completo do Prisma - Projeto Corbicula

> **Estado atual:** o backend já está em `app/backend/` com Prisma inicializado,
> usando `prisma.config.ts` (formato novo). Os comandos abaixo assumem execução
> dentro de `app/backend/` (ou via `docker compose exec backend`).
>
> **Nota de escopo — espécies:** a tabela `especies` é um **catálogo fixo**,
> populado apenas por seed com as ~19 espécies do RS. O usuário só seleciona de
> uma lista; não há CRUD de escrita de espécie no MVP. Expor apenas leitura
> (`GET /especies`). Ver `docs/especies.md`.

## 🎯 O que é Prisma?

Prisma é um ORM (Object-Relational Mapping) moderno que:
- Define o schema do banco em um arquivo `.prisma`
- Gera tipos TypeScript automaticamente
- Facilita queries ao banco de dados
- Gerencia migrations (mudanças no banco)

---

## 📋 Passo a Passo

### **1. Instalar Prisma no Backend Node.js**

```bash
# O backend fica em app/backend
cd app/backend

# Prisma já está instalado neste projeto. Caso precise reinstalar:
npm install prisma @prisma/client
npm install -D tsx typescript @types/node
```

> Este projeto usa `prisma.config.ts` (formato novo do Prisma) para
> configuração, em vez de depender só de `schema.prisma` + `.env`.

---

### **2. Inicializar Prisma**

```bash
# Ainda dentro de app/backend/
npx prisma init

# Isso cria:
# - prisma/schema.prisma (schema do banco)
# - .env (com DATABASE_URL)
```

---

### **3. Configurar DATABASE_URL**

**Edite `app/backend/.env`:**

```env
# Para usar com Docker (acesso externo ao container)
DATABASE_URL="postgresql://corbicula:corbicula123@localhost:5432/corbicula_db"

# Dentro do container Docker (host = nome do serviço)
DATABASE_URL="postgresql://corbicula:corbicula123@postgres:5432/corbicula_db"
```

**Prisma v7 — `prisma.config.ts`:** a URL é lida aqui, não no `schema.prisma`.
O arquivo já existe em `app/backend/prisma.config.ts`:

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"]! },
});
```

---

### **4. Criar Schema do Prisma**

> **Prisma v7:** a URL de conexão **não vai no `schema.prisma`**. Ela é configurada
> em `prisma.config.ts` (via `datasource.url`). O bloco `datasource` no schema
> só declara o `provider`.

**Conteúdo atual de `app/backend/prisma/schema.prisma` (11 tabelas):**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  // URL configurada em prisma.config.ts — não colocar aqui (Prisma v7)
}

model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  password  String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  meliponario Meliponario?
  colonias    Colonia[]
  parametros  Parametro[]

  @@map("users")
}

model Meliponario {
  id        String   @id @default(uuid()) @db.Uuid
  nome      String
  endereco  String?
  cidade    String?
  estado    String?
  latitude  Float?
  longitude Float?
  bioma     String?
  areaTotal Float?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  userId String  @unique @db.Uuid
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("meliponarios")
}

model Colonia {
  id             String   @id @default(uuid()) @db.Uuid
  codigo         String   // gerado pelo sistema: [KEW]-[NNN], ex: TETRANGU-001
  dataEntrada    DateTime
  origem         String   // captura, compra, divisao, resgate
  tipoCaixa      String   // INPA, PNN, Schenck, tronco, outro
  dimensoesCaixa String?  @db.Text // JSON: {altura, largura, profundidade}
  localizacao    String?
  latitude       Float?
  longitude      Float?
  observacoes    String?  @db.Text
  status         String   @default("ativa") // ativa, inativa, morta
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  userId String @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  especieId String?  @db.Uuid
  especie   Especie? @relation(fields: [especieId], references: [id], onDelete: SetNull)

  avaliacoes Avaliacao[]
  fotos      Foto[]
  producoes  Producao[]

  coloniaMaeId   String?   @db.Uuid
  coloniaMae     Colonia?  @relation("Genealogia", fields: [coloniaMaeId], references: [id], onDelete: SetNull)
  coloniasFilhas Colonia[] @relation("Genealogia")

  @@unique([userId, codigo])
  @@index([userId])
  @@index([status])
  @@index([especieId])
  @@map("colonias")
}

model Parametro {
  id            String   @id @default(uuid()) @db.Uuid
  nome          String
  ordem         Int      @default(0)
  criterioBom   String   @db.Text
  criterioMedio String   @db.Text
  criterioRuim  String   @db.Text
  ativo         Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  userId String @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  avaliacoesParametros AvaliacaoParametro[]
  criteriosEspecie     ParametroEspecie[]

  @@unique([userId, nome])
  @@index([userId, ativo])
  @@map("parametros")
}

// Critérios específicos por espécie para um parâmetro.
// Sobrescreve os critérios padrão do Parametro quando a colônia tem espécie
// identificada. O Parametro mantém critérios genéricos como fallback.
model ParametroEspecie {
  id            String   @id @default(uuid()) @db.Uuid
  criterioBom   String   @db.Text
  criterioMedio String   @db.Text
  criterioRuim  String   @db.Text
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  parametroId String    @db.Uuid
  parametro   Parametro @relation(fields: [parametroId], references: [id], onDelete: Cascade)

  especieId String  @db.Uuid
  especie   Especie @relation(fields: [especieId], references: [id], onDelete: Cascade)

  @@unique([parametroId, especieId])
  @@index([parametroId])
  @@index([especieId])
  @@map("parametros_especies")
}

model Avaliacao {
  id                String   @id @default(uuid()) @db.Uuid
  dataAvaliacao     DateTime
  duracaoMinutos    Int?
  temperatura       Float?
  umidade           Float?
  condicaoClimatica String?  // ensolarado, nublado, chuvoso
  observacoesGerais String?  @db.Text
  acoesTomadas      String?  @db.Text // JSON array
  scoreGeral        Int      // 0-100
  statusGeral       String   // excelente, boa, atencao, critica
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  coloniaId String  @db.Uuid
  colonia   Colonia @relation(fields: [coloniaId], references: [id], onDelete: Cascade)

  parametros AvaliacaoParametro[]
  fotos      Foto[]

  @@index([coloniaId])
  @@index([dataAvaliacao])
  @@map("avaliacoes")
}

model AvaliacaoParametro {
  id            String   @id @default(uuid()) @db.Uuid
  classificacao String   // bom, medio, ruim
  valorNumerico Int?
  observacoes   String?  @db.Text
  createdAt     DateTime @default(now())

  avaliacaoId String    @db.Uuid
  avaliacao   Avaliacao @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)

  parametroId String    @db.Uuid
  parametro   Parametro @relation(fields: [parametroId], references: [id], onDelete: Cascade)

  fotos Foto[]

  @@unique([avaliacaoId, parametroId])
  @@index([avaliacaoId])
  @@index([parametroId])
  @@map("avaliacoes_parametros")
}

model Foto {
  id        String   @id @default(uuid()) @db.Uuid
  url       String
  legenda   String?
  tamanhoKb Int?
  createdAt DateTime @default(now())

  coloniaId String?  @db.Uuid
  colonia   Colonia? @relation(fields: [coloniaId], references: [id], onDelete: Cascade)

  avaliacaoId String?    @db.Uuid
  avaliacao   Avaliacao? @relation(fields: [avaliacaoId], references: [id], onDelete: Cascade)

  avaliacaoParametroId String?             @db.Uuid
  avaliacaoParametro   AvaliacaoParametro? @relation(fields: [avaliacaoParametroId], references: [id], onDelete: Cascade)

  @@index([coloniaId])
  @@index([avaliacaoId])
  @@map("fotos")
}

model Producao {
  id              String   @id @default(uuid()) @db.Uuid
  dataColheita    DateTime
  volumeMl        Float
  tipoProduto     String   // mel, polen, propolis, cera
  caracteristicas String?  @db.Text // JSON: {cor, aroma, sabor}
  observacoes     String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  coloniaId String  @db.Uuid
  colonia   Colonia @relation(fields: [coloniaId], references: [id], onDelete: Cascade)

  @@index([coloniaId])
  @@index([dataColheita])
  @@map("producoes")
}

model Especie {
  id                String   @id @default(uuid()) @db.Uuid
  codigo            String   @unique // padrão Kew: TETRANGU
  nomePopular       String
  nomeCientifico    String   @unique
  genero            String
  especie           String
  subespecie        String?
  nomesAlternativos String?  @db.Text // JSON array
  caracteristicas   String?  @db.Text // JSON: tamanho, cor, comportamento, entrada, populacao
  ocorrenciaBiomas  String?  @db.Text // JSON array
  statusConservacao String?            // LC, VU, EN
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  colonias           Colonia[]
  criteriosParametro ParametroEspecie[]

  @@index([codigo])
  @@index([genero])
  @@map("especies")
}

model SyncQueue {
  id           String   @id @default(uuid()) @db.Uuid
  tipo         String   // avaliacao, colonia, producao
  operacao     String   // create, update, delete
  dados        String   @db.Text // JSON
  tentativas   Int      @default(0)
  ultimoErro   String?  @db.Text
  sincronizado Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([sincronizado])
  @@map("sync_queue")
}
```

> A tabela `especies` é populada **apenas pelo seed**. Não há telas nem endpoints
> de escrita para o usuário. Os códigos seguem o padrão Kew e são gerados por
> função (ver `docs/especies.md`), nunca digitados à mão.

---

### **5. Gerar Migração Inicial**

```bash
# Ainda em app/backend/

# Cria a migração e aplica no banco
npx prisma migrate dev --name init

# Isso vai:
# 1. Criar o arquivo de migração em prisma/migrations/
# 2. Aplicar no banco de dados PostgreSQL
# 3. Gerar o Prisma Client (código TypeScript)
```

**Saída esperada:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database

✔ Generated Prisma Client (7.8.0 | library) to ./node_modules/@prisma/client

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20241220000000_init/
    └─ migration.sql

Your database is now in sync with your schema.
```

---

### **6. Verificar Tabelas Criadas**

**Opção 1: Prisma Studio (Interface Visual)**
```bash
npx prisma studio

# Abre no navegador: http://localhost:5555
# Você pode ver e editar dados visualmente
```

**Opção 2: CLI do PostgreSQL**
```bash
# Se estiver usando Docker
docker-compose exec postgres psql -U corbicula -d corbicula_db

# Listar tabelas
\dt

# Ver estrutura de uma tabela
\d users
\d colonias

# Sair
\q
```

---

### **7. Arquivo de Cliente Prisma**

Já existe em `app/backend/src/config/database.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Importar em qualquer módulo com: `import { prisma } from "../../config/database";`

---

### **8. Usar Prisma no Código**

O projeto usa o padrão de **object literal** (não classes) com separação em `service` e `repository`:

```typescript
// src/modules/colonias/colonias.service.ts
import { prisma } from "../../config/database";

export const coloniasService = {
  async listar(userId: string) {
    return prisma.colonia.findMany({ where: { userId } });
  },

  async buscarPorId(id: string, userId: string) {
    return prisma.colonia.findFirst({
      where: { id, userId },
      include: { especie: true, coloniaMae: true, coloniasFilhas: true },
    });
  },
};
```

> **Nota:** `id` e `userId` são **strings UUID** em todo o projeto (`@db.Uuid`).
> Nunca use `Int` para IDs neste schema.

---

### **9. Criar Seed (Dados de Exemplo)**

**Crie `app/backend/prisma/seed.ts`:**

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // ── Espécies (catálogo fixo — ver docs/especies.md para a lista completa) ──
  // Exemplo com 2 espécies; o seed real deve incluir todas as ~19 do RS
  await prisma.especie.upsert({
    where: { codigo: "TETRANGU" },
    update: {},
    create: {
      codigo: "TETRANGU",
      nomePopular: "Jataí",
      nomeCientifico: "Tetragonisca angustula",
      genero: "Tetragonisca",
      especie: "angustula",
      statusConservacao: "LC",
    },
  });

  // ── Usuário de teste ────────────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: "teste@corbicula.com" },
    update: {},
    create: {
      email: "teste@corbicula.com",
      password: await bcrypt.hash("senha123", 10),
      name: "Usuário Teste",
      meliponario: {
        create: {
          nome: "Meliponário Teste",
          cidade: "Porto Alegre",
          estado: "RS",
          bioma: "Mata Atlântica",
        },
      },
    },
  });

  // ── Colônia de exemplo (código auto-gerado na API; aqui inserido direto no seed) ──
  const especie = await prisma.especie.findUnique({ where: { codigo: "TETRANGU" } });
  await prisma.colonia.upsert({
    where: { userId_codigo: { userId: user.id, codigo: "TETRANGU-001" } },
    update: {},
    create: {
      codigo: "TETRANGU-001",
      dataEntrada: new Date("2024-01-15"),
      origem: "compra",
      tipoCaixa: "INPA",
      status: "ativa",
      userId: user.id,
      especieId: especie?.id,
    },
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

> **Importante:** no fluxo normal da API, o `codigo` da colônia é **gerado
> automaticamente** pelo service (`gerarCodigoColonia`). No seed, ele é inserido
> diretamente porque não passa pelo service. Use o padrão `[KEW]-[NNN]`.

**Configure no `package.json`:**

```json
// app/backend/package.json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Execute o seed:**
```bash
npx prisma db seed
```

---

### **10. Scripts Úteis do Prisma**

**Adicione ao `app/backend/package.json`:**

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup src",
    "start": "node dist/server.js",
    
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "prisma db seed",
    "prisma:reset": "prisma migrate reset",
    "prisma:format": "prisma format"
  }
}
```

---

## 📚 Comandos Prisma Essenciais

```bash
# Gerar Prisma Client (após mudar schema)
npx prisma generate

# Criar e aplicar migration
npx prisma migrate dev --name nome_da_mudanca

# Aplicar migrations pendentes (produção)
npx prisma migrate deploy

# Abrir Prisma Studio (ver/editar dados)
npx prisma studio

# Popular banco com seed
npx prisma db seed

# Resetar banco (CUIDADO: apaga tudo!)
npx prisma migrate reset

# Formatar schema.prisma
npx prisma format

# Ver status das migrations
npx prisma migrate status

# Criar migration vazia (para SQL customizado)
npx prisma migrate dev --create-only
```

---

## 🔄 Fluxo de Trabalho com Prisma

### **1. Adicionar/Mudar Tabela**
```bash
# 1. Edite prisma/schema.prisma
# 2. Crie migration
npx prisma migrate dev --name adiciona_campo_telefone

# 3. Prisma Client é gerado automaticamente
```

### **2. Trabalhar com Dados**
```typescript
// Em qualquer arquivo
import { prisma } from './config/database';

// Create
const colonia = await prisma.colonia.create({ data: {...} });

// Read (id é string/UUID)
const colonias = await prisma.colonia.findMany();
const colonia = await prisma.colonia.findUnique({ where: { id } }); // id: string

// Update
await prisma.colonia.update({ 
  where: { id },   // id: string (UUID)
  data: { status: 'inativa' } 
});

// Delete
await prisma.colonia.delete({ where: { id } }); // id: string
```

---