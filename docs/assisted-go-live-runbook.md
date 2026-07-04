# Runbook de Go-Live Assistido — PresençaFlow RH

Este guia instrui a equipe de engenharia e operações no acompanhamento de implantação real de clientes na plataforma de produção.

---

## 1. Pré-Go-Live (D-1)

- [ ] **Auditoria de Ambiente:**
  - Validar que o banco de dados está em regime de réplica ativo.
  - Verificar que o Redis tem memória suficiente e taxa de rejeição zero.
- [ ] **Geração de Backups:**
  - Efetuar um dump completo de backup de banco antes de qualquer alteração de dados.

---

## 2. Janela de Implantação e Acompanhamento

- **Quem Acompanha:** Líder de Implantação Técnico (Engenharia) e Customer Success (CS).
- **Validação de Produção:**
  1. Executar o smoke test (`staging-full-smoke-test.ts`) apontando para o endpoint HTTPS de produção para garantir 100% de estabilidade nas APIs analíticas e autenticação.
  2. Executar o diagnóstico de readiness (`GET /api/admin/go-live/readiness/:companyId`) para o cliente.

---

## 3. Critérios GO/NO-GO

| Critério | GO | NO-GO |
| :--- | :--- | :--- |
| **Erros 5xx de API** | 0% erros em requisições de teste | > 1% de erros |
| **WhatsApp Status** | `CONNECTED` real ou simulação explícita | Desconectado/Erro persistente |
| **Funcionários Cadastrados** | > 0 colaboradores | Planilha com erros ou importação vazia |
| **Jornadas Ativas** | Pelo menos 1 jornada cadastrada | Nenhuma jornada cadastrada |

*Decisão NO-GO implica acionamento imediato do **Plano de Rollback**.*

---

## 4. Comunicação e Estabilização Pós-Lançamento

### D+1 (Primeiro dia operacional):
- Monitoramento de check-ins automatizados às 8h.
- Acompanhamento da fila do Redis de mensagens WhatsApp.
- Resolução rápida de eventuais erros de digitação de telefones dos colaboradores.

### D+3 e D+7 (Primeira semana):
- Validação do fechamento diário de ocorrências.
- Geração manual e verificação do relatório operacional da empresa piloto.
