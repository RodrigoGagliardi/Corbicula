# Corbicula

[![Backend — testes](https://github.com/RodrigoGagliardi/Corbicula/actions/workflows/backend-tests.yml/badge.svg?branch=development)](https://github.com/RodrigoGagliardi/Corbicula/actions/workflows/backend-tests.yml)

O Projeto Corbicula tem como principal objetivo a coleta e análise de dados de colônias de abelhas do Rio Grande do Sul, podendo ser utilizado tanto para fins científicos da academia quanto para gerenciamento de meliponários de pequeno e médio porte.

Voltado a abelhas sem ferrão (Meliponini), o sistema permite avaliações personalizáveis de saúde das colônias, controle genético de linhagens (relação mãe/filha em divisões), registro de produção e exportação de dados limpos para análise em R, Python ou planilhas. Enriquece cada inspeção com dados climáticos automáticos a partir das coordenadas da colônia e foi projetado para funcionar offline (PWA com sincronização).

## Estado do projeto

| Parte | Estado |
|-------|--------|
| **Backend** (Node.js + Fastify + Prisma) | ✅ MVP completo, com testes automatizados e CI |
| **Frontend** (React + Vite + PWA) | 🚧 Primeiras telas do MVP prontas; modo offline ainda não implementado |
| **Analytics** (Python + FastAPI) | 📋 Planejado (Fase 2): análises, correlações, genealogia |

O que o backend já faz:

- **Colônias** — cadastro com código automático no padrão Kew (`TETRANGU-001`), genealogia mãe/filha e catálogo fixo das 19 espécies de meliponíneos do RS
- **Avaliações** — parâmetros de saúde personalizáveis (Bom/Médio/Ruim), score automático de 0 a 100 e edição permitida por 7 dias
- **Clima automático** — temperatura, umidade e condição do tempo buscados na [Open-Meteo](https://open-meteo.com/), sem digitação manual
- **Fotos** — sempre opcionais; por colônia, inspeção, parâmetro ou colheita
- **Produção** — registro de colheitas (mel, pólen, própolis, cera) com resumo e ranking por colônia e espécie
- **Exportação** — CSV e JSON com dicionário de dados e metodologia documentados, além de backup completo
- **Sincronização offline** — API de sync idempotente, com detecção de conflitos, pronta para o PWA

O que o frontend já tem:

- **Acesso** — landing, login e cadastro
- **Dashboard** — visão geral das colônias e do score
- **Colônias** — lista, detalhes, cadastro e edição
- **Avaliação rápida** — fluxo mobile-first de Bom/Médio/Ruim, com foto-resumo opcional
- **Parâmetros** — lista, criação e edição dos critérios de avaliação
- **Layout responsivo** — sidebar no desktop e barra de navegação inferior no mobile, com a mesma base de código; instalável como PWA

A fila de sincronização offline no cliente (IndexedDB + `/sync`) e as telas de produção, análises e exportação ainda estão por vir.

## Começando

Essas instruções permitirão que você obtenha uma cópia do projeto em operação na sua máquina local para fins de desenvolvimento e teste.

### Pré-requisitos

O projeto roda inteiramente em containers, então você só precisa do Docker instalado. Git é necessário para clonar o repositório.

```
Docker Desktop 24+ (ou Docker Engine + Docker Compose v2)
Git
```

Opcionalmente, para rodar comandos fora dos containers:

```
Node.js 20+
make (atalhos do makefile)
```

### Instalação

Clone o repositório e entre na pasta do projeto:

```
git clone https://github.com/RodrigoGagliardi/Corbicula.git
cd Corbicula
```

Crie o arquivo de variáveis de ambiente a partir do exemplo:

```
cp .env.example .env
```

O `.env` já vem com valores padrão para desenvolvimento local. Se a porta 5432 da sua máquina já estiver ocupada por outro PostgreSQL, troque a porta exposta no host:

```
POSTGRES_PORT=5433
```

Suba os serviços. Ao iniciar, o backend aplica as migrations do banco automaticamente:

```
docker compose up -d
```

Popule o banco com as espécies do RS e os dados de exemplo:

```
docker compose exec backend npx prisma db seed
```

Ao finalizar, os serviços estarão disponíveis em:

```
Frontend (app):        http://localhost:5173
Backend (API):         http://localhost:3000
Documentação da API:   http://localhost:3000/api-docs
PostgreSQL:            localhost:5432 (ou a porta definida em POSTGRES_PORT)
```

O seed cria um usuário de exemplo, com meliponário, 5 parâmetros de avaliação e uma colônia de Jataí:

```
E-mail: teste@corbicula.app
Senha:  senha123
```

Abra `http://localhost:5173` e entre com esse usuário para usar o app. Para explorar a API diretamente, use a documentação interativa (Swagger): faça login em `POST /auth/login`, clique em **Authorize** e cole o token. A partir daí dá para cadastrar colônias, registrar avaliações e exportar os dados. O clima de cada inspeção é preenchido automaticamente em segundo plano.

### Atalhos do makefile

```
make up        # sobe os containers
make down      # derruba os containers
make logs      # acompanha os logs
make seed      # roda o seed
make test      # roda os testes do backend
make studio    # abre o Prisma Studio
make reset     # apaga os volumes e recria tudo (CUIDADO: apaga o banco)
```

## Executando os testes

O backend tem uma suíte de testes em [Vitest](https://vitest.dev/): testes unitários (cálculo de score, geração de CSV, integração com o clima) e testes de integração que exercitam a API completa (autenticação, colônias, avaliações, fotos, produção, exportação e sincronização).

```
docker compose exec backend npm test
```

Os testes usam um banco separado (`corbicula_db_test`), recriado do zero a cada execução com as migrations reais, e nunca tocam os dados de desenvolvimento. A API da Open-Meteo não é chamada durante os testes.

Para checar os tipos do TypeScript, incluindo os arquivos de teste:

```
docker compose exec backend npm run typecheck
```

Os dois rodam automaticamente no GitHub Actions a cada push e pull request que altere o backend.

No frontend, o typecheck e o build de produção rodam assim:

```
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run build
```

## Dados e metodologia

O Corbicula nasceu com propósito acadêmico, e por isso a exportação de dados e a transparência da metodologia fazem parte do projeto:

- **Exportação** — `GET /exportacao/{colonias,avaliacoes,producoes}` em CSV (RFC 4180, UTF-8, datas ISO 8601 em UTC) ou JSON, e `GET /exportacao/backup` com todos os dados do usuário. As avaliações saem em formato longo (*tidy*), prontas para R e pandas. O dicionário de dados completo está em [`docs/exportacao.md`](docs/exportacao.md).
- **Score** — `(n_bom × 100 + n_medio × 50 + n_ruim × 0) / n_parametros`, com faixas Excelente (80–100), Boa (60–79), Atenção (40–59) e Crítica (0–39).
- **Espécies** — códigos derivados do nome científico no padrão Kew. Veja [`docs/especies.md`](docs/especies.md).
- **Clima** — Open-Meteo (Forecast e Archive/ERA5) na hora e na coordenada da inspeção. Veja [`docs/fluxo-fotoclima.md`](docs/fluxo-fotoclima.md).

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [`docs/escopo.md`](docs/escopo.md) | Escopo completo: personas, módulos e roadmap |
| [`docs/telas.md`](docs/telas.md) | As 35 telas planejadas, com rotas |
| [`docs/estrutura-pastas.md`](docs/estrutura-pastas.md) | Estrutura de pastas do projeto |
| [`docs/prisma-setup.md`](docs/prisma-setup.md) | Schema do banco, seed e comandos do Prisma |
| [`docs/especies.md`](docs/especies.md) | As 19 espécies do catálogo |
| [`docs/fluxo-fotoclima.md`](docs/fluxo-fotoclima.md) | Fluxos de foto opcional e clima automático |
| [`docs/exportacao.md`](docs/exportacao.md) | Exportação, dicionário de dados e metodologia |
| [`docs/efetividade.md`](docs/efetividade.md) | Análise de efetividade das funcionalidades |

## Construído com

* [Fastify](https://fastify.dev/) - Framework web do backend
* [Prisma](https://www.prisma.io/) - ORM e gerenciamento de migrations
* [PostgreSQL](https://www.postgresql.org/) - Banco de dados relacional
* [Zod](https://zod.dev/) - Validação de dados
* [Vitest](https://vitest.dev/) - Testes automatizados
* [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/) - Interface do app
* [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) - Service Worker e instalação como PWA
* [Tailwind CSS](https://tailwindcss.com/) - Estilos
* [TanStack Query](https://tanstack.com/query) + [Zustand](https://zustand.docs.pmnd.rs/) - Dados do servidor e estado local
* [React Router](https://reactrouter.com/) - Rotas
* [FastAPI](https://fastapi.tiangolo.com/) + [pandas](https://pandas.pydata.org/) / [scikit-learn](https://scikit-learn.org/) - Microsserviço de análise (Fase 2)
* [Docker](https://www.docker.com/) - Containerização e ambiente de desenvolvimento
* [Open-Meteo](https://open-meteo.com/) - Dados meteorológicos ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))

## Licença

Este projeto está sob a licença Apache License 2.0 - veja o arquivo [LICENSE](LICENSE) para detalhes.

Dados meteorológicos fornecidos por [Open-Meteo.com](https://open-meteo.com/), sob licença CC BY 4.0.

---
⌨️ com ❤️ por [Shirruny](https://github.com/RodrigoGagliardi)
