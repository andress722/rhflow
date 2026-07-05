# Feature Status Matrix - Sprint 52.2

Esta matriz fornece o mapeamento do estado atual de todas as 18 principais funcionalidades do PresençaFlow RH.

## Matriz de Status

| Feature | Backend | Frontend | Persistência | Tenant Isolation | Testes | Integração Externa | Status Inicial | Gap | Evidência | Status Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Employee Portal V1** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | Faltavam testes contra IDOR e Parameter Tampering. | Proteção por e-mail derivado do JWT em `employee-portal.ts`. | COMPLETE |
| **Workforce Risk Signals** | COMPLETE | PARTIAL | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | Rota antiga semântica e pesos com terminologia incorreta. | `WorkforceRiskSignalsService` com pesos heurísticos. | COMPLETE |
| **Calendar Google** | FOUNDATION_ONLY | NOT_IMPLEMENTED | FOUNDATION_ONLY | COMPLETE | PARTIAL | NEEDS_HOMOLOGATION | NEEDS_HOMOLOGATION | Sem credenciais de produção reais. | `CalendarSyncService` assíncrono com mock de fallback. | NEEDS_HOMOLOGATION |
| **Calendar Microsoft** | FOUNDATION_ONLY | NOT_IMPLEMENTED | FOUNDATION_ONLY | COMPLETE | PARTIAL | NEEDS_HOMOLOGATION | NEEDS_HOMOLOGATION | Sem credenciais de produção reais. | `CalendarSyncService` assíncrono com mock de fallback. | NEEDS_HOMOLOGATION |
| **PWA Shell** | NOT_APPLICABLE | COMPLETE | NOT_APPLICABLE | COMPLETE | NOT_IMPLEMENTED | NOT_APPLICABLE | COMPLETE | Casca visual offline. | Service Worker com caching de estáticos. | COMPLETE |
| **Offline Business Operation** | COMPLETE | PARTIAL | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | Fila IndexedDB só no simulador de check-in. | `offline-db.ts` no simulador de check-in. | PARTIAL |
| **Importador Inteligente V1** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | Faltava validação de MIME, extensões e formula injection. | `employees/import` atômico com validações. | COMPLETE |
| **Leave Requests** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | COMPLETE | Faltava teste de concorrência dupla. | Idempotência e teste concorrente em `sprint52.test.ts`. | COMPLETE |
| **AbsenceRecord** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | COMPLETE | Vinculado a LeaveRequest, mas sem teste de concorrência. | Relação de chave única e validações atômicas. | COMPLETE |
| **Hour Bank** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | Faltavam travas de concorrência e invariante matemática. | Invariante matemática de saldo e `FOR UPDATE` lock. | COMPLETE |
| **Radar SSE** | COMPLETE | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | SSE sem try-catch ou cleanup no disconnect do cliente. | Monitoramento de erro e remoção de listeners em `presence.ts`. | COMPLETE |
| **Web Push** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NEEDS_HOMOLOGATION | NEEDS_HOMOLOGATION | Sem deleção automática em erros 404/410. | Deleção em falhas 404/410 em `WebPushSenderService`. | NEEDS_HOMOLOGATION |
| **Correlation ID** | COMPLETE | NOT_APPLICABLE | NOT_APPLICABLE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | Implementação básica sem testes de propagação. | Propagação em logs e cabeçalhos em `app.ts`. | COMPLETE |
| **Structured Logging** | COMPLETE | NOT_APPLICABLE | NOT_APPLICABLE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | Redação PII básica incompleta sem testes centralizados. | Filtro centralizado `pii-redactor.ts`. | COMPLETE |
| **Secret/PII Redaction** | COMPLETE | NOT_APPLICABLE | NOT_APPLICABLE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | Sem testes para todos os 19 campos. | `redactPII` com teste de 19 campos em `sprint52.test.ts`. | COMPLETE |
| **Health Liveness** | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | COMPLETE | Endpoint respondia OK sem testar processo isoladamente. | `health/live` estático sem travar em DB/Redis. | COMPLETE |
| **Health Readiness** | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | COMPLETE | Falta de verificação de latência e degradação de DB/Redis. | `health/ready` com pings de curto timeout. | COMPLETE |
| **Job Locking** | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | PARTIAL | Lock sem UUID de ownership ou Lua script atômico. | `JobLock` com set NX PX e Lua Script no release. | COMPLETE |

---

## Evidências por Feature

### 1. Employee Portal V1
- **Arquivo Principal**: [employee-portal.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/employee-portal.ts)
- **Rota**: `GET /api/employee-portal/me`, `GET /api/employee-portal/timesheet`, `GET /api/employee-portal/hour-bank`, `GET /api/employee-portal/leaves`
- **Service**: N/A
- **Modelo Prisma**: `Employee`, `HourBankBalance`, `LeaveRequest`
- **Migration**: N/A
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employee-portal/page.tsx)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Acesso restrito apenas para usuários cujos e-mails de cadastro sejam idênticos ao do cadastro de Funcionário.

### 2. Workforce Risk Signals
- **Arquivo Principal**: [employees.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/employees.ts)
- **Rota**: `GET /api/employees/:id/workforce-risk-signals`
- **Service**: `WorkforceRiskSignalsService`
- **Modelo Prisma**: `Employee` (turnoverRiskScore)
- **Migration**: N/A
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employees/page.tsx)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Cálculo puramente determinístico heurístico baseado em atrasos, faltas e pesquisas de clima manuais, não utilizando modelos de IA.

### 3. Calendar Google
- **Arquivo Principal**: [calendar-sync.service.ts](file:///e:/RHFLOW/rhflow/backend/src/services/calendar-sync.service.ts)
- **Rota**: `POST /api/calendar/configure`
- **Service**: `CalendarSyncService`
- **Modelo Prisma**: `CalendarConfiguration`
- **Migration**: `20260704020000_add_webpush_hourbank_leaverequest`
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employee-portal/page.tsx)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Google Calendar OAuth/APIs
- **Limitação Conhecida**: Requer homologação de chaves reais de cliente em ambiente de produção (NEEDS_HOMOLOGATION).

### 4. Calendar Microsoft
- **Arquivo Principal**: [calendar-sync.service.ts](file:///e:/RHFLOW/rhflow/backend/src/services/calendar-sync.service.ts)
- **Rota**: `POST /api/calendar/configure`
- **Service**: `CalendarSyncService`
- **Modelo Prisma**: `CalendarConfiguration`
- **Migration**: `20260704020000_add_webpush_hourbank_leaverequest`
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employee-portal/page.tsx)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Microsoft Graph APIs
- **Limitação Conhecida**: Requer homologação de chaves reais de cliente em ambiente de produção (NEEDS_HOMOLOGATION).

### 5. PWA Shell
- **Arquivo Principal**: `frontend/public/manifest.json`
- **Rota**: N/A
- **Service**: N/A
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Frontend**: `frontend/src/app/layout.tsx`
- **Teste**: N/A (validado via navegador)
- **Dependência Externa**: Navegadores com suporte a Service Worker
- **Limitação Conhecida**: Carrega assets offline, mas depende de re-estabelecimento de rede para sincronizar dados transacionais.

### 6. Offline Business Operation
- **Arquivo Principal**: [offline-db.ts](file:///e:/RHFLOW/rhflow/frontend/src/lib/offline-db.ts)
- **Rota**: `POST /api/presence/:id/simulate-response` (Replay)
- **Service**: N/A
- **Modelo Prisma**: `RemoteCheckin`
- **Migration**: `20260705000000_sprint52_gap_closure`
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/presence/page.tsx) (Simulador)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: IndexedDB do navegador
- **Limitação Conhecida**: Integrado apenas no simulador do frontend (status PARTIAL), pois a presença real é processada via webhook assíncrono do WhatsApp.

### 7. Importador Inteligente V1
- **Arquivo Principal**: [employees.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/employees.ts)
- **Rota**: `POST /api/employees/import`
- **Service**: N/A
- **Modelo Prisma**: `Employee`
- **Migration**: N/A
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employees/page.tsx)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Suporta apenas arquivos no formato `.csv`, arquivos `.xlsx` não são suportados.

### 8. Leave Requests
- **Arquivo Principal**: [leaves.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/leaves.ts)
- **Rota**: `POST /api/leaves/:id/approve`
- **Service**: N/A
- **Modelo Prisma**: `LeaveRequest`
- **Migration**: N/A
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employee-portal/page.tsx)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Depende de aprovação explícita do gestor para gerar o abono no espelho de ponto.

### 9. AbsenceRecord
- **Arquivo Principal**: [leaves.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/leaves.ts)
- **Rota**: `POST /api/leaves/:id/approve`
- **Service**: N/A
- **Modelo Prisma**: `AbsenceRecord`
- **Migration**: `20260705000000_sprint52_gap_closure`
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employee-portal/page.tsx)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Relação de um para um com `LeaveRequest` via constraint exclusiva em banco de dados.

### 10. Hour Bank
- **Arquivo Principal**: [hour-bank.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/hour-bank.ts)
- **Rota**: `POST /api/hour-bank/:employeeId/transactions`
- **Service**: N/A
- **Modelo Prisma**: `HourBankTransaction`, `HourBankBalance`
- **Migration**: `20260705000000_sprint52_gap_closure`
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/employee-portal/page.tsx)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Realiza bloqueio estrito `FOR UPDATE` por colaborador para evitar race conditions.

### 11. Radar SSE
- **Arquivo Principal**: [presence.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/presence.ts)
- **Rota**: `GET /api/presence/live-feed`
- **Service**: N/A
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Frontend**: [page.tsx](file:///e:/RHFLOW/rhflow/frontend/src/app/app/dashboard/page.tsx)
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Requer keep-alive ativo no HTTP gateway do cliente (Ex: Nginx proxy buffering desativado).

### 12. Web Push
- **Arquivo Principal**: [web-push-sender.service.ts](file:///e:/RHFLOW/rhflow/backend/src/services/web-push-sender.service.ts)
- **Rota**: `POST /api/notifications/web-push/subscribe`
- **Service**: `WebPushSenderService`
- **Modelo Prisma**: `WebPushSubscription`
- **Migration**: `20260704020000_add_webpush_hourbank_leaverequest`
- **Frontend**: Layout global da aplicação
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Web Push gateways dos browsers (Google FCM / Mozilla autopush)
- **Limitação Conhecida**: Deleções automáticas de tokens expirados ocorrem assincronamente ao receber 404/410 do provider.

### 13. Correlation ID
- **Arquivo Principal**: [app.ts](file:///e:/RHFLOW/rhflow/backend/src/app.ts)
- **Rota**: Global Middleware
- **Service**: N/A
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Frontend**: N/A
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Propagado via headers `x-request-id` e `x-correlation-id`.

### 14. Structured Logging
- **Arquivo Principal**: [app.ts](file:///e:/RHFLOW/rhflow/backend/src/app.ts)
- **Rota**: Global Middleware Hooks
- **Service**: N/A
- **Modelo Prisma**: `OperationalErrorLog`
- **Migration**: N/A
- **Frontend**: N/A
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Logger Pino
- **Limitação Conhecida**: Filtra chaves sensíveis contendo dados confidenciais automaticamente antes de salvar.

### 15. Secret/PII Redaction
- **Arquivo Principal**: [pii-redactor.ts](file:///e:/RHFLOW/rhflow/backend/src/lib/pii-redactor.ts)
- **Rota**: N/A
- **Service**: N/A
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Frontend**: N/A
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Mascara CPF/PIS de forma irreversível (`***.***.***-XX`) nos logs estruturados.

### 16. Health Liveness
- **Arquivo Principal**: [health.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/health.ts)
- **Rota**: `GET /api/health/live`
- **Service**: N/A
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Frontend**: N/A
- **Teste**: `backend/tests/go-live-readiness.test.ts`
- **Dependência Externa**: Nenhuma
- **Limitação Conhecida**: Retorna status OK instantaneamente sem testar conexões com DB/Redis.

### 17. Health Readiness
- **Arquivo Principal**: [health.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/health.ts)
- **Rota**: `GET /api/health/ready`
- **Service**: N/A
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Frontend**: N/A
- **Teste**: `backend/tests/go-live-readiness.test.ts`
- **Dependência Externa**: PostgreSQL, Redis
- **Limitação Conhecida**: Realiza pings rápidos de curto timeout de conectividade.

### 18. Job Locking
- **Arquivo Principal**: [job-lock.ts](file:///e:/RHFLOW/rhflow/backend/src/lib/job-lock.ts)
- **Rota**: Chamado internamente
- **Service**: N/A
- **Modelo Prisma**: N/A
- **Migration**: N/A
- **Frontend**: N/A
- **Teste**: `backend/tests/sprint52.test.ts`
- **Dependência Externa**: Redis
- **Limitação Conhecida**: Liberação segura baseada em script Lua no Redis verificando ownership token UUID.
