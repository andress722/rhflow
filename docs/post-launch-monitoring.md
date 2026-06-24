# Monitoramento Pós-Go-Live (Plano de 7 Dias) — PresençaFlow RH

Este documento descreve as rotinas operacionais diárias de checagem, monitoramento de métricas e controle de falhas estabelecidas para a primeira semana (7 dias) subsequente ao lançamento em produção do PresençaFlow RH.

---

## 1. Atribuição de Responsabilidades

- **Responsável Principal**: Operador de Infraestrutura / Líder Técnico (SRE/DevOps).
- **Responsável Comercial**: Gestor de Produto / Suporte Comercial (para triagem de leads).
- **Ferramentas Utilizadas**: Painel Administrativo de Suporte, Dashboard do Analytics, logs do sistema (OperationalErrorLog) e comandos de monitoramento de armazenamento do servidor.

---

## 2. Checklist Diário de Monitoramento

Durante os primeiros 7 dias após o go-live, as verificações abaixo devem ser realizadas impreterivelmente em dois turnos: **Manhã (até as 09:00)** e **Fim do Dia (a partir das 18:00)**.

### 🌅 Turno da Manhã (Foco em Disponibilidade e Saúde)

| Item | Procedimento de Verificação | Indicador Esperado |
| :--- | :--- | :--- |
| **1. API Health** | Acessar `https://api.presencaflow.com.br/api/health/ready` no navegador ou via curl. | Status `200 OK` com payload `{ "status": "OK" }`. |
| **2. Painel de Suporte** | Acessar o painel administrativo de suporte `/app/admin/support`. | Todos os indicadores operacionais em verde, sem alertas de travamento. |
| **3. Erros Persistentes** | Consultar a tabela `OperationalErrorLog` na API de suporte buscando erros com status `5xx`. | Zero ocorrências críticas do tipo `DATABASE_DISCONNECTED` ou `REDIS_UNAVAILABLE`. |
| **4. Integridade de Backups** | Verificar o diretório de destino de backups no servidor (ex: `/backups`). | Presença de um arquivo `.dump` íntegro gerado na madrugada com tamanho consistente. |
| **5. Disco & STORAGE_PATH** | Executar comando de checagem de espaço em disco no servidor (ex: `df -h`). | Uso de disco abaixo de 80% no volume mapeado para `STORAGE_PATH`. |
| **6. Triagem de Leads** | Acessar `/app/admin/leads` e checar novas candidaturas recebidas nas últimas 12 horas. | leads listados corretamente com as respectivas origens de campanha (UTMs). |

---

### 🌇 Turno do Fim do Dia (Foco em Uso, Limites e Conversão)

| Item | Procedimento de Verificação | Indicador Esperado |
| :--- | :--- | :--- |
| **1. Funil de Analytics** | Acessar o dashboard do provider de Analytics (ex: Plausible/Umami ou Console Logs). | Eventos `pilot_form_submitted` e `lead_created_success` batendo com o total de leads criados. |
| **2. Conversões & leads** | Comparar o total de leads recebidos no banco com a contagem de conversões estimadas na campanha. |leads consolidados sem duplicados persistentes (deduplicação ativa). |
| **3. Canais WhatsApp** | Verificar no painel de suporte se há canais de integração de WhatsApp de clientes com status `ERROR`. | Todos os canais ativos operando normalmente ou com alertas de token expirado tratados. |
| **4. Execução de Jobs** | Consultar no log técnico se os jobs internos (ex: `mark-not-responded`) rodaram no horário correto. | Registros de `JOB_FINISHED` sem erros 401 ou 500. |
| **5. Limites de Uso** | Verificar se alguma empresa piloto ativa atingiu 80% ou mais dos limites de uso do plano contratado. | Alinhamento prévio com o time comercial caso limites de ponto ou colaboradores precisem de expansão. |

---

## 3. Gestão e Registro de Incidentes

Qualquer anomalia identificada durante as checagens diárias deve ser imediatamente tratada conforme a classificação de severidade:

1. **Abertura de Chamado**: Registre no sistema de rastreamento de issues interno da equipe (ex: Jira, GitHub Issues) especificando a rota afetada, o `requestId` correspondente do log (para depuração rápida) e o comportamento observado.
2. **Avaliação de Rollback**: Se um erro de severidade crítica (SEV 1) for identificado durante a rotina matinal e não houver hotfix rápido possível em 15 minutos, acione o [Plano de Rollback](file:///c:/Users/Benyamin/Downloads/presencaflow_agent_base%20%281%29/presencaflow_agent_base/docs/rollback-plan.md).
3. **Triagem Comercial Sem E-mail Automático**: Dado que o fluxo de contato inicial pós-candidatura de leads de piloto ainda é realizado de forma assistida pela equipe comercial (sem e-mails transacionais automáticos configurados), o operador de monitoramento deve exportar diariamente a planilha de novos leads e enviá-la para o responsável comercial fazer follow-up em no máximo 24 horas.
