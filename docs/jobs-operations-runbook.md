# Runbook de Operações de Jobs e Rotinas (Sprint 30)

Este documento orienta o time de engenharia e operações de infraestrutura na gestão de tarefas em segundo plano (jobs), tratamento de erros e parametrizações de chamadas de lote.

---

## 1. Catálogo de Jobs e Frequência Recomendada

| Job Key | Nome Operacional | Frequência Esperada | Criticidade | Atraso Máximo Aceito |
|---|---|---|---|---|
| `REMOTE_CHECKIN_BATCH` | Lote de Check-ins | A cada 10 min | Alta | 20 min |
| `MARK_NOT_RESPONDED` | Expirar Check-ins | A cada 30 min | Média | 60 min |
| `DAILY_CLOSING_SUMMARY` | Fechamento Diário | Diariamente (22h) | Alta | 1440 min (24h) |
| `CLEANUP_OLD_LOGS` | Limpeza de Logs | Semanalmente | Baixa | 11520 min (7 dias) |
| `COMMERCIAL_ALERTS` | Alertas Comerciais | Diariamente (8h) | Média | 1500 min |
| `RETENTION_ALERTS` | Alertas de Retenção | Diariamente (9h) | Alta | 1500 min |
| `INTERNAL_PING` | Ping de Monitoramento | A cada 5 min | Baixa | 10 min |

---

## 2. Configurando Agendadores Externos (Cron/Cloud Scheduler)

Os jobs são expostos em endpoints HTTPS internos sob o prefixo `/api/internal/jobs/*`.

Para rodar em produção:
1. Cadastre um agendador na infraestrutura (ex: Linux Crontab, AWS EventBridge ou Google Cloud Scheduler).
2. Configure requisições HTTPS do tipo `POST` direcionadas à URL do job correspondente.
3. Adicione obrigatoriamente o cabeçalho HTTP de segurança:
   - `x-internal-job-secret: [VALOR_DA_ENV_INTERNAL_JOB_SECRET]`

### Exemplo de comando no Linux Crontab:
```bash
*/10 * * * * curl -X POST -H "x-internal-job-secret: my-prod-secret-token" https://api.presencaflow.com.br/api/internal/jobs/remote-checkin-batch > /dev/null 2>&1
```

---

## 3. Guia de Diagnóstico de Falhas e Alertas de Atraso (Overdue)

### Job classificado como `FAILED`
- **Ação:** Acesse o Command Center ou vá diretamente em **Rotinas e Jobs** (`/app/admin/jobs`), localize o job e clique em **Ver Histórico**. Inspecione o `errorMessage` da execução com falha (ex: falhas de conexão de rede ou erros na API do WhatsApp).

### Job classificado como `OVERDUE` (Atrasado)
- Um job entra em atraso caso o tempo decorrido desde a última execução bem-sucedida ultrapasse a janela máxima configurada.
- **Causas Comuns:**
  1. O cronjob externo de agendamento parou de disparar.
  2. O segredo `x-internal-job-secret` foi rotacionado mas o agendador externo não foi atualizado (gerando erros 401).
- **Ação:** Verifique os logs do agendador externo para testar a comunicação HTTPS e a validade da chave secreta.

---

## 4. Execução Manual Controlada

Jobs seguros podem ser executados a qualquer momento pelo `SUPER_ADMIN` na interface web:
- `COMMERCIAL_ALERTS` (Alertas de CRM)
- `RETENTION_ALERTS` (Alertas de Churn/Inadimplência)
- `INTERNAL_PING` (Checagem de atividade)
- `CLEANUP_OLD_LOGS` (Limpeza de logs antigos)

> [!CAUTION]
> **Jobs Operacionais Bloqueados:**
> Jobs como `REMOTE_CHECKIN_BATCH` (envio de check-ins) e `DAILY_CLOSING_SUMMARY` são sensíveis e **não podem ser executados de forma aleatória** para evitar múltiplos disparos indesejados aos funcionários dos clientes.
