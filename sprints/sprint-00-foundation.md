# Sprint 00 — Fundação Técnica

## Objetivo

Criar a estrutura inicial do projeto, ambiente local, backend base, frontend base, banco e Redis.

## Entregas

- Monorepo `presencaflow-rh`.
- `backend/` com Node.js + TypeScript.
- `frontend/` com Next.js + TypeScript.
- `docker-compose.yml` com PostgreSQL e Redis.
- `.env.example` backend e frontend.
- Prisma configurado.
- Health check da API.
- README com comandos.

## Backend tasks

- Inicializar projeto TypeScript.
- Configurar Fastify ou Express.
- Configurar ESLint/Prettier.
- Configurar Prisma.
- Criar conexão com banco.
- Criar `/api/health`, `/api/health/live`, `/api/health/ready`.
- Criar estrutura modular.

## Frontend tasks

- Inicializar Next.js.
- Configurar Tailwind.
- Configurar shadcn/ui.
- Criar layout base.
- Criar tela `/login` placeholder.
- Criar `/app/dashboard` placeholder.

## Critérios de aceite

- `docker compose up -d` sobe banco e Redis.
- Backend roda localmente.
- Frontend roda localmente.
- Health check retorna OK.
- Prisma conecta no banco.
