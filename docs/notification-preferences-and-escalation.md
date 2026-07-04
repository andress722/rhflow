# Preferências de Notificação, Regras de Escalação e Resumo Diário

Este guia documenta o funcionamento técnico e as regras de governança para as preferências de notificações, regras de escalação e resumo diário implementados na Sprint 39.

---

## 1. Preferências de Notificação

As preferências de notificação permitem que empresas e colaboradores configurem o recebimento de alertas operacionais in-app para reduzir ruído e sobrecarga de informações.

### 1.1 Resolução e Especificidade
Quando uma notificação é criada, o serviço `shouldNotify()` resolve qual preferência aplicar buscando registros no banco e atribuindo um peso/score de especificidade:

- **Usuário específico** (`userId` coincidente): Peso **+1000**
- **Papel específico** (`role` coincidente): Peso **+500**
- **Empresa específica** (`companyId` coincidente, userId/role nulos): Peso **+100**
- **Tipo de notificação** (`type` coincidente): Peso **+10**
- **Severidade da notificação** (`severity` coincidente): Peso **+5**

O registro com a maior soma de peso determina se a notificação é entregue imediatamente ou silenciada. Se nenhuma preferência for cadastrada, a notificação é **ativada por padrão**.

### 1.2 Silenciamento e Histórico
Quando uma notificação é silenciada (seja por preferência desativada ou por horário de silêncio), ela **não é omitida do banco de dados**. 
O sistema cria o registro com status `DISMISSED` e adiciona `suppressed: true` nos metadados. Isso garante:
- Histórico completo de eventos ocorridos para fins de auditoria e métricas.
- O correto funcionamento do indicador `suppressedToday` no Command Center.
- Que o usuário não receba banners ativos, badges ou alertas visuais para itens que optou por silenciar.

### 1.3 Horário de Silêncio (Quiet Hours) e Digest
- Se as **Quiet Hours** estiverem configuradas (ex: 22:00 às 06:00 no fuso `America/Sao_Paulo`) e `digestEnabled` estiver ativo, os alertas gerados nesse intervalo são silenciados no recebimento imediato e acumulados para o resumo.

---

## 2. Exceções Críticas de Silêncio (Overrides)

Por questões de conformidade e integridade operacional do SaaS, determinados alertas críticos de plataforma ou financeiros **não podem ser silenciados**, ignorando qualquer preferência de mute cadastrada pelo usuário:

- `CRITICAL_JOB_FAILED`: Falha em jobs críticos do sistema.
- `MANY_OPERATIONAL_ERRORS`: Excesso de erros de plataforma em lote.
- `BILLING_OVERDUE`: Assinatura/Fatura vencida corporativa.
- `HIGH_CHURN_RISK`: Cliente corporativo com alto risco de churn detectado.
- `WHATSAPP_CHANNEL_ERROR`: Perda de conexão no canal do WhatsApp da empresa.
- `CRITICAL_OCCURRENCE`: Ocorrência de alta gravidade (ex: fraude ou divergência severa).
- `URGENT_BACKLOG_OVERDUE`: Item de suporte/backlog urgente com prazo estourado.
- `MANY_UNREAD_CRITICAL_NOTIFICATIONS`: Sobrecarga de alertas críticos não lidos na plataforma.

---

## 3. Regras de Escalação

O sistema conta com um job periódico que varre notificações com status `UNREAD` e que excederam o tempo limite configurado em `NotificationEscalationRule`.

### 3.1 Funcionamento da Escalação
Quando um alerta coincide com uma regra (ex: atestado médico pendente sem revisão há 1440 minutos):
1. O sistema cria uma nova notificação direcionada ao `targetRole` (ex: `HR` ou `SUPER_ADMIN`).
2. O título da nova notificação recebe o prefixo `[ESCALATION]`.
3. É criada uma chave única `dedupeKey` no formato `escalation:{originalNotificationId}:{targetRole}` para impedir que a mesma notificação seja escalada repetidamente pelo job.
4. O evento registra uma entrada no log com action `NOTIFICATION_ESCALATION_RUN`.

---

## 4. Resumo Diário (Notification Digest)

O consolidado diário agrupa todas as notificações (lidas, não lidas ou silenciadas) geradas para o usuário, papel ou empresa nas últimas 24h.

### 4.1 Governança e LGPD
Para evitar vazamento de informações sensíveis sob a LGPD:
- O resumo diário **não armazena informações sensíveis** como CPFs, nomes de exames, diagnósticos médicos ou mensagens brutas de WhatsApp.
- O campo `summary` salva apenas contagens numéricas agrupadas por severidade/tipo e a listagem de títulos e mensagens higienizadas das notificações.

---

## 5. Limites do Escopo (Sprint 39)

- **Apenas In-App**: O canal `IN_APP` é o único canal suportado.
- **Sem envio externo**: Não há disparo de e-mails, SMS, ou mensagens ativas de WhatsApp para preferências configuradas nesta sprint. Os digests e alertas são visualizados diretamente dentro do painel do PresençaFlow.
