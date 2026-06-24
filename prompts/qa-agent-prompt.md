# Prompt para Agente QA/Testes — PresençaFlow RH

Crie testes automatizados para validar os principais fluxos do PresençaFlow RH.

## Backend

Usar Vitest/Jest + Supertest.

Testar:

- Login válido e inválido.
- RBAC por perfil.
- Criar funcionário.
- Criar jornada.
- Criar ocorrência.
- Adicionar evento de timeline.
- Simular ponto não batido.
- Simular aviso de falta.
- Upload de atestado.
- Aprovar atestado.
- Rejeitar atestado com motivo.
- Relatório básico.

## Frontend

Usar Playwright.

Testar:

- Login.
- Navegação no dashboard.
- Cadastro de funcionário.
- Criação de jornada.
- Visualização de ocorrência.
- Aprovação de atestado.
- Filtros em relatórios.

## Stress HTTP inicial

Criar script k6 para:

- 50 usuários simultâneos consultando dashboard.
- 20 usuários criando ocorrências.
- 10 uploads simultâneos de atestado.
- Webhook WhatsApp recebendo mensagens em sequência.

## Critério

- Sem erro 500 em fluxo normal.
- P95 abaixo de 800 ms para endpoints de leitura locais.
- Upload deve retornar status controlado.
