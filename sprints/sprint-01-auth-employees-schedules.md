# Sprint 01 — Autenticação, Funcionários e Jornadas

## Objetivo

Permitir acesso autenticado, cadastro de usuários, funcionários e jornadas.

## Entregas

- Auth JWT.
- Perfis: ADMIN, HR, MANAGER, VIEWER.
- CRUD de usuários.
- CRUD de funcionários.
- CRUD de jornadas.
- Seed inicial.
- Telas de login, funcionários e jornadas.

## Backend tasks

- Criar models: Company, User, Employee, WorkSchedule.
- Criar seed com empresa, admin, RH, gestor e funcionários.
- Criar login.
- Criar middleware auth.
- Criar middleware role.
- Criar endpoints de employees.
- Criar endpoints de work schedules.

## Frontend tasks

- Tela de login.
- Proteção de rotas.
- Layout app.
- Listagem de funcionários.
- Formulário criar/editar funcionário.
- Listagem de jornadas.
- Formulário criar/editar jornada.

## Critérios de aceite

- Admin consegue logar.
- RH consegue cadastrar funcionário.
- RH consegue vincular jornada.
- Gestor não consegue acessar tela de usuários.
