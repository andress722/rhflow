# Sprint 02 — Ocorrências e WhatsApp Mock

## Objetivo

Criar central de ocorrências e simular fluxos de WhatsApp para ponto não batido e aviso de falta.

## Entregas

- Occurrence.
- OccurrenceEvent.
- WhatsAppMessage.
- WhatsApp service mock.
- Webhook WhatsApp inicial.
- Simulação de ponto não batido.
- Fluxo de falta via WhatsApp.
- Tela de ocorrências.
- Detalhe com timeline.

## Backend tasks

- Criar models Occurrence, OccurrenceEvent, WhatsAppMessage.
- Criar service para criar ocorrência.
- Criar service para adicionar evento à timeline.
- Criar mock WhatsApp sendMessage.
- Criar endpoint `POST /api/webhooks/whatsapp`.
- Criar endpoint de simulação `POST /api/attendance/simulate-missed-clock-in`.
- Criar fluxo: funcionário respondeu opção 1/2/3/4/5.

## Frontend tasks

- Lista de ocorrências.
- Filtros por status/tipo/setor.
- Detalhe da ocorrência.
- Timeline.
- Ações: resolver, rejeitar, comentar.

## Critérios de aceite

- Sistema cria ocorrência de ponto não batido.
- Mock envia mensagem registrada em banco.
- Resposta simulada do funcionário atualiza timeline.
- RH visualiza ocorrência no painel.
