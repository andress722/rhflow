# Prompt para Agente Backend — PresençaFlow RH

Crie o backend do PresençaFlow RH usando Node.js, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, Zod e JWT.

## Requisitos principais

- API REST com prefixo `/api`.
- Health checks.
- Auth com JWT.
- RBAC: ADMIN, HR, MANAGER, VIEWER.
- Prisma schema baseado em `docs/03-data-model.md`.
- Módulos: auth, users, employees, workSchedules, attendance, occurrences, absences, medicalCertificates, remoteWork, whatsapp, dashboard, reports.
- Upload de arquivo para atestado.
- Storage local no dev.
- Mock de WhatsApp service no início.
- Webhook WhatsApp preparado.
- Toda ocorrência deve gerar eventos em `OccurrenceEvent`.
- Logs estruturados.

## Não implementar

- Folha de pagamento.
- Recrutamento.
- Benefícios completos.
- Férias completas.
- Monitoramento invasivo remoto.

## Critérios de aceite

- `npm run build` sem erro.
- `npm test` executando testes principais.
- Prisma migrate funcionando.
- Seed criando empresa, admin, RH, gestor e funcionários exemplo.
- Swagger/OpenAPI, se possível.
