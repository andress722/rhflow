# Sprint 52 - Gap Closure, Consolidação Técnica e Fechamento de Pontas Soltas

Esta documentação consolida os objetivos, entregas e validações técnicas concluídas na **Sprint 52**.

---

## 1. Escopo e Diretrizes
A Sprint 52 foi focada inteiramente na regularização técnica e refatoração de segurança de funcionalidades entregues nas sprints anteriores.
- **Nenhum escopo funcional ou nova feature** foi introduzida.
- Foco em: persistência de dados íntegra, isolamento de inquilinos (Tenants), tratamento de erros offline e segurança contra injeção e acessos indevidos.

---

## 2. Principais Entregas

### A. Banco de Dados e Migration
- Adicionado o campo `leaveRequestId String? @unique` ao modelo `AbsenceRecord` no Prisma schema para evitar abonos duplicados para a mesma solicitação.
- Adicionados os campos de auditoria `actorId`, `previousBalance` e `resultingBalance` ao modelo `HourBankTransaction`.
- Criação e execução da migration `20260705000000_sprint52_gap_closure`.

### B. Workforce Risk Signals (Sinais de Risco Operacional)
- Substituição da nomenclatura antiga "Previsão/Turnover IA" para "Sinais de Risco Operacional" (Workforce Risk Signals) no backend e no frontend (Ficha 360).
- Inclusão de avisos legais (disclaimers) explícitos determinando que as pontuações são heurísticas simples de assiduidade e clima, exigindo obrigatoriamente revisão humana antes de qualquer decisão de desligamento ou disciplina trabalhista.

### C. Integração de Calendário (Google & Microsoft)
- Acoplamento do serviço de sincronização (`CalendarSyncService.syncLeaveEvent` e `deleteCalendarEvent`) ao ciclo de vida de aprovação e rejeição de afastamentos de forma assíncrona (`fire-and-forget`).
- Sinalização das dependências como `NEEDS_HOMOLOGATION` devido à ausência de credenciais reais em produção no código.

### D. PWA Offline & IndexedDB Queue
- Implementação do módulo IndexedDB `offline-db.ts` no frontend para gerenciar check-ins remotos iniciados offline, organizando e ordenando sequências antes da re-sincronização.
- Validação estrita contra replays, integridade e sequenciamento fora de ordem cronológica no backend.
