# Política de Confirmação Eletrônica do Espelho

O PresençaFlow adota o **aceite/confirmação simples** eletrônica do espelho de ponto mensal.

---

## Estrutura da Assinatura
- `documentHash`: Hash SHA-256 gerado a partir do conteúdo bruto do espelho. Caso o documento sofra qualquer edição posterior, o hash torna-se divergente, invalidando a assinatura anterior.
- `consentTextVersion`: Versão do texto legal de consentimento assinado pelo funcionário.
- **Diferenciação Legal**: A confirmação de aceite simples difere de assinaturas qualificadas e avançadas (com certificado digital ICP-Brasil), devendo ser validada em acordo coletivo.
