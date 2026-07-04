# Runbook de Performance e Escalabilidade (Sprint 31)

Este runbook orienta a equipe de desenvolvimento e sustentação técnica nas melhores práticas de otimização de banco de dados, governança de paginação de dados e estratégias de cache do PresençaFlow RH.

---

## 1. Mapeamento de Rotas Críticas e Índices Criados

Com o crescimento da base de dados de check-ins e ocorrências, criamos os seguintes índices PostgreSQL no schema para acelerar buscas e relatórios analíticos:

- **Presença e Check-ins (`RemoteCheckin`):**
  - `RemoteCheckin_companyId_checkinDate_idx`: Acelera a tela de dashboard de presença diária.
  - `RemoteCheckin_companyId_status_checkinDate_idx`: Otimiza consultas de contadores de presença (atrasos, faltas, adimplência).
- **Faturamento e Assinaturas (`CompanySubscription`):**
  - `CompanySubscription_billingStatus_nextBillingAt_idx`: Acelera varreduras de retenção e contas a vencer.
- **Alertas e Logs (`AuditLog`, `WhatsAppMessageLog`, `JobRun`):**
  - `AuditLog_companyId_action_createdAt_idx`: Otimiza buscas de histórico de auditoria por período.
  - `WhatsAppMessageLog_companyId_status_createdAt_idx`: Acelera a tela de logs de mensagens.
  - `JobRun_jobKey_startedAt_idx`: Acelera estatísticas analíticas de jobs em lote.
- **Ocorrências e Atestados (`Occurrence`, `MedicalCertificate`):**
  - `Occurrence_companyId_status_createdAt_idx`: Melhora o tempo de carregamento da listagem de pendências de RH.
  - `MedicalCertificate_companyId_status_createdAt_idx`: Acelera homologação de atestados médicos.

---

## 2. Estratégia de Cache em Memória (Short-term Cache)

Implementamos um cache em memória curto para dashboards de plataforma do `SUPER_ADMIN` para reduzir a carga de consultas recursivas ao banco de dados:

- **Command Center Overview (`/api/admin/command-center/overview`):** TTL de 30 segundos.
- **Retention Overview (`/api/admin/retention/overview`):** TTL de 30 segundos.
- **Jobs Registry Overview (`/api/admin/jobs`):** TTL de 15 segundos.

### Configurações de Ambiente (DISABLE_CACHE):
Caso seja necessário forçar leituras diretas em tempo real no banco, configure a variável de ambiente:
```bash
DISABLE_CACHE=true
```

> [!CAUTION]
> **Políticas de Segurança do Cache:**
> O cache em memória é exclusivo para agregação analítica geral de suporte de plataforma. **Nunca utilize o cache em endpoints corporativos de clientes (multi-tenant)** para evitar qualquer possibilidade de vazamento ou contaminação de dados entre empresas.

---

## 3. Limites de Paginação e Proteção de Memória

Para evitar estouros de memória no processo Node.js por transferência de payloads excessivos, todas as listagens possuem paginação enforcada:

- **PageSize Máximo:** O parâmetro `pageSize` é limitado a um **máximo seguro de 100 itens por página**. Requisições que solicitarem valores superiores (ex: `pageSize=1000`) serão automaticamente limitadas a 100 no backend.
- **Evitar N+1:** É proibido efetuar buscas adicionais ao banco dentro de loops de mapeamento. Utilize recursos de agregação do Prisma (ex: `prisma.usageCounter.findMany`) ou selects de campos específicos.

---

## 4. Como Investigar Lentidão e Query Tuning

1. **Threshold de Alerta (Slow Query):** Queries ou requisições que demorarem mais de **200ms** disparam alertas no log do Fastify.
2. **Uso do EXPLAIN:** Conecte ao banco de dados de homologação/produção e rode o plano de execução:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM "RemoteCheckin" WHERE "companyId" = '...' AND "status" = 'PENDING';
   ```
3. **Análise de Index Scan:** Certifique-se de que a query realiza um `Index Scan` ou `Index Only Scan`. Se estiver realizando um `Seq Scan`, revise a ordem das colunas no índice composto.
