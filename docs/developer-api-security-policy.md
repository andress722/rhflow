# Segurança de Chaves de API e Webhooks — Developer Portal

Diretrizes de segurança para criação, uso e revogação de chaves de API e webhooks no PresençaFlow.

---

## API Keys

### Ciclo de Vida

| Campo | Descrição |
|---|---|
| `keyPrefix` | Prefixo legível (`pf_live_XXXX`) exibido nas listagens |
| `secretHash` | Hash SHA-256 do token completo — **único dado persistido no banco** |
| `scopes` | Lista de escopos autorizados (ex: `["presence:read", "employees:read"]`) |
| `isActive` | Se a chave está ativa |
| `expiresAt` | Data de expiração opcional |
| `revokedAt` | Data de revogação (set quando a chave é desativada antes de expirar) |
| `lastUsedAt` | Última utilização (atualizado a cada requisição autenticada) |

### Segurança

- **Raw key nunca persistida**: O token completo (`pf_live_XXXX.YYYY`) é retornado **uma única vez** na resposta de criação e jamais é armazenado em texto plano.
- **Hash SHA-256**: Apenas o hash SHA-256 do token é salvo. Não é reversível.
- **Apresentação**: O cliente deve armazenar o token com segurança (cofre de credenciais, variável de ambiente). Não é recuperável após a tela de criação.

### Autenticação via API Key

```http
GET /api/... HTTP/1.1
Authorization: Bearer pf_live_XXXX.YYYY
```

O backend computa SHA-256 do token recebido e compara com o `secretHash` armazenado.

---

## Webhooks

### Assinatura HMAC

Cada evento entregue pelo PresençaFlow inclui o cabeçalho:

```
X-PresencaFlow-Signature-256: sha256=<hmac_hex>
X-PresencaFlow-Timestamp: <unix_timestamp_ms>
```

O servidor destino deve:
1. Computar `HMAC-SHA256(secretToken, payload_body)`.
2. Comparar com o valor em `X-PresencaFlow-Signature-256` usando comparação constante (evitar timing attacks).
3. Verificar que `X-PresencaFlow-Timestamp` está dentro de uma janela de **5 minutos** para rejeitar replays.

### Proteção contra Replay

```typescript
const isStale = Date.now() - webhookTimestamp > 5 * 60 * 1000;
if (isStale) throw new Error('Webhook replay rejeitado: evento fora da janela de 5 minutos');
```

### Rotação do Secret

O `secretToken` do webhook é gerado no momento da criação (`whsec_XXXX`) e não pode ser recuperado depois. Para rotacionar: excluir e recriar a inscrição de webhook.

### Logs de Entrega

`deliveryLogsEnabled = true` na inscrição ativa o registro de tentativas de entrega para fins de auditoria e retry.

---

## Nomenclatura Correta

| ❌ Evitar | ✅ Usar |
|---|---|
| "API Key criptografada" | "API Key hasheada com SHA-256" |
| "Senha segura" | "Chave de API com hash SHA-256 irrecuperável" |
| "Signature hash" | "Assinatura HMAC-SHA256" |
