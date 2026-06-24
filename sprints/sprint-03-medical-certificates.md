# Sprint 03 — Atestados e Afastamentos

## Objetivo

Permitir envio de atestado por foto/PDF, análise pelo RH e registro de afastamento.

## Entregas

- Upload de atestado.
- Storage local.
- MedicalCertificate.
- AbsenceRecord.
- Aprovação/rejeição de atestado.
- Definição de dias de afastamento.
- Notificação ao gestor via mock WhatsApp.
- Tela de atestados.

## Backend tasks

- Criar models MedicalCertificate e AbsenceRecord.
- Criar upload com validação de arquivo.
- Salvar arquivo em storage privado local.
- Criar endpoint para aprovar atestado.
- Criar endpoint para rejeitar atestado com motivo obrigatório.
- Criar evento de timeline para aprovação/rejeição.
- Criar ausência/afastamento ao aprovar.

## Frontend tasks

- Lista de atestados.
- Tela de análise de atestado.
- Preview do arquivo.
- Formulário: início, fim, dias, observação.
- Botões aprovar/rejeitar/solicitar reenvio.

## Critérios de aceite

- Funcionário/operador consegue enviar atestado.
- RH consegue visualizar arquivo.
- RH aprova e define dias.
- Sistema cria afastamento.
- Gestor recebe notificação mock.
- Rejeição exige motivo.
