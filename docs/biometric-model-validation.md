# Validação e Limitações do Modelo Biométrico

Este documento descreve as capacidades técnicas, limitações e parâmetros do motor de reconhecimento facial do PresençaFlow.

---

## Modelo

| Parâmetro | Valor |
|---|---|
| Algoritmo | MobileFaceNet |
| Versão interna | MobileFaceNet-PresencaFlow-v1.4.2 |
| Tipo de output | Score de similaridade facial (0–100%) |
| Limiar padrão | 80.0% (configurável por empresa) |

## Capabilities e Status

| Capability | Status | Observação |
|---|---|---|
| Reconhecimento facial por similaridade | ✅ Implementado | Comparação selfie × foto de perfil cadastrada |
| Liveness Detection | ❌ NÃO IMPLEMENTADO | Não detecta apresentação de foto estática |
| Anti-Spoofing | ❌ NÃO IMPLEMENTADO | Não detecta ataques de apresentação (deepfake, foto, vídeo) |
| FAR (False Accept Rate) | ⚠ NOT_MEASURED | Não medido em dataset sintético |
| FRR (False Reject Rate) | ⚠ NOT_MEASURED | Não medido em dataset sintético |

## Interpretação do Score

- **≥ threshold**: Verificação confirmada (`CONFIRMED`)
- **< threshold**: Verificação divergente (`DIVERGENT`)
- **selfieUrl ausente com facial ativado**: `faceVerificationStatus = DIVERGENT`, `faceMatchScore = 0.0`

> O score de similaridade representa distância geométrica entre embeddings faciais normalizados. Não é uma prova jurídica de identidade e não deve ser comercializado como tal.

## Riscos Declarados

1. **Sem liveness**: Um atacante pode usar uma foto impressa ou na tela do celular para enganar o sistema.
2. **FAR/FRR não medidos**: Falsos positivos e falsos negativos em populações diversas (raça, iluminação, ângulo) não foram sistematicamente quantificados.
3. **Limiar fixo**: O mesmo limiar de 80% é aplicado a toda a empresa; colaboradores com câmeras de baixa qualidade ou condições de iluminação adversas podem ter FRR elevada.

## Roadmap de Hardening Biométrico

- [ ] Implementar liveness detection (SDK terceiro ou modelo próprio)
- [ ] Medir FAR e FRR em dataset sintético diverso
- [ ] Permitir configuração de limiar por grupo de colaboradores
- [ ] Registrar tentativas de spoofing como eventos de segurança auditáveis

## Dados Armazenados vs. Não Armazenados

| Dado | Armazenado | Observação |
|---|---|---|
| `selfieUrl` | ✅ Temporário | Limpo após `retentionDays` pelo job BIOMETRIC_CLEANUP |
| `faceMatchScore` | ✅ Permanente | Score numérico, não permite reconstrução do rosto |
| `faceVerificationStatus` | ✅ Permanente | CONFIRMED / DIVERGENT / NOT_VERIFIED |
| Template/Embedding facial | ❌ Nunca | Não é persistido em nenhuma tabela |
| Dados em logs | ❌ Nunca | Nenhum dado biométrico em logs, telemetria ou analytics |
