# Playbook de Notificações In-App, Central de Alertas e Caixa de Tarefas Operacionais

Este documento consolida as regras de negócio, arquitetura técnica e diretrizes de governança (LGPD) para o sistema de Notificações In-App do PresençaFlow.

---

## 1. Severidades e Casos de Uso

As notificações no PresençaFlow possuem quatro severidades possíveis, que devem ser usadas seguindo os critérios abaixo:

| Severidade | Descrição | Exemplo de Caso de Uso |
|---|---|---|
| **INFO** | Apenas informativas, sem urgência operacional imediata. | Relatório diário de fechamento com pendências. |
| **SUCCESS** | Indica sucesso na conclusão de uma revisão ou fluxo relevante. | Atestado médico aprovado pelo RH/Gestor. |
| **WARNING** | Exige atenção operacional, mas não indica falha crítica de infraestrutura ou violação severa imediata. | Novo atestado pendente de revisão; canal do WhatsApp com erro temporário; lead sem contato há 3 dias. |
| **CRITICAL** | Exige ação corretiva prioritária imediata. Pode representar incidentes de retenção ou falhas graves de sistema. | Fatura vencida (OVERDUE); ocorrência de alta gravidade (HIGH/CRITICAL) registrada; job crítico do sistema falhou. |

---

## 2. Regras de Visibilidade por Perfil

Para respeitar a privacidade e a distribuição correta de tarefas no modelo multi-tenant, a visibilidade das notificações é delimitada pelo perfil do usuário:

1. **ADMIN e HR (Corporativo)**:
   - Visualizam notificações onde `companyId` corresponde ao da sua empresa.
   - Escopos adicionais permitidos: `role = 'ADMIN'`, `role = 'HR'` ou diretamente direcionadas ao seu `userId`.
2. **MANAGER (Corporativo)**:
   - Visualizam notificações onde `companyId` corresponde ao da sua empresa.
   - Escopos permitidos: `role = 'MANAGER'` ou direcionadas ao seu `userId`.
   - *Nota*: As notificações de equipe (como faltas reportadas e novos atestados da equipe) são direcionadas usando o `userId` do gestor.
3. **VIEWER (Corporativo)**:
   - Visualizam exclusivamente notificações direcionadas diretamente ao seu `userId`.
4. **SUPER_ADMIN (Plataforma)**:
   - Visualizam notificações de plataforma (onde `companyId IS NULL` e `role IS NULL`).
   - Bloqueados de acessar rotas corporativas e vice-versa.

---

## 3. Idempotência e Chaves de Deduplicação (`dedupeKey`)

Para evitar spam visual e sobrecarga de banco de dados, todas as notificações de sinais repetitivos utilizam um mecanismo de deduplicação idempotente.

A função `createOrUpdateByDedupeKey` garante que, se uma notificação com o mesmo `dedupeKey` já existir:
- O status da notificação existente volta a ser `UNREAD` (Não lida).
- Os campos `title`, `message`, `severity` e `metadata` são atualizados.
- Não é criada uma segunda linha no banco de dados.

### Tabela de dedupeKeys por sinal

| Sinal | dedupeKey | Janela de Deduplicação |
|---|---|---|
| Atestado Pendente | `certificate:{certificateId}:pending` | Único por atestado |
| Atestado Revisado | `certificate:{certificateId}:reviewed` | Único por atestado |
| Ocorrência Crítica | `occurrence:{occurrenceId}:open-critical` | Único por ocorrência |
| Ocorrência de Equipe | `occurrence:{occurrenceId}:open-manager` | Único por ocorrência |
| Muitas Ocorrências (Job) | `company:{companyId}:many-open-occurrences:{date}` | Diário (24h) |
| Check-ins não Respondidos | `company:{companyId}:many-not-responded:{date}` | Diário (24h) |
| Ausência via Check-in | `checkin:{checkinId}:absence-reported` | Único por check-in |
| Check-in sem Resposta (Manager) | `checkin:{checkinId}:not-responded` | Único por check-in |
| Erro no Canal do WhatsApp | `company:{companyId}:whatsapp-error:{date}` | Diário (24h) |
| Health Score Crítico | `company:{companyId}:health-critical:{date}` | Diário (24h) |
| Fatura Vencida | `billing:{companyId}:overdue:{date}` | Diário (24h) |
| Risco de Churn Alto | `billing:{companyId}:high-churn:{date}` | Diário (24h) |
| Renovação Próxima | `billing:{companyId}:renewal-7d:{date}` | Diário (24h) |
| Empresa Inativa | `company:{companyId}:inactive-7d:{date}` | Diário (24h) |
| Feedback Crítico | `feedback:{feedbackId}:critical` | Único por feedback |
| Backlog Urgente Vencido | `backlog:{itemId}:urgent-overdue:{date}` | Diário (24h) |
| Falha em Job Crítico | `job:{jobKey}:failed:{date}` | Diário (24h) |
| Excesso de Erros de Plataforma | `platform:many-op-errors:{date}` | Diário (24h) |
| Lead Comercial Stale | `lead:{leadId}:stale:{date}` | Diário (24h) |

---

## 4. Cuidados e Governança LGPD (Dados Sensíveis)

É expressamente proibido expor dados sensíveis de colaboradores e clientes na mensagem de notificação ou em seu objeto de metadados (`metadata` JSONB).

### Regras de higienização automática (`sanitizeMetadata`)

O serviço `NotificationCenterService` higieniza automaticamente os metadados antes da inserção no banco:

1. **CPF e Documentos**:
   - Campos nomeados `cpf` ou `document` têm seus valores substituídos por `'***.***.***-**'`.
   - Qualquer string de 11 dígitos consecutivos identificada em valores é automaticamente mascarada.
2. **Dados de Saúde**:
   - Campos como `diagnosis`, `cid`, `medicalNotes` e `clinicalNotes` são inteiramente removidos (substituídos por `'[REDACTED]'`).
   - O campo `message` de notificação de atestado nunca deve citar sintomas ou CIDs médicos.
3. **Mensagens do WhatsApp**:
   - Não armazene mensagens do WhatsApp brutas nos metadados ou na mensagem de notificação. Limite-se a referenciar o identificador da ocorrência ou do check-in.
   - Números de telefone/WhatsApp são parcialmente mascarados mantendo apenas os primeiros 4 dígitos e os últimos 2.
4. **Segredos e Credenciais**:
   - Campos como `token`, `password`, `secret`, `webhookSecret` e cabeçalhos `Authorization` Bearer são totalmente higienizados ou removidos.

---

## 5. Práticas recomendadas para desenvolvimento

1. **Notificações como efeito secundário**:
   - Sempre chame o serviço de notificações em blocos `try/catch` silenciosos ou trate o retorno de promises de modo a não interromper transações principais do banco de dados (ex.: a criação de um atestado não deve falhar se o serviço de notificações estiver indisponível).
2. **Ações Rápidas (`actionUrl`)**:
   - Ao criar notificações direcionadas, utilize a propriedade `actionUrl` (ex.: `/app/medical-certificates`) para que o usuário possa clicar na notificação e ir direto para a tela de ação.
3. **Limites do Escopo da Sprint**:
   - Sem envio de e-mails/WhatsApp nesta fase.
   - Sem envio de notificações push via Web Push API.
   - Utiliza mecanismo de polling simples no frontend (badge e dropdown).
