# Rotina Diária Operacional de Vendas — PresençaFlow RH

Este documento orienta o time comercial (SUPER_ADMIN) nas rotinas de vendas diárias e no acompanhamento de leads no CRM, prevenindo a perda de oportunidades comerciais.

---

## 1. Cronograma de Rotina Diária

### 🌅 Rotina da Manhã (08:30 - 09:30)
*Foco: Limpar a mesa e planejar o dia comercial.*

1. **Revisar Leads sem Responsável**:
   - Clique no card **"Sem Responsável"** do painel comercial.
   - Atribua um SUPER_ADMIN ativo a cada novo lead para iniciar a cadência de imediato.
2. **Revisar Follow-ups Vencidos**:
   - Clique no card **"Follow-up Vencido"**.
   - Priorize contatos com leads que estão com tarefas atrasadas e reagende o próximo follow-up.
3. **Revisar Demos do Dia**:
   - Clique no card **"Demos Hoje"**.
   - Confirme presença/horário enviando mensagens curtas pelo WhatsApp para evitar faltas (no-show).

### ☀️ Rotina do Meio do Dia (11:30 - 14:30)
*Foco: Execução ativa e abordagem.*

1. **Processar Leads sem Contato**:
   - Clique no card **"Sem Contato"** (leads criados há mais de 24 horas sem nenhum registro de contato).
   - Inicie a cadência comercial de imediato.
2. **Registrar Abordagens (Contato Rápido)**:
   - Use o botão **"Contato Rápido"** diretamente na tabela para registrar a atividade `CONTACTED` assim que enviar mensagens ou ligar.
3. **Qualificar Leads**:
   - Durante as conversas, valide os critérios de qualificação (fit técnico, número de funcionários, dores de atestado/presença).
   - Se qualificado, mude o status para `QUALIFIED` e agende a demonstração (`demoScheduledAt`).

### 🌇 Rotina do Fim do Dia (16:30 - 18:00)
*Foco: Atualização de status e fechamentos.*

1. **Revisar Leads Qualificados Parados (Stale Leads)**:
   - Clique no card **"Qualif. Parado"** (leads qualificados sem interação nos últimos 7 dias).
   - Planeje um follow-up agressivo de fechamento.
2. **Registrar Resultados (WON/LOST)**:
   - Registre o status `WON` (leads fechados) ou `LOST` (leads perdidos, preenchendo obrigatoriamente o `lostReason`).
3. **Revisar Próximos Passos**:
   - Garanta que nenhum lead em andamento (`NEW`, `CONTACTED`, `QUALIFIED`) tenha o campo `nextFollowUpAt` em branco.

---

## 2. Critérios de Transição de Status

| Status | Quando Usar | Ações Obrigatórias / Efeitos |
|---|---|---|
| **NEW** | Lead recém-cadastrado no site. | Criado automaticamente no banco de dados. |
| **CONTACTED** | Primeira interação realizada com sucesso. | Atualiza `lastContactedAt = agora`. Cria atividade `CONTACTED`. |
| **QUALIFIED** | Lead possui fit comercial e atende aos requisitos mínimos. | Cria atividade `STATUS_CHANGED`. Permite agendar demonstração (`demoScheduledAt`). |
| **WON** | Fechamento do contrato do piloto de 14 dias ou comercial. | Define `wonAt = agora`. Limpa `nextFollowUpAt` e `lostReason`. Cria atividade `WON`. |
| **LOST** | Lead desistiu ou parou de responder a cadência de vendas. | Limpa `nextFollowUpAt`. Exige o preenchimento de `lostReason`. Cria atividade `LOST`. |

---

## 3. Cadência Recomendada (D0 a D7)

Siga este fluxo para leads frios ou sem resposta inicial:

*   **D0 (Dia do Cadastro)**: WhatsApp de boas-vindas + proposta de agendamento de conversa curta (Discovery).
*   **D1**: E-mail comercial com vídeo demonstrativo de 2 minutos ou PDF explicativo.
*   **D3**: WhatsApp focado na dor declarada no formulário (ex: atestados, presença de equipe externa).
*   **D7**: Último WhatsApp ("Break-up message"). Se não houver retorno, mudar status para `LOST` com motivo "Ghosting / Sem retorno".
