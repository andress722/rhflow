# Playbook de Retenção e Prevenção de Churn (Sprint 27)

Este documento orienta os times de Customer Success (CS), Suporte e Comercial nas rotinas de monitoramento preventivo de cancelamentos e renovações no PresençaFlow RH.

---

## 1. Visão Geral

A detecção de risco de cancelamento (Churn Risk) analisa o engajamento técnico da empresa (health score) em conjunto com a adimplência financeira manual (`billingStatus`). Essa inteligência integrada permite ações proativas antes que o cliente decida cancelar ou resulte em inadimplência prolongada.

---

## 2. Como Interpretar os Níveis de Risco de Churn

O sistema calcula dinamicamente três faixas de risco:

### A. ALTO RISCO (HIGH)
*Sinalizador de atenção imediata ou resgate emergencial.*
- **Critérios de Gatilho:**
  - Conta marcada como **CANCELED** no faturamento manual.
  - Conta com status de pagamento **OVERDUE** e engajamento técnico **CRITICAL** (baixo uso/erros).
  - Conta sem nenhuma atividade operacional de ponto nos últimos 14 dias associada a uma pendência de faturamento (`PAYMENT_PENDING` ou `OVERDUE`).
  - Score de saúde da empresa menor que 40 pontos.
- **Ações Recomendadas:**
  - **Cobrar pagamento pendente** (para pendências financeiras).
  - **Registrar motivo de cancelamento** (para planos já cancelados).
  - **Reativar uso com RH** (para clientes com baixíssima adoção técnica).

### B. MÉDIO RISCO (MEDIUM)
*Sinalizador de perda gradual de engajamento ou vencimento contratual iminente.*
- **Critérios de Gatilho:**
  - Status de saúde classificado como **ATTENTION** (engajamento moderado).
  - Próximo vencimento de faturamento (`nextBillingAt`) nos próximos 7 dias e health score abaixo de 70.
  - Taxa de resposta média aos check-ins nos últimos 7 dias menor que 50%.
  - Mais de 5 ocorrências de ponto pendentes de tratamento no RH.
- **Ações Recomendadas:**
  - **Preparar renovação** (para clientes saudáveis ou sob atenção próximos do vencimento).
  - **Revisar ocorrências abertas** (para desafogar o time de RH cliente e melhorar a percepção de valor).
  - **Agendar reunião de sucesso** (para alinhar novos objetivos de uso e diagnosticar gargalos).

### C. BAIXO RISCO (LOW)
*Clientes saudáveis, engajados e adimplentes.*
- **Critérios de Gatilho:**
  - Conta ativa ou em trial, sem vencimentos pendentes e com bom nível de engajamento geral.

---

## 3. Rotina Semanal de Retenção (Passo a Passo)

Toda segunda-feira pela manhã, o time de Customer Success (CS) deve executar os seguintes passos:

1. **Acessar o Painel de Retenção:**
   - Navegue até **Retenção e Churn** no menu lateral do `SUPER_ADMIN`.
2. **Filtrar por Alto Risco:**
   - Selecione o filtro de risco **Alto Risco** para isolar as contas em perigo iminente.
   - Aplique as ações recomendadas imediatamente (ex: ligar para o ponto de contato principal, acionar o financeiro para conciliação).
3. **Avaliar Renovações Próximas:**
   - Utilize o filtro de **Janela de Renovação: Nos próximos 7 dias** ou **30 dias**.
   - Para empresas saudáveis, envie a proposta de renovação ou faturamento manual com antecedência de 15 dias.
   - Para empresas na janela de renovação que apresentem médio/alto risco, **não envie a cobrança seca**; faça um contato de sucesso (reunião) primeiro para recuperar o engajamento do cliente.
4. **Verificar Pendências Técnicas:**
   - Clique no link **Engajamento** para inspecionar os logs operacionais da empresa caso ela apresente taxa de resposta baixa ou saúde crítica.

---

## 4. Alertas de Retenção Automatizados (Job do Sistema)

O sistema conta com um job automatizado (`POST /api/internal/jobs/retention-alerts/run`) que varre diariamente a base de dados buscando inconsistências de faturamento e engajamento.

- O job consolida relatórios e envia alertas aos administradores da plataforma via **E-mail simulado** (saídas no console de logs) e **WhatsApp** (disparos diretos de texto).
- **Controle de Idempotência:** Para evitar múltiplos disparos indesejados no mesmo dia, o job grava logs de auditoria `RETENTION_ALERT_SENT` para cada categoria de alerta.

---

## 5. Limitações e Regras Financeiras

> [!CAUTION]
> **Atenção sobre Ações de Cobrança:**
> - Os alertas gerados pelo sistema são **exclusivos para a equipe interna de CS e comercial**.
> - O sistema **não dispara e-mails de cobrança, boletos ou avisos automáticos de bloqueio para o cliente final**.
> - Qualquer contato de cobrança deve ser realizado de forma humanizada pelo time comercial com base nas orientações deste painel.
