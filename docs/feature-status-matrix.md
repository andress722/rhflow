# Feature Status Matrix - Consolidated Audit Report

Esta matriz fornece o mapeamento consolidado e auditado do estado de todas as 20 principais funcionalidades do PresençaFlow RH para o encerramento das Sprints 52, 52.1 e 52.2.

## Matriz de Status

| Feature | Backend | Frontend | Persistência | Tenant Isolation | Testes | Integração Externa | Evidência | Status Final |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Workforce Risk Signals** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | `WorkforceRiskSignalsService` com pesos heurísticos. | COMPLETE |
| **Rota deprecated /turnover-risk** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Rota alias que delega para o novo serviço e remapeia propriedades. | DEPRECATED |
| **Employee Portal V1** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Filtro estrito baseado no e-mail do JWT em `employee-portal.ts`. | COMPLETE |
| **Google Calendar Integration** | FOUNDATION_ONLY | NOT_IMPLEMENTED | FOUNDATION_ONLY | COMPLETE | TESTED_WITH_MOCK | NEEDS_HOMOLOGATION | `CalendarSyncService` assíncrono com mock de fallback. | NEEDS_HOMOLOGATION |
| **Microsoft Calendar Integration** | FOUNDATION_ONLY | NOT_IMPLEMENTED | FOUNDATION_ONLY | COMPLETE | TESTED_WITH_MOCK | NEEDS_HOMOLOGATION | `CalendarSyncService` assíncrono com mock de fallback. | NEEDS_HOMOLOGATION |
| **PWA Shell** | NOT_APPLICABLE | COMPLETE | NOT_APPLICABLE | COMPLETE | NOT_IMPLEMENTED | NOT_APPLICABLE | Service Worker com caching de estáticos em `frontend/src/app/layout.tsx`. | COMPLETE |
| **Offline Business Operation** | COMPLETE | PARTIAL | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Fila IndexedDB `offline-db.ts` ativa apenas no simulador de check-in. | PARTIAL |
| **Importador Inteligente V1 CSV** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Validação de MIME, extensão e `escapeCsv` contra Formula Injection. | COMPLETE |
| **Importador Inteligente V1 XLSX** | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_APPLICABLE | NOT_IMPLEMENTED | NOT_APPLICABLE | Sem suporte a arquivos XLSX no backend. | NOT_IMPLEMENTED |
| **Leave Requests** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Controle transacional idempotente em `leaves.ts`. | COMPLETE |
| **AbsenceRecord** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Constraint única em banco de dados e validações atômicas de abono. | COMPLETE |
| **Hour Bank** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Invariante matemática de saldo e lock pessimista `FOR UPDATE` no banco. | COMPLETE |
| **Radar SSE** | COMPLETE | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | NOT_APPLICABLE | Try-catch na escrita raw e listeners cleanup no disconnect em `presence.ts`. | COMPLETE |
| **Web Push** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NEEDS_HOMOLOGATION | Sincronização e deleção automática de tokens expirados sob erros 404/410. | NEEDS_HOMOLOGATION |
| **Correlation ID** | COMPLETE | NOT_APPLICABLE | NOT_APPLICABLE | COMPLETE | COMPLETE | NOT_APPLICABLE | Middleware global com cabeçalhos `x-request-id` e `x-correlation-id`. | COMPLETE |
| **Structured Logging** | COMPLETE | NOT_APPLICABLE | NOT_APPLICABLE | COMPLETE | COMPLETE | NOT_APPLICABLE | Geração de `OperationalErrorLog` e logs via Pino. | COMPLETE |
| **PII/Secret Redaction** | COMPLETE | NOT_APPLICABLE | NOT_APPLICABLE | COMPLETE | COMPLETE | NOT_APPLICABLE | Redação de 19 chaves sensíveis em `pii-redactor.ts` integrada ao logger. | COMPLETE |
| **Health Liveness** | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Rota `/api/health/live` estática sem acoplamento a banco ou Redis. | COMPLETE |
| **Health Readiness** | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Rota `/api/health/ready` com pings rápidos e timeout curto para DB/Redis. | COMPLETE |
| **Job Locking** | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Trava com token UUID de propriedade e liberação via script Lua no Redis. | COMPLETE |
| **Notification Engine (Sprint 54)** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NEEDS_HOMOLOGATION | Motor de escalonamento evento-driven com 8 eventos ACTIVE, policy builder, quiet hours, dedup/idempotência tenant-safe. | NEEDS_HOMOLOGATION |
| **Importador Corporativo V2 (CSV)** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Upload assíncrono com delimitadores auto e fila Redis. | COMPLETE |
| **Importador Corporativo V2 (XLSX)** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Parser SheetJS com suporte a worksheets e fórmulas ignoradas. | COMPLETE |
| **Templates de Mapeamento** | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | NOT_APPLICABLE | Persistência de templates JSON por empresa com controle tenant-safe. | COMPLETE |
| **Auto-Mapping Heurístico** | COMPLETE | COMPLETE | NOT_APPLICABLE | COMPLETE | COMPLETE | NOT_APPLICABLE | Normalização de acentos e aliases de propriedades corporativas. | COMPLETE |

---

## Detalhes de Implementação e Evidências por Feature

### 1. Workforce Risk Signals & Rota deprecated /turnover-risk
- **Serviço**: [workforce-risk-signals.service.ts](file:///e:/RHFLOW/rhflow/backend/src/services/workforce-risk-signals.service.ts)
- **Rotas**: `GET /api/employees/:id/workforce-risk-signals` e a legada `GET /api/employees/:id/turnover-risk` (que atua como alias com `@deprecated`).
- **Lógica**: Cálculo determinístico ponderado por heurísticas e regras de negócios com aviso de responsabilidade (disclaimer).
- **Testes**: `tests/sprint52.test.ts` (verifica estrutura heurística e resposta das duas rotas).

### 2. Employee Portal V1
- **Rotas**: `/api/employee-portal/me`, `/api/employee-portal/timesheet`, `/api/employee-portal/hour-bank`, `/api/employee-portal/leaves` em [employee-portal.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/employee-portal.ts).
- **Tenant Isolation**: Segurança integrada no JWT. Os e-mails são comparados diretamente com o registro do funcionário no respectivo `companyId`.
- **Testes**: IDOR, cross-tenant e parameter tampering validados com sucesso no arquivo `tests/sprint52.test.ts`.

### 3. Google e Microsoft Calendar Integration
- **Serviço**: [calendar-sync.service.ts](file:///e:/RHFLOW/rhflow/backend/src/services/calendar-sync.service.ts)
- **Testes**: Cobertura por Mock nos testes unitários e de integração de serviços.
- **Pendência**: `NEEDS_HOMOLOGATION` e `CREDENTIAL_PENDING` (ver detalhes no inventário de pendências).

### 4. PWA Shell e Offline Business Operation
- **IndexedDB Queue**: Localizada em [offline-db.ts](file:///e:/RHFLOW/rhflow/frontend/src/lib/offline-db.ts).
- **Limitação**: A operação de fila IndexedDB offline é utilizada **apenas no simulador** de batida de ponto no frontend. Na produção, o fluxo é gerido via webhooks assíncronos de parceiros de WhatsApp. Por isso, a feature offline operacional é classificada como `PARTIAL` e a decisão sobre promoção para canal oficial está pendente (`BUSINESS_DECISION_PENDING`).

### 5. Importador Inteligente V1
- **Suporte CSV**: Totalmente implementado com sanitização de cabeçalhos, validação de tipos MIME (`text/csv`), extensão `.csv` e escape de fórmulas Excel/CSV contra injeções.
- **Suporte XLSX**: Classificado como `NOT_IMPLEMENTED` (Residual `CODE_PENDING`).
- **Atomicidade**: **ALL_OR_NOTHING** para validações preliminares de lote e **PARTIAL** para falhas de persistência após validação.

### 6. Leave Requests e AbsenceRecord
- **Lógica**: Trava de concorrência e idempotência de aprovação dupla no arquivo [leaves.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/leaves.ts).
- **Testes**: Corrida concorrente na aprovação garante que apenas um `AbsenceRecord` seja persistido no banco de dados (`tests/sprint52.test.ts`).

### 7. Hour Bank
- **Lógica**: Lock pessimista em banco de dados (`FOR UPDATE`) via transação Prisma e validação matemática rígida: `previousBalance + delta = resultingBalance` em [hour-bank.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/hour-bank.ts).
- **Testes**: Proteção contra Lost Update sob cargas concorrentes.

### 8. Radar SSE
- **Endpoint**: `GET /api/presence/live-feed` em [presence.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/presence.ts).
- **Segurança**: Tratamento rigoroso de disconnects abruptos para evitar leaks de listeners em Redis/event emitters e loop de reconexão infinito.

### 9. Web Push
- **Gateway Web Push**: Em caso de erros fatais do gateway como `404 (Not Found)` ou `410 (Gone)`, a subscrição correspondente é permanentemente excluída do banco.
- **Testes**: Validação do fluxo de revogação de tokens e erros de envio simulados no arquivo `tests/sprint52.test.ts`.

### 10. Correlation ID, Structured Logging e PII/Secret Redaction
- **Log Redactor**: Mapeia e higieniza todas as 19 chaves sensíveis (incluindo dados médicos, biométricos e tokens) em `pii-redactor.ts`.
- **Trânsito**: Middleware injeta e rastreia o ciclo de vida via cabeçalhos de requisição e correlation context.

### 11. Health (Liveness e Readiness)
- **Live**: Endpoint rápido `/health/live` para verificação de liveness de container sem forçar consultas de banco de dados.
- **Ready**: Endpoint `/health/ready` executa queries simples e pings de Redis com timeout controlado de 2s para indicar prontidão técnica.

### 12. Job Locking
- **Lock**: Mecanismo que gera tokens baseados em UUID e executa exclusões atômicas via script Lua no Redis para evitar que workers lentos interfiram em locks renovados.

### 13. Importador Corporativo V2 & Mapping Templates (Sprint 53)
- **Serviço**: [import-job.service.ts](file:///e:/RHFLOW/rhflow/backend/src/services/import-job.service.ts)
- **Rotas**: `POST /api/import-jobs/upload`, `PUT /api/import-jobs/:jobId/mapping`, `POST /api/import-jobs/:jobId/confirm`, `GET /api/import-jobs/:jobId/progress` e CRUD de templates em [import-mapping-templates.ts](file:///e:/RHFLOW/rhflow/backend/src/routes/import-mapping-templates.ts).
- **Segurança**: Validação por Magic Bytes PK Zip para XLSX, limites estritos de 5000 linhas, escape contra injeção de fórmulas e isolamento multitenant rígido.
- **Testes**: Suíte dedicada `tests/sprint53-import.test.ts` cobrindo todas as 11 categorias de validação e concorrência com 100% de aproveitamento.

