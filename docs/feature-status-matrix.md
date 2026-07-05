# Feature Status Matrix - Sprint 52.1

Esta matriz fornece um mapeamento honesto do estado atual das principais funcionalidades do PresençaFlow RH após a Sprint 52 e o planejamento para a Sprint 52.1 (Closure Verification).

## Matriz de Status

| Feature | Backend | Frontend | Persistência | Segurança | Testes | Integração Externa | Status Inicial | Gap | Status Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Workforce Risk Signals** | COMPLETE | PARTIAL | COMPLETE | COMPLETE | PARTIAL | NOT_APPLICABLE | PARTIAL | Rota semântica incorreta, falta de testes orientados a risco. | COMPLETE |
| **Calendar Google** | FOUNDATION_ONLY | NOT_IMPLEMENTED | FOUNDATION_ONLY | NEEDS_HOMOLOGATION | PARTIAL | NEEDS_HOMOLOGATION | NEEDS_HOMOLOGATION | Sem credenciais reais, fluxo não homologado na API oficial. | NEEDS_HOMOLOGATION |
| **Calendar Microsoft** | FOUNDATION_ONLY | NOT_IMPLEMENTED | FOUNDATION_ONLY | NEEDS_HOMOLOGATION | PARTIAL | NEEDS_HOMOLOGATION | NEEDS_HOMOLOGATION | Sem credenciais reais, fluxo não homologado na API oficial. | NEEDS_HOMOLOGATION |
| **PWA Shell** | NOT_APPLICABLE | COMPLETE | NOT_APPLICABLE | COMPLETE | NOT_IMPLEMENTED | NOT_APPLICABLE | COMPLETE | PWA manifest e cache funcionando; falta documentação. | COMPLETE |
| **Offline Business Operation** | COMPLETE | PARTIAL | COMPLETE | COMPLETE | PARTIAL | NOT_APPLICABLE | PARTIAL | Fila IndexedDB só no simulador; narrativa incorreta sobre payloadHash. | PARTIAL |
| **Importador Inteligente V1** | COMPLETE | COMPLETE | COMPLETE | PARTIAL | PARTIAL | NOT_APPLICABLE | PARTIAL | Falta validação de CPF concorrente, MIME, formula injection e atomicidade. | COMPLETE |
| **Portal do Colaborador V1** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | PARTIAL | NOT_APPLICABLE | PARTIAL | Endpoints usam e-mail do JWT, mas faltam testes contra IDOR e Parameter Tampering. | COMPLETE |
| **Leave Requests** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | PARTIAL | NOT_APPLICABLE | COMPLETE | Falta teste de concorrência estrito para aprovação múltipla. | COMPLETE |
| **AbsenceRecord** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | PARTIAL | NOT_APPLICABLE | COMPLETE | Vinculado de forma única, mas requer teste de concorrência. | COMPLETE |
| **Hour Bank** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | PARTIAL | NOT_APPLICABLE | PARTIAL | Faltavam validações de invariantes balance/concorrência e testes. | COMPLETE |
| **Radar SSE** | COMPLETE | COMPLETE | NOT_APPLICABLE | COMPLETE | PARTIAL | NOT_APPLICABLE | PARTIAL | Conectado, mas requer teste de ciclo de vida (heartbeat, disconnect, leak). | COMPLETE |
| **Web Push** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | PARTIAL | NEEDS_HOMOLOGATION | NEEDS_HOMOLOGATION | Falta teste do gatilho automático de exclusão em erros 404/410. | NEEDS_HOMOLOGATION |
| **Correlation ID** | COMPLETE | NOT_APPLICABLE | NOT_APPLICABLE | COMPLETE | PARTIAL | NOT_APPLICABLE | PARTIAL | Implementado nos middlewares básicos, mas requer testes automatizados. | COMPLETE |
| **Structured Logging** | COMPLETE | NOT_APPLICABLE | NOT_APPLICABLE | PARTIAL | NOT_IMPLEMENTED | NOT_APPLICABLE | PARTIAL | Redação PII básica existe, mas requer proteção centralizada e testes. | COMPLETE |
| **Readiness** | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | PARTIAL | NOT_APPLICABLE | COMPLETE | Readiness consulta DB/Redis; requer teste robusto de indisponibilidade. | COMPLETE |
| **Job Locking** | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | PARTIAL | NOT_APPLICABLE | PARTIAL | Lock simples implementado, mas precisa de token único (ownership) e script Lua. | COMPLETE |

---

## Evidências por Feature

### 1. Workforce Risk Signals
- **Arquivo Principal**: [employees.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/employees.ts) (Backend), [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employees/page.tsx) (Frontend)
- **Rota Principal**: `GET /api/employees/:id/workforce-risk-signals` (e alias legado `GET /api/employees/:id/turnover-risk`)
- **Modelo Prisma**: `Employee` (campo `turnoverRiskScore`)
- **Migration**: N/A (usa campo existente)
- **Teste Correspondente**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma (heurística interna baseada em assiduidade, Pulse Surveys e faltas)
- **Observação**: Classificado puramente como heurístico, exigindo revisão humana obrigatória.

### 2. Calendar Integration (Google & Microsoft)
- **Arquivo Principal**: [calendar-sync.service.ts](file:///e:/RHFLOW/rhflow/backend/src/services/calendar-sync.service.ts), [calendar.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/calendar.ts)
- **Rota Principal**: `POST /api/calendar/configure`
- **Modelo Prisma**: `CalendarConfiguration`
- **Migration**: `20260704020000_add_webpush_hourbank_leaverequest`
- **Teste Correspondente**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Google Calendar API / Microsoft Graph API
- **Observação**: Credenciais reais de homologação dependem de credenciais fornecidas pelo cliente (NEEDS_HOMOLOGATION).

### 3. PWA Shell
- **Arquivo Principal**: `frontend/public/manifest.json`, `frontend/src/app/layout.tsx`
- **Rota Principal**: N/A
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Teste Correspondente**: N/A (validado visualmente/Lighthouse)
- **Dependência Externa**: Suporte do navegador a Service Workers e manifestos PWA.
- **Observação**: Casca (Shell) do aplicativo funciona offline.

### 4. Offline Business Operation
- **Arquivo Principal**: [offline-db.ts](file:///e:/RHFLOW/rhflow/frontend/src/lib/offline-db.ts), [presence.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/presence.ts)
- **Rota Principal**: `POST /api/presence/:id/simulate-response` (Sincronização de check-in)
- **Modelo Prisma**: `RemoteCheckin`
- **Migration**: `20260705000000_sprint52_gap_closure` (campos de ordenação offline)
- **Teste Correspondente**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: IndexedDB no navegador.
- **Observação**: O `payloadHash` serve apenas como integridade física simples, não substituindo assinaturas assimétricas.

### 5. Importador Inteligente V1
- **Arquivo Principal**: [employees.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/employees.ts)
- **Rota Principal**: `POST /api/employees/batch-validate` e `POST /api/employees/batch-import`
- **Modelo Prisma**: `Employee`
- **Migration**: N/A
- **Teste Correspondente**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Observação**: Processado de forma atômica (All-or-Nothing) dentro de transação Prisma.

### 6. Portal do Colaborador V1
- **Arquivo Principal**: [employee-portal.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/employee-portal.ts) (Backend), [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employee-portal/page.tsx) (Frontend)
- **Rota Principal**: `GET /api/employee-portal/me`
- **Modelo Prisma**: `Employee`, `HourBankBalance`, `LeaveRequest`
- **Migration**: N/A
- **Teste Correspondente**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Observação**: Acesso estritamente restrito por e-mail derivado do token JWT para evitar IDOR.

### 7. Leave Requests & AbsenceRecord
- **Arquivo Principal**: [leaves.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/leaves.ts)
- **Rota Principal**: `POST /api/leaves/:id/approve`
- **Modelo Prisma**: `LeaveRequest`, `AbsenceRecord`
- **Migration**: `20260705000000_sprint52_gap_closure`
- **Teste Correspondente**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Observação**: A aprovação é idempotente no nível do banco via índice exclusivo em `leaveRequestId`.

### 8. Hour Bank (Banco de Horas)
- **Arquivo Principal**: [hour-bank.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/hour-bank.ts)
- **Rota Principal**: `POST /api/hour-bank/:employeeId/transactions`
- **Modelo Prisma**: `HourBankTransaction`, `HourBankBalance`
- **Migration**: `20260705000000_sprint52_gap_closure`
- **Teste Correspondente**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Observação**: Exige a relação invariante `previousBalance + delta = resultingBalance`.

### 9. Radar SSE
- **Arquivo Principal**: [presence.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/presence.ts)
- **Rota Principal**: `GET /api/presence/live-feed`
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Teste Correspondente**: N/A (Falta teste estrito de ciclo de vida)
- **Dependência Externa**: Suporte SSE no HTTP Client.
- **Observação**: Feed de eventos em tempo real com isolamento completo por Tenant.

### 10. Web Push
- **Arquivo Principal**: [web-push-sender.service.ts](file:///e:/RHFLOW/rhflow/backend/src/services/web-push-sender.service.ts), [notifications.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/notifications.ts)
- **Rota Principal**: `POST /api/notifications/web-push/subscribe`
- **Modelo Prisma**: `WebPushSubscription`
- **Migration**: `20260704020000_add_webpush_hourbank_leaverequest`
- **Teste Correspondente**: N/A
- **Dependência Externa**: Web Push gateway (Google FCM, Apple Push Services, etc.)
- **Observação**: Canal de push ativo. Em caso de 404/410, a inscrição é excluída do banco.

### 11. Correlation ID
- **Arquivo Principal**: [app.ts](file:///e:/RHFLOW/rhflow/backend/src/app.ts)
- **Rota Principal**: Filtro de todos os endpoints HTTP.
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Teste Correspondente**: N/A
- **Dependência Externa**: Nenhuma
- **Observação**: Propaga `x-request-id` e `x-correlation-id` em logs de transação HTTP.

### 12. Structured Logging
- **Arquivo Principal**: [app.ts](file:///e:/RHFLOW/rhflow/backend/src/app.ts) (helpers `sanitizeMetadata`, `sanitizeString`)
- **Rota Principal**: Hooks onRequest e onResponse.
- **Modelo Prisma**: `OperationalErrorLog`
- **Migration**: N/A
- **Teste Correspondente**: N/A
- **Dependência Externa**: Logger Pino
- **Observação**: Higieniza metadados sensíveis antes de logar ou persistir no banco de logs operacionais.

### 13. Readiness & Liveness
- **Arquivo Principal**: [health.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/health.ts)
- **Rota Principal**: `GET /api/health/live` e `GET /api/health/ready`
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Teste Correspondente**: N/A
- **Dependência Externa**: PostgreSQL, Redis
- **Observação**: Liveness apenas responde OK; Readiness verifica conectividade do banco de dados e do Redis.

### 14. Job Locking
- **Arquivo Principal**: [job-lock.ts](file:///e:/RHFLOW/rhflow/backend/src/lib/job-lock.ts)
- **Rota Principal**: Chamado internamente por endpoints de `/internal/jobs/*`
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Teste Correspondente**: N/A
- **Dependência Externa**: Redis
- **Observação**: Evita execuções paralelas concorrentes em arquitetura de múltiplos nós de aplicação.
