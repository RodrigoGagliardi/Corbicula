.PHONY: up down restart build logs shell-backend shell-db migrate db-push seed reset test

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build --no-cache

logs:
	docker compose logs -f

# Cria uma nova migration (uso: make migrate name=nome_da_migration)
migrate:
	docker compose exec backend npx prisma migrate dev --name $(name)

# Sincroniza o schema sem gerar migration (ótimo para dev rápido)
db-push:
	docker compose exec backend npx prisma db push

# Abre Prisma Studio no navegador
studio:
	docker compose exec backend npx prisma studio

# Roda o seed de espécies + usuário de teste
seed:
	docker compose exec backend npx prisma db seed

# Abre shell no container do backend
shell-backend:
	docker compose exec backend sh

# Abre psql no container do postgres
shell-db:
	docker compose exec postgres psql -U corbicula -d corbicula_db

# Derruba tudo e apaga volumes (reset completo do banco)
reset:
	docker compose down -v
	docker compose up -d

# Roda a suíte de testes do backend (usa o banco corbicula_db_test, recriado a cada execução)
test:
	docker compose exec backend npm test
