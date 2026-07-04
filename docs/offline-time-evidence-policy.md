# Política de Evidência de Ponto Offline

O PresençaFlow implementa marcação de jornada local offline de forma robusta e auditável.

---

## Metadados do Registro Offline
- `offlineEventId`: UUID exclusivo gerado no momento da marcação no dispositivo do colaborador.
- `clientCapturedAt`: Data/hora local no fuso horário do dispositivo capturado antes da sincronização.
- `clockDriftSeconds`: Diferença calculada entre o horário do dispositivo (clientCapturedAt) e o horário de recebimento (serverReceivedAt).
- **Tratamento de Anomalias**: Diferenças maiores que 60 segundos marcam o status como `ACCEPTED_WITH_WARNING` para revisão manual.
