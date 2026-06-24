# Playbook de Follow-up de Leads — PresençaFlow RH

Este documento serve como guia prático de operação comercial inicial para nutrir, qualificar e gerenciar leads que se cadastram no piloto do PresençaFlow RH.

---

## 1. Rotina para Lead Novo (D0)

O primeiro contato com o lead deve acontecer nas primeiras **2 horas** após o cadastro. Leads quentes têm uma taxa de conversão até 7x maior quando contatados rapidamente.

1. **Notificação de Novo Lead**: O SUPER_ADMIN recebe a notificação/cadastro.
2. **Atribuição**: Defina o responsável no CRM (`assignedToUserId`).
3. **Primeira Abordagem (D0)**:
   - Tente ligar ou enviar mensagem no WhatsApp (preferencial).
   - O objetivo é apenas agendar uma chamada rápida de qualificação de 15 minutos (Discovery).

---

## 2. Cadência de Follow-up (D0 a D7)

Caso o lead não responda à primeira abordagem, siga rigorosamente a cadência abaixo:

| Dia | Canal | Objetivo da Mensagem |
|---|---|---|
| **D0** | WhatsApp / Ligação | Apresentação rápida e proposta de agendamento de conversa. |
| **D1** | WhatsApp / E-mail | Envio de valor (vídeo curto de 2 min do produto ou FAQ comercial). |
| **D3** | WhatsApp | Cutucada suave. Foco no problema dele (ex: "Vi que você comentou sobre dor com atestados..."). |
| **D7** | WhatsApp / Ligação | Última tentativa de contato. Se não responder, marcar como perdido. |

### Mensagens Sugeridas

#### D0 (WhatsApp):
> *"Olá, {Nome}! Aqui é o {Seu Nome} do PresençaFlow RH. Vi que você solicitou acesso ao nosso piloto para a {Empresa}. Legal demais! Você tem 10 minutinhos hoje ou amanhã para conversarmos sobre como podemos reduzir suas faltas operacionais em até 30%?"*

#### D1 (E-mail / WhatsApp):
> *"Oi, {Nome}, tudo bem? Compartilho um caso rápido de um cliente nosso que reduziu a dor de gestão de atestados médicos na mesma semana usando nosso app. Caso queira ver como funciona na prática, qual destes horários fica melhor para você: [Horário A] ou [Horário B]?"*

#### D3 (WhatsApp):
> *"Olá, {Nome}! Entendo a correria. No seu cadastro, você mencionou que o maior desafio hoje na {Empresa} é {Dor Principal}. Nós resolvemos exatamente isso automatizando o check-in dos funcionários via WhatsApp. Podemos falar rapidamente amanhã às 14h?"*

#### D7 (Mensagem de Break-up):
> *"Oi, {Nome}. Como não consegui contato, imagino que o momento esteja corrido ou essa não seja uma prioridade para a {Empresa} agora. Vou encerrar seu chamado por aqui, mas se quiser reativar o contato, basta me chamar por este canal. Sucesso por aí!"*

---

## 3. Diretrizes de Transição de Status no CRM

No CRM, cada interação deve atualizar o status do lead e registrar uma atividade (`LeadActivity`):

### Quando marcar como CONTACTED
- Assim que for feita a primeira ligação com sucesso ou houver troca de mensagens ativa pelo WhatsApp.
- **Ação no CRM**: Atualizar status para `CONTACTED` (registra a atividade `CONTACTED` e preenche `lastContactedAt = agora`).

### Quando marcar como QUALIFIED (ou agendar demo)
- O lead atende aos critérios mínimos (possui mais de 10 funcionários, tem dor de presença operacional e poder de decisão ou influência).
- **Ação no CRM**: Atualizar status para `QUALIFIED` e agendar a demonstração preenchendo a data de `demoScheduledAt`.

### Quando marcar como WON
- Contrato de piloto ou comercial assinado, ou aceite formal de início de implantação.
- **Ação no CRM**: Atualizar status para `WON` (limpa `nextFollowUpAt` e `lostReason`, preenche `wonAt = agora`).

### Quando marcar como LOST (Perdido)
- Lead não respondeu após a cadência de 7 dias, ou declarou explicitamente que não tem interesse ou orçamento.
- **Ação no CRM**: Atualizar status para `LOST`.
- **Regra**: O campo `lostReason` (Motivo de Perda) é **obrigatório** e deve conter um dos motivos comuns.

---

## 4. Motivos Comuns de Perda (`lostReason`)

Ao marcar um lead como `LOST`, identifique claramente o motivo para futuras análises de inteligência comercial:

1. **Sem Retorno (No Show / Ghosting)**: Lead parou de responder ou não compareceu às reuniões agendadas após todas as tentativas da cadência.
2. **Preço / Sem Orçamento**: Lead achou o valor comercial fora do orçamento planejado para RH no momento.
3. **Sem Fit Técnico**: Empresa muito pequena (ex: menos de 5 funcionários) onde a automação por WhatsApp não gera ROI claro.
4. **Concorrente**: Lead optou por uma ferramenta concorrente clássica (ex: relógio de ponto tradicional).
5. **Sem Prioridade Interna**: O projeto de otimização de controle de faltas foi postergado pela diretoria da empresa.
