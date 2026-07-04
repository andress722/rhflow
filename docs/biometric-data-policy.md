# Política de Privacidade e Governança Biométrica (LGPD)

O tratamento de dados biométricos sensíveis no PresençaFlow segue diretrizes estritas de minimização, governança e transparência, em conformidade com a LGPD (Lei 13.709/2018).

---

## Princípios Gerais

- **Dado sensível**: Biometria (imagem de rosto, template facial) é dado pessoal sensível conforme Art. 5º, II da LGPD.
- **Base legal exigida**: A empresa deve declarar explicitamente a base legal para o tratamento (consentimento, interesse legítimo, cumprimento de obrigação legal) antes de ativar o módulo.
- **Finalidade limitada**: O processamento é restrito à verificação de identidade para fins de controle de presença. Vedado uso para outras finalidades sem nova base legal.

## Governança por Empresa

A tabela `BiometricProcessingConfiguration` registra para cada empresa:

| Campo | Descrição |
|---|---|
| `enabled` | Se o processamento biométrico está ativo |
| `purpose` | Finalidade declarada (ex: "Autenticação de presença remota") |
| `legalBasisDeclared` | Base legal (LGPD Art. 11) |
| `retentionDays` | Prazo de retenção das selfies (padrão: 30 dias) |
| `alternativeMethodAvailable` | Obrigatório `true` para não excluir colaboradores com problemas de hardware |
| `threshold` | Limiar de similaridade biométrica aceito (padrão: 80.0%) |
| `policyVersion` | Versão do documento de política aceita |
| `activatedAt` / `activatedByUserId` | Rastreabilidade da ativação |

## Minimização e Limpeza

- **Job `BIOMETRIC_CLEANUP`**: Executado periodicamente, remove os campos `selfieUrl` dos check-ins após o prazo de retenção **por empresa** (`retentionDays`).
- **Template/Embedding**: Nenhum template biométrico ou embedding facial é persistido. Apenas o score de similaridade (`faceMatchScore`) e o status (`faceVerificationStatus`) são registrados.
- **Logs**: Nenhum dado biométrico individual (selfieUrl, template) é incluído em logs de sistema, telemetria ou analytics.

## Alternativa Não Biométrica

Obrigatória quando `enabled = true`. O colaborador deve sempre ter uma via alternativa de registro de presença disponível (ex: código de confirmação, registro manual pelo gestor), para evitar exclusão por falha de dispositivo ou recusa ao uso de biometria.

## Capabilities Declaradas

| Capability | Status |
|---|---|
| Reconhecimento facial por similaridade | Implementado |
| Liveness / Anti-Spoofing | **NÃO IMPLEMENTADO** nesta versão |
| FAR (False Accept Rate) | NOT_MEASURED |
| FRR (False Reject Rate) | NOT_MEASURED |
| Modelo | MobileFaceNet-PresencaFlow v1.4.2 |

> **Atenção**: As métricas FAR e FRR não foram medidas em datasets populacionais sintéticos. O score biométrico representa similaridade geométrica facial e não deve ser comercializado como "certeza de identidade".

## Limitações Regulatórias

- O PresençaFlow **não é certificado** como sistema biométrico regulado por norma específica (ex: ABNT NBR ISO/IEC 19795).
- A adoção deve ser precedida de análise jurídica especializada, negociação coletiva (se aplicável) e registro no Relatório de Impacto à Proteção de Dados Pessoais (RIPD) da empresa.
