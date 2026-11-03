# Changelog

Todas as mudanças relevantes do projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).
Versões seguem [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Funcionalidades

- **Frontend (PWA)** — app em React 19 + TypeScript + Vite 8 em `app/frontend/` (porta 5173), com Tailwind v4, TanStack Query, Zustand e React Router v7; manifest e Service Worker com o app shell em cache (`vite-plugin-pwa`)
  - Páginas públicas na raiz: landing, login, cadastro, recuperar senha (por enquanto só explica que o envio por e-mail ainda não existe) e "Sobre", com a atribuição da Open-Meteo
  - Área logada sob `/app/*` (endereços antigos sem `/app` redirecionam): dashboard, colônias (lista, detalhe com totais de produção, criar/editar), parâmetros (lista, criar/editar)
  - Avaliações: nova avaliação em fluxo rápido Bom/Médio/Ruim com foto-resumo opcional comprimida no cliente; histórico geral com filtros na URL, linha do tempo por mês, evolução do score de uma colônia e exportação CSV/JSON; detalhe da inspeção; edição até 7 dias após o registro
  - Produção: histórico com filtros e totais, registrar/editar colheita com foto opcional, relatório com ranking por colônia, tabela por espécie e exportação CSV/JSON
  - Telas ainda não implementadas têm rota e mostram uma página "em construção" com o que está previsto (`pages/telasPlanejadas.ts`)
  - Layout responsivo: sidebar recolhível no desktop e barra inferior no mobile, a partir de uma fonte única de navegação
  - Tema com tokens semânticos HSL (verde floresta + amarelo do logo), modos claro, escuro e sistema; fontes Plus Jakarta Sans + Inter; logos oficiais e ícones PWA gerados por `npm run icones`
- **Histórico geral de avaliações** — `GET /avaliacoes` lista as inspeções de todas as colônias, com filtros por colônia, status, período e parâmetro + classificação
- **Colônia doadora de campeiras** — divisões podem registrar, além da mãe, a colônia que doou campeiras (`coloniaDoadoraCampeirasId`, migration `colonia_doadora_campeiras`); incluída na exportação de colônias
- `GET /colonias` e `GET /colonias/:id` devolvem `ultimaAvaliacao` (id, data, score e status da inspeção mais recente)
- **Fotos** — upload multipart em `/fotos` (JPEG/PNG/WebP, máx. 5 MB); vínculo com colônia, avaliação, parâmetro avaliado ou colheita; regra de integridade (nenhuma foto órfã) com derivação e conferência das FKs; arquivos servidos em `/uploads/fotos/` e removidos do disco quando o registro dono é excluído
- **Produção** — CRUD de colheitas em `/producoes` com filtros (colônia, tipo, período); `/producoes/resumo` com totais, médias e ranking por (tipo, unidade) e por espécie — ml e g nunca são somados
- **Exportação** — CSV (RFC 4180) e JSON com metadados e metodologia para colônias, avaliações (formato longo, uma linha por avaliação × parâmetro) e produções; backup completo em JSON (`/exportacao/backup`); dicionário de dados em `docs/exportacao.md`
- **Sincronização offline** — `POST /sync` aplica lotes de operações idempotentes (create/update/delete de colônias, avaliações e produções) com detecção de conflito por `baseUpdatedAt`; `GET /sync/alteracoes` (pull incremental + `idsAtuais`); `GET /sync/status`
- Creates de colônia, avaliação e produção aceitam `id` (UUID) gerado no cliente
- **Testes automatizados** — suíte Vitest com 132 testes: unitários (score, CSV RFC 4180, clima com fetch mockado) e de integração via `app.inject` (auth, colônias, avaliações, fotos, produção, exportação, sync) contra um banco Postgres de teste separado; `npm test`, `npm run typecheck`, `make test`
- **CI** — GitHub Actions roda typecheck e testes do backend em push/PR
- Docker: serviço `frontend` ativado no `docker-compose.yml` (Vite com polling para o hot reload no Windows)

### Alterado

- **Regras de genealogia** validadas em `colonias.service.ts`: a espécie não muda depois de definida (colônia `COL-NNN` pode ser identificada uma vez e ganha o código da espécie); mãe e doadora só em colônias de origem divisão; mãe, filha e doadora da mesma espécie; a filha não entra antes da mãe e da doadora; a árvore não tem ciclos
- `Producao`: `volumeMl` substituído por `quantidade` + `unidade` (ml | g)
- `Foto`: nova FK `producaoId`; FK para `AvaliacaoParametro` passa a `SetNull`
- `SyncQueue`: passa a ser o registro das operações recebidas (com `userId`, `entidadeId`, `resultado`, `criadoNoCliente`)
- Editar os parâmetros de uma avaliação faz upsert em vez de apagar e recriar, preservando as fotos vinculadas
- Erros 4xx do Fastify/plugins (JSON malformado, arquivo grande demais) retornam o status correto em vez de 500
- Seed: colônia de exemplo passa a usar o código `TETRANGU-001`; meliponário de teste com coordenadas
- Docker: backend roda `prisma migrate deploy` ao subir (antes `db push`); porta do postgres no host configurável via `POSTGRES_PORT`; volume `backend_uploads`
- `src/server.ts` dividido: montagem da aplicação em `src/app.ts` (`buildApp()`), reutilizada pelos testes
- Enviar mais de uma foto por requisição retorna 413 (limite do multipart); removida checagem redundante que nunca era alcançada

### Corrigido

- `POST /auth/register` ignorava o campo opcional `meliponario` — agora o meliponário é criado junto com o usuário
- `PrismaClient` não inicializava no Prisma v7 sem driver adapter — adicionado `@prisma/adapter-pg` no client e no seed
- Comando de seed movido para `prisma.config.ts` (o Prisma v7 ignora a chave `prisma.seed` do `package.json`)

### Removido

- Arquivos mortos: `src/shared/logger.ts`, `src/experiments/`, `src/routes/`, `src/prisma/client.ts`

## [0.1.0] — 2026-09-14

Primeira versão com backend MVP completo (Node.js + Fastify + Prisma v7).

### Funcionalidades

- **Autenticação** — registro, login e refresh de token via JWT + bcrypt
- **Usuários e meliponário** — CRUD de perfil; meliponário 1:1 com usuário
- **Colônias** — CRUD completo; código auto-gerado no padrão Kew (`[CODIGO]-[NNN]`); auto-relação genealógica mãe/filha; proteção de exclusão com histórico de avaliações
- **Espécies** — catálogo fixo de ~19 espécies do RS (somente leitura); endpoints `GET /especies` e `GET /especies/:codigo`
- **Parâmetros** — parâmetros de avaliação personalizáveis por usuário; critérios por espécie via `ParametroEspecie` (upsert atômico); soft delete protegido
- **Avaliações** — registro com score automático (0–100) e status (excelente/boa/atencao/critica); janela de edição de 7 dias; parâmetros substituídos em transação
- **Clima automático** — integração Open-Meteo sem chave de API; Forecast API (≤ 5 dias) e Archive API (> 5 dias); cache em memória por (lat, lon, hora); enriquecimento assíncrono pós-avaliação sem bloquear resposta

### Infraestrutura

- Schema Prisma com 11 tabelas (UUID em todos os IDs, compatível com sync offline)
- Arquitetura modular (`src/modules/<domínio>/routes+service+repository+types`)
- TypeScript 5.9 com `strictNullChecks`, `exactOptionalPropertyTypes` e `noUncheckedIndexedAccess`
- Docker Compose para desenvolvimento (postgres, backend, frontend, analytics)
- Documentação técnica em `docs/` (prisma-setup, estrutura-pastas, fluxo-fotoclima, escopo, especies, efetividade, telas)
