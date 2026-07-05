# Calendar Integration Maturity & Status Report

Esta documentação detalha a maturidade real de integração de calendário (Google Calendar e Microsoft Graph) do PresençaFlow RH.

---

## 1. Google Calendar Integration Status

A integração com o Google Calendar foi implementada usando OAuth2 padrão do Google e Calendar API v3. 

| Item | Status | Observações / Evidências |
| :--- | :--- | :--- |
| **OAuth initiation** | IMPLEMENTED | Rota `/api/calendar/oauth/google/start` gera a URL de autorização. |
| **state validation** | IMPLEMENTED | Validação via Redis (`calendar_oauth_state:`) com expiração de 10 minutos contra CSRF. |
| **callback** | IMPLEMENTED | Rota `/api/calendar/oauth/google/callback` realiza a troca do Authorization Code. |
| **access token** | IMPLEMENTED | Persistido e criptografado na tabela `CalendarIntegration`. |
| **refresh token** | IMPLEMENTED | Obtido via parâmetro `access_type=offline` e persistido em banco de dados. |
| **expiresAt** | IMPLEMENTED | Armazenado no banco de dados para controlar a expiração de 3600 segundos. |
| **automatic refresh**| IMPLEMENTED | Função `refreshIfNeeded` executa a renovação automática caso o token expire nos próximos 5 minutos. |
| **revoke** | IMPLEMENTED | Chamada ao endpoint `https://oauth2.googleapis.com/revoke` ao desconectar o calendário. |
| **disconnect** | IMPLEMENTED | Rota `/api/calendar/disconnect` desativa a integração no banco de dados. |
| **create event** | IMPLEMENTED | Evento criado na agenda `primary` sob aprovação de `LeaveRequest`. |
| **update event** | IMPLEMENTED | Método `updateCalendarEvent` com `PATCH` atualiza eventos de afastamento alterados. |
| **delete event** | IMPLEMENTED | Método `deleteCalendarEvent` com `DELETE` remove eventos ao cancelar afastamentos. |
| **retry** | IMPLEMENTED | Retentativa em background com delay exponencial para erros de servidor (429/500). |
| **idempotency** | IMPLEMENTED | Proteção em `syncLeaveEvent` via verificação de `externalCalendarEventId` existente. |
| **external homologation** | NEEDS_HOMOLOGATION | Depende de credenciais reais do projeto do cliente no Google Developer Console. |

---

## 2. Microsoft Calendar Integration Status

A integração com o Microsoft Graph foi implementada usando Microsoft Identity Platform e Graph API v1.0.

| Item | Status | Observações / Evidências |
| :--- | :--- | :--- |
| **OAuth initiation** | IMPLEMENTED | Rota `/api/calendar/oauth/microsoft/start` gera a URL de autorização. |
| **state validation** | IMPLEMENTED | Armazenamento e validação no Redis com expiração segura de 10 minutos. |
| **callback** | IMPLEMENTED | Rota `/api/calendar/oauth/microsoft/callback` realiza a troca do Authorization Code. |
| **access token** | IMPLEMENTED | Armazenado na tabela `CalendarIntegration`. |
| **refresh token** | IMPLEMENTED | Solicitado através do escopo `offline_access` e persistido localmente. |
| **expiresAt** | IMPLEMENTED | Registrado no banco de dados para controle de expiração. |
| **automatic refresh**| IMPLEMENTED | Função `refreshIfNeeded` renova o token via Microsoft login endpoint. |
| **revoke** | TESTED_WITH_MOCK | Revogação lógica e deativação de credenciais no banco local. |
| **disconnect** | IMPLEMENTED | Rota `/api/calendar/disconnect` desativa a integração localmente. |
| **create event** | IMPLEMENTED | Criado via endpoint `/me/calendar/events` do Microsoft Graph. |
| **update event** | IMPLEMENTED | Chamada `PATCH` para atualizar evento de afastamento. |
| **delete event** | IMPLEMENTED | Chamada `DELETE` para remover evento de afastamento cancelado. |
| **Microsoft Graph** | IMPLEMENTED | Utiliza endpoints da v1.0 do Microsoft Graph API. |
| **subscriptions** | NOT_IMPLEMENTED | Não há suporte para webhooks de recebimento de atualizações da Microsoft. |
| **subscription renewal**| NOT_IMPLEMENTED | Sem renovação automática de webhooks do Microsoft Graph. |
| **retry** | IMPLEMENTED | Retentativa automática para erros transient (429/500). |
| **idempotency** | IMPLEMENTED | Travas em banco para evitar duplicações de sincronização. |
| **external homologation** | NEEDS_HOMOLOGATION | Depende de credenciais reais e aprovação no Microsoft Entra Admin Center. |

---

## 3. Classificações de Conformidade Utilizadas

1. **NEEDS_HOMOLOGATION**: O código está totalmente pronto e foi validado em ambiente simulado/mock, mas depende de credenciais e consentimento final do cliente em produção.
2. **NOT_IMPLEMENTED**: Funcionalidades que não fazem parte do escopo técnico acordado das sprints (Ex: webhooks reversos de calendário da Microsoft).
