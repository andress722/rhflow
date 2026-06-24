# Notificações Comerciais Externas — PresençaFlow CRM

Este manual detalha o funcionamento, configuração e diagnóstico do sistema de alertas comerciais externos da plataforma PresençaFlow.

---

## 🚀 Variáveis de Ambiente (Envs)

As seguintes variáveis controlam as notificações comerciais e são definidas no arquivo `.env` do backend:

| Variável | Tipo | Valor Exemplo / Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `ENABLE_COMMERCIAL_EMAIL_ALERTS` | Boolean | `true` ou `false` (padrão) | Habilita/desabilita envio de alertas por e-mail (simulados em dev). |
| `ENABLE_COMMERCIAL_WHATSAPP_ALERTS` | Boolean | `true` ou `false` (padrão) | Habilita/desabilita envio de alertas reais via WhatsApp. |
| `COMMERCIAL_ALERT_EMAILS` | String | `admin@flow.com,comercial@flow.com` | Lista de destinatários de e-mail (separados por vírgula). |
| `COMMERCIAL_ALERT_WHATSAPP_NUMBERS` | String | `5511999999999,5511888888888` | Lista de números de WhatsApp normalizados (com DDI e DDD). |
| `COMMERCIAL_DAILY_SUMMARY_TIME` | String | `18:00` (HH:mm) | Horário local de Brasília (America/Sao_Paulo) para o envio do resumo diário. |

### Regras de Validação:
- Se `ENABLE_COMMERCIAL_EMAIL_ALERTS` for `true`, `COMMERCIAL_ALERT_EMAILS` deve conter pelo menos 1 e-mail válido.
- Se `ENABLE_COMMERCIAL_WHATSAPP_ALERTS` for `true`, `COMMERCIAL_ALERT_WHATSAPP_NUMBERS` deve conter pelo menos 1 número normalizado (mínimo de 8 caracteres numéricos).

---

## 📧 Configuração de E-mail comercial

Nesta sprint, o canal de e-mail comercial é executado no modo **SIMULADO** (best-effort).
- Os e-mails disparados são gravados de forma estruturada nos logs do Fastify.
- Para proteger a privacidade dos operadores comerciais, os endereços de e-mail e telefones são **mascarados nos logs** (ex: `a***n@test.com` ou `5511****9999`).

---

## 💬 Configuração de WhatsApp comercial

### Regras de Uso do Canal:
> [!IMPORTANT]
> Os leads capturados pertencem à plataforma global e não a uma empresa/tenant específica. **Nunca use a conexão de WhatsApp de um cliente/tenant para disparar alertas comerciais da plataforma.**
> Os disparos utilizam a infraestrutura global da plataforma (ou simulação local caso nenhum provedor global esteja ativo).

---

## ⚡ Fluxo de Alertas

### 1. Alerta de Novo Lead (`NEW_LEAD`)
- **Gatilho**: Disparado imediatamente após a criação de um lead no endpoint público `POST /api/public/pilot-leads`.
- **Filtros**:
  - Se o lead cair na validação do **Honeypot** (campo `websiteUrl` preenchido), o alerta é silenciosamente ignorado.
  - Se o lead for detectado como **duplicado recente** (mesmo e-mail cadastrado nos últimos 7 dias), o alerta é silenciosamente ignorado.
- **Resiliência (Best-effort)**: O disparo é assíncrono. Qualquer falha no envio do alerta comercial **não quebra** a criação do lead no banco e **não expõe** erros internos/secrets na resposta da API pública.

### 2. Rotinas Diárias via Job (`OVERDUE_FOLLOW_UPS`, `DEMOS_TODAY`, `STALE_QUALIFIED_LEADS`, `DAILY_SUMMARY`)
- **Gatilho**: Execução periódica (cron) no endpoint `/api/internal/jobs/commercial-alerts/run`.
- **Tipos de Alerta**:
  - `OVERDUE_FOLLOW_UPS`: Notifica se houver algum lead com `nextFollowUpAt` vencido.
  - `DEMOS_TODAY`: Notifica se houver demonstrações comerciais agendadas para o dia atual em São Paulo.
  - `STALE_QUALIFIED_LEADS`: Alerta sobre leads no status `QUALIFIED` que estão sem nenhuma atividade/interação nos últimos 7 dias.
  - `DAILY_SUMMARY`: Resumo compilado das métricas de hoje, enviado apenas se a hora local de São Paulo for superior ou igual a `COMMERCIAL_DAILY_SUMMARY_TIME`.

---

## 🛡️ Idempotência e Bloqueio de Spam via AuditLog

Para evitar múltiplos disparos indesejados (spam) dos mesmos alertas comerciais no mesmo dia, o sistema implementa um controle de idempotência persistente baseado na tabela `AuditLog`:

1. Cada alerta enviado gera um registro na tabela `AuditLog` com a ação `COMMERCIAL_ALERT_SENT`.
2. Os dados de destinatários são mascarados antes de persistir no banco.
3. Chaves de Idempotência:
   - **`NEW_LEAD`**: Bloqueio baseado no par `leadId + channel`. Garante que o mesmo lead nunca gere mais de um alerta por canal.
   - **Alertas do Job (`OVERDUE_FOLLOW_UPS`, `DEMOS_TODAY`, `STALE_QUALIFIED_LEADS`, `DAILY_SUMMARY`)**: Bloqueio baseado em `date (YYYY-MM-DD em America/Sao_Paulo) + alertType + channel`. Isso garante que as rotinas periódicas rodem várias vezes ao dia sem duplicar o envio do alerta diário aos administradores.
   - **`TEST`**: Os disparos de teste de SUPER_ADMIN **nunca** barram alertas reais e **nunca** são barrados pelo controle de idempotência.

---

## 🛠️ Como Executar o Job Manualmente

O endpoint do job é protegido por token de infraestrutura. Para acioná-lo manualmente via terminal (cURL):

```bash
curl -X POST https://api.presencaflow.com.br/api/internal/jobs/commercial-alerts/run \
  -H "x-internal-job-secret: SUA_CHAVE_FORTE_INTERNAL_JOB_SECRET" \
  -H "Content-Type: application/json"
```

### Formato de Resposta Esperado:
```json
{
  "success": true,
  "sent": [
    { "alertType": "OVERDUE_FOLLOW_UPS", "emailStatus": "simulated", "whatsappStatus": "sent" }
  ],
  "skipped": [
    { "alertType": "DEMOS_TODAY", "reason": "no_items" },
    { "alertType": "DAILY_SUMMARY", "reason": "before_summary_time" }
  ],
  "failed": []
}
```

---

## 📋 Exemplos de Mensagens

### WhatsApp: Alerta de Novo Lead
```text
*Novo Lead no PresençaFlow!*
*Nome:* João Silva
*Empresa:* ACME Corp
*E-mail:* joao@acme.com
*WhatsApp:* 5511999999999
*Funcionários:* 45
*Dor:* Falta de controle sobre atestados e faltas

Link: https://presencaflow.com.br/app/admin/leads?search=joao%40acme.com
```

### WhatsApp: Resumo Comercial Diário
```text
*Resumo Comercial Diário — PresençaFlow CRM*
- Novos leads hoje: 3
- Follow-ups vencidos: 2
- Demonstrações hoje: 1
- Leads qualificados parados: 5
```

---

## 🔍 Solução de Problemas (Troubleshooting)

1. **Os alertas não estão chegando por WhatsApp:**
   - Verifique se a variável `ENABLE_COMMERCIAL_WHATSAPP_ALERTS` está definida como `true`.
   - Certifique-se de que os números de telefone em `COMMERCIAL_ALERT_WHATSAPP_NUMBERS` possuem o código de país (`55` para Brasil) e DDD corretos, e não contêm hifens ou parênteses.
   - Veja se a API externa do WhatsApp está conectada no painel administrativo geral.
2. **O Job roda mas não envia o Resumo Diário:**
   - O resumo só é acionado se a hora atual do servidor local (calculada em America/Sao_Paulo) for igual ou maior que a hora configurada em `COMMERCIAL_DAILY_SUMMARY_TIME` (ex: `18:00`).
   - Se o job já foi executado e enviou o resumo com sucesso hoje, a idempotência bloqueará novas tentativas até o dia seguinte.
