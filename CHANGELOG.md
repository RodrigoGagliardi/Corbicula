# Changelog

Todas as mudanças relevantes do projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).
Versões seguem [Semantic Versioning](https://semver.org/lang/pt-BR/).

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
