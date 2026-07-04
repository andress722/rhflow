# PresençaFlow Compliance & Regulatory Overview

Este documento consolida as diretrizes de governança, postura regulatória e controle técnico aplicadas ao PresençaFlow RH.

---

## Classificação do Sistema

| Dimensão | Posição |
|---|---|
| Tipo do sistema | Sistema de apoio operacional ao RH |
| Certificação REP-P / REP-A | ❌ Não certificado autonomamente |
| Exportação AFD | Geração técnica em layout Portaria 671 MTE — validação regulatória cabe à empresa |
| Assinatura eletrônica | Aceite simples (não assinatura qualificada ICP-Brasil) |
| Biometria | Dado sensível LGPD — requer governança explícita |
| IA Companion | Auxiliar operacional com controles determinísticos de acesso |

---

## Matriz de Capacidades

| Funcionalidade | Implementada | Validada tecnicamente | Certificação regulatória |
|---|---|---|---|
| Check-in remoto com evidência | ✅ | ✅ | ⚠ Pendente validação jurídica |
| Exportação layout AFD | ✅ | ✅ (estrutural) | ⚠ Não homologada MTE |
| Espelho de ponto | ✅ | ✅ | ⚠ Pendente acordo coletivo |
| Aceite eletrônico simples | ✅ | ✅ | ⚠ Não equivale a assinatura ICP-Brasil |
| Check-in offline com sync | ✅ | ✅ | ⚠ Pendente validação jurídica |
| Geofencing operacional | ✅ | ✅ | ⚠ Não usado como punição automática |
| Reconhecimento facial | ✅ | ✅ (similaridade) | ⚠ Sem liveness, FAR/FRR não medidos |
| Liveness / Anti-Spoofing | ❌ | ❌ | N/A |

---

## Postura de Comunicação

O PresençaFlow **não deve ser apresentado comercialmente como**:
- "Sistema homologado pelo MTE"
- "REP-P certificado"
- "Assinatura eletrônica com validade legal plena"
- "Biometria certificada"

O PresençaFlow **pode ser apresentado como**:
- "Sistema operacional de controle de presença com trilha de evidências digitais"
- "Exportação técnica em layout AFD compatível com Portaria 671 MTE"
- "Aceite eletrônico simples do espelho de ponto com hash de integridade"
- "Verificação de similaridade facial para presença remota"

---

## Documentos Regulatórios

| Documento | Arquivo |
|---|---|
| Classificação Regulatória | `time-tracking-regulatory-classification.md` |
| Validação Técnica AFD | `afd-technical-validation.md` |
| Evidência Offline | `offline-time-evidence-policy.md` |
| Geofencing | `geofencing-evidence-policy.md` |
| Aceite Eletrônico | `electronic-acceptance-evidence-policy.md` |
| Política Biométrica LGPD | `biometric-data-policy.md` |
| Validação do Modelo Biométrico | `biometric-model-validation.md` |
| Segurança do AI Companion | `ai-companion-security-policy.md` |
| Segurança Developer API | `developer-api-security-policy.md` |
| Este documento | `compliance-overview.md` |

---

## Próximos Passos para Conformidade Regulatória

1. Contratar consultoria jurídica trabalhista para validar o uso do AFD como fonte de dados.
2. Negociar com sindicatos (se aplicável) o uso de aceite eletrônico como substituto ao espelho físico.
3. Elaborar RIPD (Relatório de Impacto à Proteção de Dados) para uso da biometria.
4. Implementar liveness detection antes de qualquer expansão comercial de biometria.
5. Auditar FAR/FRR do modelo biométrico com dataset sintético diverso.
