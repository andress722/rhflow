# Prompt para Agente Frontend — PresençaFlow RH

Crie o frontend do PresençaFlow RH usando Next.js, TypeScript, Tailwind, shadcn/ui, React Query, React Hook Form e Zod.

## Objetivo

Construir painel web para RH e gestores acompanharem faltas, atrasos, atestados, ponto esquecido, check-in remoto e ocorrências.

## Páginas obrigatórias

- Login
- Dashboard
- Funcionários
- Detalhe do funcionário
- Jornadas
- Ocorrências
- Detalhe da ocorrência com timeline
- Atestados
- Análise de atestado
- Trabalho remoto
- Relatórios
- Configurações de usuários
- Configurações de automação

## UI esperada

- Visual limpo, B2B, profissional.
- Cards de indicadores.
- Tabelas com filtros.
- Badges por status.
- Drawer/modal para ações rápidas.
- Tela de atestado com preview do arquivo e formulário de decisão.
- Timeline visual para ocorrências.

## Regras

- Não expor dados médicos sensíveis em listas.
- CPF deve aparecer mascarado em tabelas.
- Gestor só deve visualizar equipe dele quando backend retornar escopo limitado.
- Usar estados de loading, empty e error.

## Critérios de aceite

- Frontend compila.
- Login funcional contra API.
- CRUD básico de funcionários.
- Lista de ocorrências funcional.
- Detalhe com timeline.
- Análise de atestado funcional.
- Dashboard consumindo endpoint real ou mock temporário.
