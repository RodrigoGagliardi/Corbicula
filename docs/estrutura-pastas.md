# Arquitetura de Pastas — Corbicula

> **Documento vivo.** Este arquivo reflete a estrutura REAL do projeto no disco.
> Sempre que a estrutura mudar (nova pasta, novo módulo, arquivo relevante criado
> ou movido), este documento deve ser atualizado na mesma alteração.
>
> **Instrução ao Claude Code:** ao criar, mover ou remover pastas/arquivos
> estruturais, atualize a árvore abaixo e o histórico no fim do documento antes
> de encerrar a tarefa. Se encontrar divergência entre este documento e o disco,
> o disco é a verdade — corrija o documento para refletir o real.

**Última sincronização (01/10/2026):** backend do MVP completo (inclui fotos, produções, exportação e sync offline) com suíte de testes automatizados (Vitest) e CI no GitHub Actions. Frontend criado em `app/frontend/` (React + Vite + PWA) com as primeiras telas do MVP; a camada offline de dados ainda não existe.

---

## Convenção geral

Os três serviços vivem sob `app/`. Documentação em `docs/`. Arquivos de
orquestração, licença e contexto ficam na raiz.

```
CORBICULA/
├── .claude/                   # config do Claude Code (ignorado no git)
├── .husky/                    # git hooks (pre-commit + commitlint no commit-msg)
├── .github/
│   └── workflows/
│       └── backend-tests.yml  # CI: typecheck + testes do backend (Postgres como service)
├── CLAUDE.md                  # contexto vivo do projeto (lido pelo Claude Code; ignorado no git)
├── README.md
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── LICENSE                    # Apache 2.0
├── makefile
├── package.json               # tooling da raiz: husky, commitlint, release-it
├── commitlint.config.js       # Conventional Commits
├── .release-it.json           # versionamento + CHANGELOG
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
    ├── frontend/              # React + Vite + PWA          [EXISTE]
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
│   │   │   ├── avaliacoes.routes.ts   # /:coloniaId/avaliacoes (CRUD) + /avaliacoes (histórico geral)
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
- `avaliacoesRoutes` é registrado como plugin filho dentro de `coloniasRoutes` para herdar o hook de autenticação. `historicoAvaliacoesRoutes` (mesmo arquivo) fica em `/avaliacoes`, só leitura, com o próprio hook.
- `especies.routes.ts` acessa o Prisma diretamente (sem camada de service/repository) por ser somente-leitura.
- `weather.service.ts` implementa a integração Open-Meteo com cache em memória (ver `docs/fluxo-fotoclima.md`).
- Fotos são servidas estaticamente em `/uploads/fotos/<uuid>.<ext>`; excluir foto/colônia/avaliação/colheita remove também os arquivos.
- `sync` não duplica regras: cada operação offline é aplicada pelos mesmos services da API REST.
- Testes: `npm test` (ou `make test` no container). Usam um banco separado (`<DATABASE_URL>_test`), recriado a cada execução, e nunca tocam o banco de desenvolvimento. Cada arquivo cria seus próprios usuários, o que isola os dados entre arquivos. A Open-Meteo nunca é chamada nos testes.

---

## app/frontend — React + PWA [EXISTE]

SPA em React 19 + TypeScript, servida pelo Vite. Estado do servidor com TanStack Query, sessão com Zustand (persistida no localStorage), estilos com Tailwind CSS v4, rotas com React Router v7. O PWA é gerado pelo `vite-plugin-pwa` (manifest + Service Worker com o app shell em cache). Os nomes de componentes e páginas seguem o idioma do projeto (português).

```
app/frontend/
├── public/
│   └── icons/                 # logos oficiais (Logo Corbicula*.png) + favicon.svg e ícones PWA gerados
├── scripts/
│   └── gerar-icones.mjs       # gera favicon.svg + PNGs do PWA a partir da geometria do logo (npm run icones)
├── src/
│   ├── components/
│   │   ├── ui/                # Botao, Campo, Cartao, Estados (carregando/erro/vazio)
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx      # /app: sidebar verde recolhível (desktop) ↔ barra inferior + "Mais" (mobile)
│   │   │   ├── LayoutPublico.tsx  # páginas públicas: cabeçalho + rodapé + <Outlet/>
│   │   │   ├── CartaoAutenticacao.tsx  # cartão de login/cadastro/recuperar senha
│   │   │   ├── Marca.tsx          # logo do favo + nome
│   │   │   └── navegacao.ts       # fonte única dos itens de navegação dos dois layouts
│   │   ├── charts/
│   │   │   └── GraficoScore.tsx   # evolução do score de uma colônia
│   │   └── features/          # CartaoColonia, GaleriaFotos, SeletorClassificacao, SeloScore
│   ├── pages/
│   │   ├── Landing.tsx, Login.tsx, Cadastro.tsx, RecuperarSenha.tsx, Sobre.tsx, NaoEncontrado.tsx
│   │   ├── Dashboard.tsx
│   │   ├── EmConstrucao.tsx   # tela "em construção" das rotas ainda não implementadas
│   │   ├── telasPlanejadas.ts # rotas /app pendentes + o que cada tela vai mostrar (docs/telas.md)
│   │   ├── colonias/          # ListaColonias, DetalheColonia, FormColonia (criar/editar)
│   │   ├── avaliacoes/        # HistoricoAvaliacoes, NovaAvaliacao (fluxo rápido; formulário também usado na edição), EditarAvaliacao, DetalheAvaliacao
│   │   ├── parametros/        # ListaParametros, FormParametro (criar/editar)
│   │   └── producao/          # HistoricoProducao, FormColheita (registrar/editar), RelatorioProducao
│   ├── hooks/
│   │   ├── useDados.ts        # queries do TanStack Query + chaves de cache centralizadas
│   │   └── useOnline.ts       # estado de conexão do navegador
│   ├── services/
│   │   └── api/
│   │       ├── client.ts      # fetch com JWT, ErroApi (status + mensagens do backend)
│   │       └── endpoints.ts   # funções por recurso (colônias, avaliações, parâmetros, fotos...)
│   ├── store/
│   │   ├── auth.ts            # sessão (token + usuário) em Zustand persistido
│   │   └── preferencias.ts    # tema (claro/escuro/sistema) e sidebar recolhida
│   ├── types/
│   │   └── api.ts             # tipos das respostas da API
│   ├── utils/
│   │   ├── colonias.ts        # colônias que pedem atenção (nunca avaliada, score baixo, inspeção atrasada)
│   │   ├── format.ts          # datas e números em pt-BR
│   │   ├── imagem.ts          # compressão de foto no cliente (canvas, ~500 KB)
│   │   ├── parametrosSugeridos.ts  # sugestões de parâmetros para começar
│   │   ├── periodo.ts         # atalhos de período dos filtros (produção, avaliações)
│   │   ├── producao.ts        # rótulos/unidades dos produtos
│   │   └── score.ts           # faixas do score (Excelente/Boa/Atenção/Crítica) e prazo de edição (7 dias)
│   ├── index.css              # Tailwind + tokens do tema (claro/escuro): verde floresta + amarelo do logo
│   ├── main.tsx               # entry point: QueryClient + RouterProvider
│   ├── router.tsx             # rotas públicas + /app/* privadas, guardas e redirecionamento dos endereços antigos
│   └── test-setup.ts          # jest-dom para o Vitest (ainda sem testes escritos)
├── node_modules/              # volume Docker frontend_modules
├── Dockerfile                 # targets: development (Vite) → builder → production (nginx)
├── .dockerignore
├── .gitignore                 # node_modules, dist, dev-dist
├── index.html
├── package.json               # scripts: dev, build, typecheck, test, icones
├── tsconfig.json
└── vite.config.ts             # React, Tailwind, PWA (manifest + workbox), Vitest, polling p/ Docker no Windows
```

Notas:
- `VITE_API_URL` é a URL da API vista pelo **navegador** (padrão `http://localhost:3000`), não pela rede Docker.
- `/` redireciona para `/dashboard` (logado) ou `/login`; ainda não existe landing page.
- Ainda não existem: `services/offline/` (IndexedDB + fila usando `/sync`) e as telas de produção, análises, exportação e configurações.
- `watch.usePolling` no Vite é necessário para o hot reload funcionar com bind mount do Windows dentro do Docker.

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

- **[2026-10-01 — frontend]** — Criado `app/frontend/` (React + Vite + PWA) com
  `components/{ui,layout,charts,features}`, `pages/` (colonias, avaliacoes, parametros),
  `hooks/`, `services/api/`, `store/`, `types/`, `utils/`, `public/icons/` e
  `scripts/gerar-icones.mjs`. Serviço `frontend` ativado no `docker-compose.yml` (volume
  `frontend_modules`). Árvore da raiz corrigida para o disco: `handoff_doc.md` não existe mais;
  adicionados `.husky/`, `package.json`, `commitlint.config.js` e `.release-it.json`.

- **[2026-10-14 — frontend: tema e rotas]** — Rotas privadas passaram para `/app/*` (endereços
  antigos redirecionam); `/` virou landing page. Criados `components/layout/{LayoutPublico,
  CartaoAutenticacao,Marca}.tsx` (o antigo `LayoutPublico` virou `CartaoAutenticacao`),
  `pages/{Landing,RecuperarSenha,EmConstrucao}.tsx`, `pages/telasPlanejadas.ts` e
  `store/preferencias.ts`. Cores migradas para tokens semânticos em `index.css` (tema
  "Natureza & Científico" + amarelo do logo, com modo escuro).

- **[2026-10-14 — frontend: produção]** — Criados `pages/producao/` e `utils/producao.ts`; as rotas `/app/producao*` deixaram de ser "em construção".

- **[2026-10-15 — histórico e edição de avaliações]** — Backend: `GET /avaliacoes` (histórico geral com filtros) em `avaliacoes.routes.ts`. Frontend: `pages/avaliacoes/{HistoricoAvaliacoes,EditarAvaliacao}.tsx`; os atalhos de período saíram de `utils/producao.ts` para `utils/periodo.ts`; `/app/avaliacoes` deixou de ser "em construção".
