# Prompt Mestre para Agente de Desenvolvimento — PresençaFlow RH

Você é um agente de desenvolvimento senior responsável por criar o projeto PresençaFlow RH.

## Contexto do produto

PresençaFlow RH é uma plataforma vertical para automatizar faltas, atrasos, atestados, check-in remoto e ponto esquecido via WhatsApp, com painel web para RH e gestores.

Não transforme o sistema em ERP genérico de RH. Não implemente folha de pagamento, recrutamento, avaliação de desempenho, benefícios completos, férias completas ou clima organizacional.

## Stack obrigatória

Backend:
- Node.js
- TypeScript
- Fastify preferencialmente, ou Express se mais simples
- Prisma
- PostgreSQL
- Redis
- BullMQ
- Zod
- JWT

Frontend:
- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- React Query
- React Hook Form
- Zod

Infra:
- Docker Compose para PostgreSQL e Redis
- .env.example
- README com comandos

## Regras de engenharia

- Código limpo e modular.
- Separar modules por domínio.
- Validar entrada com Zod.
- Não usar any sem justificativa.
- Criar migrations Prisma.
- Criar seed inicial.
- Criar testes dos fluxos críticos.
- Criar logs estruturados.
- Usar status enums no banco.
- Toda ocorrência deve ter timeline.
- Toda ação relevante deve gerar audit/event.

## Ordem de implementação

1. Criar monorepo backend/frontend.
2. Criar docker-compose com postgres e redis.
3. Criar backend base com health check.
4. Criar Prisma schema inicial.
5. Criar auth JWT.
6. Criar users, employees e work schedules.
7. Criar occurrences e occurrence events.
8. Criar mock de WhatsApp service.
9. Criar fluxo de ponto não batido.
10. Criar fluxo de falta via WhatsApp.
11. Criar upload de atestado.
12. Criar dashboard RH.
13. Criar relatórios/exportação.

## Resultado esperado

Ao final, o projeto deve rodar localmente com:

```bash
docker compose up -d
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

O usuário deve conseguir:

- Logar como admin/RH.
- Cadastrar funcionário.
- Cadastrar jornada.
- Criar ocorrência manual.
- Simular WhatsApp de ponto não batido.
- Simular funcionário avisando falta.
- Enviar atestado.
- Aprovar/rejeitar atestado.
- Ver dashboard.
- Exportar relatório simples.
