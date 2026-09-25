# Corbicula

O Projeto Corbicula tem como principal objetivo a coleta e análise de dados de colônias de abelhas do Rio Grande do Sul, podendo ser utilizado tanto para fins científicos da academia quanto para gerenciamento de meliponários de pequeno e médio porte.

Voltado a abelhas sem ferrão (Meliponini), o sistema permite avaliações personalizáveis de saúde das colônias, controle genético de linhagens (relação mãe/filha em divisões), análise de horários e dias de atividade, cálculo de velocidade de postura e estimativa de idade da rainha. Funciona offline (PWA) e enriquece cada inspeção com dados climáticos automáticos a partir das coordenadas da colônia.

## Começando

Essas instruções permitirão que você obtenha uma cópia do projeto em operação na sua máquina local para fins de desenvolvimento e teste.

Consulte **[Implantação](#-implantação)** para saber como implantar o projeto.

### Pré-requisitos

O projeto roda inteiramente em containers, então você só precisa do Docker instalado. Git é necessário para clonar o repositório.

```
Docker Desktop 24+ (ou Docker Engine + Docker Compose v2)
Git
```

Opcionalmente, para desenvolver fora dos containers ou rodar comandos localmente:

```
Node.js 20+ (backend e frontend)
Python 3.11+ (microsserviço de análise)
```

Verifique se está tudo instalado:

```
docker --version
docker compose version
git --version
```

### Instalação

Uma série de exemplos passo-a-passo que informam o que você deve executar para ter um ambiente de desenvolvimento em execução.

Primeiro, clone o repositório e entre na pasta do projeto:

```
git clone https://github.com/RodrigoGagliardi/Corbicula.git
cd Corbicula
```

Em seguida, crie o arquivo de variáveis de ambiente a partir do exemplo:

```
cp .env.example .env
```

O `.env` já vem com valores padrão para desenvolvimento local. Edite apenas se quiser trocar credenciais do banco ou o segredo do JWT:

```
POSTGRES_USER=corbicula
POSTGRES_PASSWORD=corbicula123
POSTGRES_DB=corbicula_db
JWT_SECRET=troque-este-segredo-em-producao
```

Suba todos os serviços com Docker Compose:

```
docker compose up -d
```

Com os containers no ar, crie as tabelas do banco rodando as migrations do Prisma:

```
docker compose exec backend npx prisma migrate dev --name init
```

E popule o banco com as espécies do RS e dados de exemplo:

```
docker compose exec backend npx prisma db seed
```

Ao finalizar, os serviços estarão disponíveis em:

```
Frontend:   http://localhost:5173
Backend:    http://localhost:3000
Analytics:  http://localhost:8000
PostgreSQL: localhost:5432
```

Para uma pequena demonstração, acesse o frontend e entre com o usuário de exemplo criado pelo seed:

```
E-mail: teste@corbicula.com
Senha:  senha123
```

A partir daí você pode cadastrar uma colônia, definir seus parâmetros de avaliação e registrar a primeira inspeção — o clima do momento é preenchido automaticamente pela API a partir das coordenadas informadas.

## Executando os testes

Os testes são separados por serviço: o backend Node.js usa Jest, o microsserviço Python usa pytest e o frontend usa Vitest. Todos podem ser executados dentro dos respectivos containers.

```
docker compose exec backend npm test
docker compose exec analytics pytest
docker compose exec frontend npm test
```

### Analise os testes de ponta a ponta

Os testes de integração verificam os fluxos completos da aplicação: autenticação, criação de colônias, registro de avaliações com cálculo automático de score, e a comunicação entre o backend Node.js e o microsserviço Python de análise. Servem para garantir que uma mudança em um serviço não quebre o contrato entre eles.

```
docker compose exec backend npm run test:integration
```

Esses testes sobem um banco de testes isolado, simulam requisições HTTP às rotas e conferem se os dados persistem corretamente e se as respostas seguem o formato esperado.

### E testes de estilo de codificação

O padrão de código é garantido por ESLint e Prettier (TypeScript) e por Black e Ruff (Python). Eles verificam formatação consistente, ausência de código morto e aderência às convenções do projeto, mantendo a base legível para colaboradores.

```
docker compose exec backend npm run lint
docker compose exec frontend npm run lint
docker compose exec analytics black --check . && ruff check .
```

## Construído com

Mencione as ferramentas que você usou para criar seu projeto

* [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) - Interface e PWA (funcionamento offline)
* [Vite](https://vitejs.dev/) - Build tool e servidor de desenvolvimento do frontend
* [Fastify](https://fastify.dev/) - Framework web do backend principal
* [Prisma](https://www.prisma.io/) - ORM e gerenciamento de migrations
* [FastAPI](https://fastapi.tiangolo.com/) - Microsserviço de análise de dados
* [pandas](https://pandas.pydata.org/) / [NumPy](https://numpy.org/) / [scikit-learn](https://scikit-learn.org/) - Análise estatística e machine learning
* [PostgreSQL](https://www.postgresql.org/) - Banco de dados relacional
* [Docker](https://www.docker.com/) - Containerização e ambiente de desenvolvimento
* [Open-Meteo](https://open-meteo.com/) - Dados meteorológicos (CC BY 4.0)

## Versão

Nós usamos [SemVer](http://semver.org/) para controle de versão. Para as versões disponíveis, observe as [tags neste repositório](https://github.com/RodrigoGagliardi/Corbicula/tags).

## Licença

Este projeto está sob a licença Apache License 2.0 - veja o arquivo [LICENSE](https://github.com/RodrigoGagliardi/Corbicula/blob/main/LICENSE) para detalhes.


---
⌨️ com ❤️ por [Shirruny](https://github.com/RodrigoGagliardi)
