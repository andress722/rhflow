# Política de Segurança do Assistente IA (AI Companion)

O AI Companion do PresençaFlow possui barreiras determinísticas de segurança que operam **independentemente** do modelo de linguagem (LLM), garantindo isolamento de dados e prevenção de abuso.

---

## Arquitetura de Segurança

```
Usuário → Prompt → AiToolAuthorizationService (determinístico) → [Permitido? Sim] → LLM + Tool → Resposta
                                                              ↓ [Injeção? Sim] → Rejeição imediata
```

## AiToolAuthorizationService

Serviço 100% determinístico (sem LLM) que age como guarda de acesso antes de qualquer chamada de ferramenta.

### Controle de Multitenancy

Toda chamada de tool inclui `targetCompanyId`. Se divergir do `companyId` do usuário logado, a chamada é bloqueada com `VIOLAÇÃO DE MULTITENANCY` — independente do que o prompt solicitar.

### Allowlist de Ferramentas por Perfil

| Perfil | Ferramentas Permitidas |
|---|---|
| `SUPER_ADMIN` | getPresenceSummary, getOpenOccurrences, getEmployeeCount, getReportSummary, runComplianceCheck |
| `ADMIN` | getPresenceSummary, getOpenOccurrences, getEmployeeCount, getReportSummary |
| `HR` | getPresenceSummary, getOpenOccurrences, getEmployeeCount, getReportSummary |
| `MANAGER` | getPresenceSummary, getOpenOccurrences, getEmployeeCount |
| `EMPLOYEE` | getPresenceSummary |

Qualquer ferramenta fora da allowlist é bloqueada com `Perfil X não possui permissão`.

### Filtro de Prompt Injection

Padrões bloqueados (case-insensitive):

| Padrão | Risco |
|---|---|
| `ignore suas regras` / `ignore instructions` | Bypass de instrução do sistema |
| `mostre funcionários de outra empresa` | Cross-tenant |
| `liste cpfs` / `list cpfs` | Exfiltração de dado sensível |
| `mostre cids` / `show cids` | Exfiltração de dado médico sensível |
| `revele secrets` / `show secrets` | Exfiltração de credenciais |
| `execute sql` / `database query` | Injeção de query livre |

Ao detectar qualquer padrão, a requisição é rejeitada com status `403` antes de chegar ao LLM.

## Limitações Conhecidas

- A allowlist de ferramentas é estática. Novos tools adicionados ao LLM devem ser explicitamente incluídos na allowlist.
- O filtro de injeção é baseado em heurísticas de string; um atacante sofisticado pode tentar contorná-lo com encodings ou variações linguísticas.
- O assistente não tem acesso a dados brutos de banco de dados (sem `prisma.query` livre). Todas as ferramentas retornam dados agregados pré-autorizados.

## Auditoria

Todas as chamadas de ferramenta bloqueadas devem ser registradas em `AuditLog` com `action = AI_TOOL_BLOCKED` (a implementar em versão futura).
