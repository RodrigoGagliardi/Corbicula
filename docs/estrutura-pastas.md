# Arquitetura de Pastas — Corbicula

> **Documento vivo.** Este arquivo reflete a estrutura REAL do projeto no disco.
> Sempre que a estrutura mudar (nova pasta, novo módulo, arquivo relevante criado
> ou movido), este documento deve ser atualizado na mesma alteração.
>
> **Instrução ao Claude Code:** ao criar, mover ou remover pastas/arquivos
> estruturais, atualize a árvore abaixo e o histórico no fim do documento antes
> de encerrar a tarefa. Se encontrar divergência entre este documento e o disco,
> o disco é a verdade — corrija o documento para refletir o real.

**Última sincronização (25/09/2026):** backend do MVP completo (inclui fotos, produções, exportação e sync offline) com suíte de testes automatizados (Vitest) e CI no GitHub Actions.

---

## Convenção geral

Os três serviços vivem sob `app/`. Documentação em `docs/`. Arquivos de
orquestração, licença e contexto ficam na raiz.

```
CORBICULA/
├── .claude/                   # config do Claude Code
├── .github/
│   └── workflows/
│       └── backend-tests.yml  # CI: typecheck + testes do backend (Postgres como service)
├── claude.md                  # contexto vivo do projeto (lido pelo Claude Code)
├── handoff_doc.md             # registro histórico de contexto (legado)
├── README.md
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── LICENSE                    # Apache 2.0
├── makefile
├── docker-compose.yml         # ambiente de desenvolvimento
├── docker-compose.prod.yml    # ambiente de produção
├── .env / .env.example
├── docs/                      # documentação detalhada
│   ├── escopo.md
│   ├── prisma-setup.md
│   ├── especies.md
│   ├── telas.md
│   ├── fluxo-fotoclima.md
│   ├── efetividade.md
│   ├── exportacao.md          # dicionário de dados e metodologia da exportação
│   └── estrutura-pastas.md    # este arquivo
└── app/
    ├── backend/               # Node.js + Fastify + Prisma  [EXISTE]
    ├── frontend/              # React + Vite + PWA          [A CRIAR]
    └── analytics/             # Python + FastAPI (Fase 2)   [A CRIAR]
```

---

## app/backend — Node.js API [EXISTE]

Arquitetura modular: cada domínio de negócio vive em `src/modules/<nome>/` com seus próprios `routes`, `service`, `repository` e `types`. Código compartilhado fica em `src/shared/`. Serviços externos (weather) ficam em `src/services/`.

```
app/backend/
├── prisma/
│   ├── schema.prisma          # 11 tabelas (ver docs/prisma-setup.md)
│   ├── seed.ts                # 19 espécies + usuário de teste + parâmetros + colônia exemplo
│   └── migrations/            # geradas por prisma migrate (<timestamp>_init/)
├── src/
│   ├── config/
│   │   ├── database.ts        # singleton do PrismaClient (driver adapter @prisma/adapter-pg)
│   │   └── swagger.ts         # opções do @fastify/swagger
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.types.ts
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   └── users.types.ts
│   │   ├── colonias/
│   │   │   ├── colonias.routes.ts    # registra avaliacoesRoutes como sub-recurso
│   │   │   ├── colonias.service.ts   # inclui geração de código (prefixo Kew + sequencial)
│   │   │   ├── colonias.repository.ts
│   │   │   └── colonias.types.ts
│   │   ├── especies/
│   │   │   └── especies.routes.ts    # catálogo fixo, sem service/repository
│   │   ├── parametros/
│   │   │   ├── parametros.routes.ts
│   │   │   ├── parametros.service.ts
│   │   │   ├── parametros.repository.ts  # inclui upsertCriterioEspecie
│   │   │   └── parametros.types.ts
│   │   ├── avaliacoes/
│   │   │   ├── avaliacoes.routes.ts   # montado em /:coloniaId/avaliacoes
│   │   │   ├── avaliacoes.service.ts  # dispara enriquecerComClima após criar
│   │   │   ├── avaliacoes.repository.ts  # upsert de parâmetros (preserva fotos vinculadas)
│   │   │   └── avaliacoes.types.ts
│   │   ├── fotos/
│   │   │   ├── fotos.routes.ts        # upload multipart (/fotos)
│   │   │   ├── fotos.service.ts       # regra de integridade das FKs + armazenamento em disco
│   │   │   ├── fotos.repository.ts
│   │   │   └── fotos.types.ts
│   │   ├── producoes/
│   │   │   ├── producoes.routes.ts    # /producoes e /producoes/resumo
│   │   │   ├── producoes.service.ts   # totais/médias/ranking por (tipo, unidade)
│   │   │   ├── producoes.repository.ts
│   │   │   └── producoes.types.ts
│   │   ├── exportacao/
│   │   │   ├── exportacao.routes.ts   # /exportacao/{colonias,avaliacoes,producoes,backup}
│   │   │   ├── exportacao.service.ts  # linhas tidy + metadados/metodologia
│   │   │   ├── exportacao.types.ts
│   │   │   └── csv.ts                 # serialização RFC 4180
│   │   └── sync/
│   │       ├── sync.routes.ts         # POST /sync, GET /sync/alteracoes, GET /sync/status
│   │       ├── sync.service.ts        # aplica operações offline via services existentes
│   │       └── sync.types.ts
│   ├── services/
│   │   └── weather.service.ts  # Open-Meteo: Forecast + Archive + cache + enrichment
│   ├── shared/
│   │   ├── env.ts              # variáveis de ambiente (inclui UPLOADS_DIR)
│   │   ├── errors.ts           # erros tipados (NOT_FOUND, CONFLICT, BAD_REQUEST)
│   │   ├── json.ts             # parse tolerante de campos JSON-em-texto
│   │   └── middleware/
│   │       └── authenticate.ts # verifica JWT e injeta userId no request
│   ├── types/
│   │   └── fastify.d.ts        # augmentação de FastifyRequest (userId, parts) e FastifySchema
│   ├── app.ts                  # buildApp(): registra plugins (cors, multipart, static) e rotas
│   └── server.ts               # entry point: buildApp() + listen
├── tests/
│   ├── setup/
│   │   ├── test-env.mts        # URL do banco <nome>_test e pasta de uploads temporária
│   │   └── global-setup.ts     # recria o banco de teste (migrate reset + seed) antes da suíte
│   ├── unit/                   # score, CSV, clima (fetch mockado)
│   ├── integration/            # API via app.inject: auth, colonias, avaliacoes, fotos,
│   │                           # producoes, exportacao, sync
│   └── helpers.ts              # cliente autenticado, fábricas de dados, multipart
├── uploads/                    # fotos (volume Docker backend_uploads; ignorado no git)
├── node_modules/
├── Dockerfile
├── .dockerignore
├── .gitignore
├── package.json
├── prisma.config.ts            # config do Prisma v7 (datasource URL, migrations, comando de seed)
├── vitest.config.mts           # Vitest: env de teste, globalSetup
├── tsconfig.json               # build (src + prisma)
└── tsconfig.test.json          # typecheck incluindo tests/ (npm run typecheck)
```

Notas:
- O código da colônia é **auto-gerado** pelo serviço (`[KEW_CODIGO]-[NNN]`), nunca digitado pelo usuário.
- `avaliacoesRoutes` é registrado como plugin filho dentro de `coloniasRoutes` para herdar o hook de autenticação.
- `especies.routes.ts` acessa o Prisma diretamente (sem camada de service/repository) por ser somente-leitura.
- `weather.service.ts` implementa a integração Open-Meteo com cache em memória (ver `docs/fluxo-fotoclima.md`).
- Fotos são servidas estaticamente em `/uploads/fotos/<uuid>.<ext>`; excluir foto/colônia/avaliação/colheita remove também os arquivos.
- `sync` não duplica regras: cada operação offline é aplicada pelos mesmos services da API REST.
- Testes: `npm test` (ou `make test` no container). Usam um banco separado (`<DATABASE_URL>_test`), recriado a cada execução, e nunca tocam o banco de desenvolvimento. Cada arquivo cria seus próprios usuários, o que isola os dados entre arquivos. A Open-Meteo nunca é chamada nos testes.

---

## app/frontend — React + PWA [A CRIAR]

Estrutura planejada (ajustar quando criada):

```
app/frontend/
├── public/
│   ├── icons/                 # ícones PWA
│   └── manifest.json
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── ui/                # componentes base (Button, Card, Modal...)
│   │   ├── layout/            # Header, Sidebar, Navigation
│   │   ├── charts/            # gráficos (Recharts)
│   │   └── features/          # ColonyCard, EvaluationForm, GenealogyTree...
│   ├── pages/                 # as telas (ver docs/telas.md)
│   ├── hooks/                 # useColonies, useOffline, useSync...
│   ├── services/
│   │   ├── api/               # cliente HTTP para o backend
│   │   └── offline/           # IndexedDB, sync, fila
│   ├── store/                 # Zustand
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── router.tsx
├── Dockerfile
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## app/analytics — Python Analytics [A CRIAR — Fase 2]

Estrutura planejada (ajustar quando criada):

```
app/analytics/
├── app/
│   ├── routes/                # endpoints de análise
│   ├── services/              # pandas/NumPy/scikit-learn
│   ├── models/                # Pydantic
│   ├── utils/
│   ├── database.py            # conexão PostgreSQL (mesmo banco)
│   └── main.py                # FastAPI app
├── notebooks/                 # Jupyter para exploração
├── Dockerfile
└── requirements.txt
```

Notas:
- Acessado via proxy pelo backend Node (não diretamente pelo frontend).
- Compartilha o mesmo PostgreSQL do backend.
- Só entra na Fase 2 — o MVP roda sem ele.

---

## Convenções de nomenclatura

- Componentes React: PascalCase (`ColonyCard.tsx`)
- Hooks: camelCase com prefixo `use` (`useColonies.ts`)
- Services/utils Node: camelCase com sufixo (`colonies.service.ts`)
- Python: snake_case (`colony_analysis.py`)
- Pastas: lowercase com hífen

---

## Histórico de alterações estruturais

> O Claude Code registra aqui cada mudança estrutural relevante, com data e descrição.

- **[estado inicial]** — Backend criado em `app/backend/` com Prisma (`prisma.config.ts`),
  `src/`, Dockerfile e configs. Raiz com docker-compose (dev/prod), .env, README,
  CHANGELOG, CODE_OF_CONDUCT, LICENSE (Apache 2.0), makefile, claude.md, handoff_doc.md.
  Frontend e analytics ainda não criados.

- **[backend — implementação do MVP]** — Criados `src/modules/` (auth, users, colonias,
  especies, parametros, avaliacoes), `src/shared/` (env, logger, middleware/authenticate),
  `src/services/weather.service.ts`, `src/types/fastify.d.ts`. Removidos `controllers/`,
  `routes/` e `validators/` como pastas de nível superior — a arquitetura modular eliminou
  a necessidade dessas pastas separadas. Schema Prisma expandido para 11 tabelas (adicionada
  `ParametroEspecie`). `especies.routes.ts` opera diretamente sobre o Prisma sem
  service/repository por ser catálogo somente-leitura.

- **[2026-09-24 — pauta 2 do backend]** — Criados os módulos `src/modules/fotos/`,
  `producoes/`, `exportacao/` e `sync/`; `src/shared/errors.ts` e `src/shared/json.ts`;
  migration `prisma/migrations/<timestamp>_init/`; pasta `uploads/` (volume Docker
  `backend_uploads`). Removidos arquivos mortos: `src/shared/logger.ts` (vazio),
  `src/experiments/` (README vazio), `src/routes/` (pasta vazia) e `src/prisma/client.ts`
  (reexport sem uso). Adicionado `docs/exportacao.md`.

- **[2026-09-25 — testes automatizados]** — Criados `tests/` (unit, integration, setup,
  helpers), `vitest.config.mts`, `tsconfig.test.json` e `.github/workflows/backend-tests.yml`.
  `src/server.ts` dividido: a montagem da aplicação foi para `src/app.ts` (`buildApp()`),
  usada pelos testes via `app.inject`. `tsconfig.json` passou a incluir só `src/` e `prisma/`.
