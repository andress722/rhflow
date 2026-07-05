# Calendar Integration Maturity Matrix

Esta documentação detalha a maturidade real de integração de calendário (Google Calendar e Microsoft Graph) do PresençaFlow RH.

---

## 1. Matriz de Maturidade

| Requisito | Google Calendar | Microsoft Graph | Status de Maturidade | Observação |
| :--- | :--- | :--- | :--- | :--- |
| **OAuth Initiation** | IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Geração de URL de autorização padrão. |
| **State Validation** | IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Evita ataques de CSRF (OAuth State). |
| **Callback Handler** | IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Troca authorization code por access/refresh tokens. |
| **Access/Refresh Token Storage**| IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Salva no banco vinculando ao companyId/tenant. |
| **ExpiresAt & Refresh Automático**| IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Disparado antes de expirar baseado em timestamp. |
| **Disconnect / Revoke** | IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Remove tokens e configurações do banco. |
| **Create Event** | IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Cria evento de afastamento. |
| **Update Event** | IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Atualiza datas de afastamento. |
| **Delete Event** | IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Remove evento do calendário. |
| **Retry & Tolerância a Falha** | IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Lida com 429 e 500 temporários via retries exponenciais. |
| **Idempotency** | IMPLEMENTED | IMPLEMENTED | TESTED_WITH_MOCK | Evita criação de eventos duplicados. |
| **Homologação Externa** | NEEDS_HOMOLOGATION | NEEDS_HOMOLOGATION | NEEDS_HOMOLOGATION | Depende de chaves de API e consentimento de produção. |

---

## 2. Acoplamento de Domínio (LeaveRequest Workflow)
- **Tolerância a Falhas**: A sincronização com as APIs de calendário externa é executada de forma **assíncrona** (`fire-and-forget`) após a conclusão da transação de aprovação no banco de dados. Isso garante que instabilidades do Google ou da Microsoft nunca impeçam a aprovação de uma solicitação de afastamento no domínio principal.
- **Isolamento de Tenants**: Toda chamada utiliza as credenciais recuperadas do banco de dados filtradas pelo ID da empresa (`companyId`) do usuário autenticado.

---

## 3. Guia de Homologação em Produção
Como credenciais reais não são armazenadas no código-fonte, o produto está marcado como `NEEDS_HOMOLOGATION`.

### Variáveis de Ambiente Necessárias:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Obtidos no Google Cloud Console.
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`: Obtidos no Microsoft Entra Admin Center.
- `CALENDAR_REDIRECT_URI`: Endpoint público de callback (`https://seuapp.com/api/calendar/callback`).

### Procedimento Manual de Homologação:
1. Cadastrar a aplicação nos respectivos painéis de desenvolvedor.
2. Inserir as credenciais nas variáveis de ambiente de staging/produção.
3. Acessar `/app/settings/integrations` como administrador e clicar em "Conectar Calendário".
4. Efetuar login e consentimento.
5. Criar e aprovar um afastamento de teste para validar o disparo em background.
