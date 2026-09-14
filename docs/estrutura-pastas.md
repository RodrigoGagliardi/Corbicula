# Arquitetura de Pastas — Corbicula

> **Documento vivo.** Este arquivo reflete a estrutura REAL do projeto no disco.
> Sempre que a estrutura mudar (nova pasta, novo módulo, arquivo relevante criado
> ou movido), este documento deve ser atualizado na mesma alteração.
>
> **Instrução ao Claude Code:** ao criar, mover ou remover pastas/arquivos
> estruturais, atualize a árvore abaixo e o histórico no fim do documento antes
> de encerrar a tarefa. Se encontrar divergência entre este documento e o disco,
> o disco é a verdade — corrija o documento para refletir o real.

**Última sincronização:** backend com autenticação, CRUD de colônias, espécies, parâmetros (com ParametroEspecie), avaliações e serviço de clima implementados.

---

## Convenção geral

Os três serviços vivem sob `app/`. Documentação em `docs/`. Arquivos de
orquestração, licença e contexto ficam na raiz.

```
CORBICULA/
├── .claude/                   # config do Claude Code
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
│   └── migrations/            # geradas por prisma migrate
├── src/
│   ├── config/
│   │   ├── database.ts        # singleton do PrismaClient
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
│   │   └── avaliacoes/
│   │       ├── avaliacoes.routes.ts   # montado em /:coloniaId/avaliacoes
│   │       ├── avaliacoes.service.ts  # dispara enriquecerComClima após criar
│   │       ├── avaliacoes.repository.ts
│   │       └── avaliacoes.types.ts
│   ├── services/
│   │   └── weather.service.ts  # Open-Meteo: Forecast + Archive + cache + enrichment
│   ├── shared/
│   │   ├── env.ts              # variáveis de ambiente validadas
│   │   ├── logger.ts
│   │   └── middleware/
│   │       └── authenticate.ts # verifica JWT e injeta userId no request
│   ├── types/
│   │   └── fastify.d.ts        # augmentação de FastifyRequest (userId) e FastifySchema
│   └── server.ts               # entry point: registra plugins e rotas
├── node_modules/
├── Dockerfile
├── .dockerignore
├── .gitignore
├── package.json
├── prisma.config.ts            # config do Prisma v7 (datasource URL, sem url no schema)
└── tsconfig.json
```

Notas:
- O código da colônia é **auto-gerado** pelo serviço (`[KEW_CODIGO]-[NNN]`), nunca digitado pelo usuário.
- `avaliacoesRoutes` é registrado como plugin filho dentro de `coloniasRoutes` para herdar o hook de autenticação.
- `species.routes.ts` acessa o Prisma diretamente (sem camada de service/repository) por ser somente-leitura.
- `weather.service.ts` implementa a integração Open-Meteo com cache em memória (ver `docs/fluxo-fotoclima.md`).

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
