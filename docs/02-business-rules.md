# 02 — Regras de Negócio

## Conceitos centrais

- Toda ausência vira uma ocorrência.
- Todo atestado vira um protocolo.
- Toda decisão do RH fica registrada.
- Toda interação via WhatsApp gera evento de timeline.
- O gestor só vê funcionários sob sua responsabilidade.
- O RH vê todos os funcionários da empresa.
- Dados médicos sensíveis devem ter acesso restrito.

## Tipos de ocorrência

- MISSED_CLOCK_IN: não bateu entrada.
- MISSED_CLOCK_OUT: não bateu saída.
- LATE_ARRIVAL: atraso.
- EARLY_LEAVE: saída antecipada.
- ABSENCE: falta.
- TEMPORARY_ABSENCE: ausência temporária.
- MEDICAL_CERTIFICATE: atestado.
- REMOTE_CHECKIN_MISSED: check-in remoto não respondido.
- REMOTE_CHECKOUT_MISSED: check-out remoto não respondido.
- REMOTE_TECHNICAL_ISSUE: problema técnico remoto.

## Status de ocorrência

- OPEN
- WAITING_EMPLOYEE
- WAITING_MANAGER
- WAITING_HR
- RESOLVED
- REJECTED
- CANCELLED

## Status de ausência

- REPORTED
- WAITING_JUSTIFICATION
- WAITING_CERTIFICATE
- JUSTIFIED
- UNJUSTIFIED
- EXCUSED
- REJECTED

## Status de atestado

- RECEIVED
- UNDER_REVIEW
- APPROVED
- REJECTED
- RESUBMISSION_REQUESTED

## Status de check-in remoto

- PENDING
- CONFIRMED
- LATE
- NOT_RESPONDED
- ISSUE_REPORTED

## Regras de ponto não batido

1. O sistema verifica a jornada ativa do funcionário.
2. Após o horário esperado + tolerância, verifica se houve batida/importação/check-in.
3. Se não houver registro, cria ocorrência e envia WhatsApp.
4. Se o funcionário responder, registra evento na timeline.
5. Se não responder após prazo configurado, notifica gestor.
6. Se continuar sem resposta, notifica RH.

## Regras de falta pelo WhatsApp

1. Funcionário pode avisar falta por mensagem livre ou opção.
2. O sistema deve classificar a intenção como ausência.
3. O sistema pergunta motivo.
4. Se motivo envolver saúde, pergunta se há atestado.
5. Ocorrência é criada e vinculada ao funcionário.
6. Gestor e RH recebem notificação.
7. RH define classificação final: justificada, injustificada, abonada ou rejeitada.

## Regras de atestado

1. Atestado pode ser foto ou PDF.
2. O arquivo deve ser salvo em storage privado.
3. Deve ser criado protocolo único.
4. RH deve conseguir aprovar/rejeitar.
5. Rejeição exige motivo.
6. Aprovação exige período de afastamento.
7. CID não deve aparecer em relatórios comuns.
8. Visualização de atestado deve ser auditada.

## Regras de trabalho remoto

1. Funcionário remoto/híbrido pode receber check-in no início da jornada.
2. Se não responder, sistema cria pendência.
3. Funcionário pode reportar problema técnico.
4. Problema técnico deve ter tipo, início, previsão e observação.
5. Não implementar monitoramento invasivo: sem print de tela, webcam, mouse/teclado ou gravação.

## Regras de auditoria

Registrar:

- Criação de ocorrência.
- Mensagem WhatsApp enviada.
- Resposta recebida.
- Upload de anexo.
- Notificação ao gestor.
- Aprovação/rejeição do RH.
- Alteração de dias de afastamento.
- Exportação de relatório.
