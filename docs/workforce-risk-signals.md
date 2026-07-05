# Workforce Risk Signals - Sinais de Risco Operacional

Esta documentação descreve a arquitetura, regras de cálculo e aviso legal da funcionalidade **Workforce Risk Signals** (Sinais de Risco Operacional) do PresençaFlow RH.

---

## 1. Contexto e Classificação
Esta funcionalidade fornece indicadores auxiliares para ajudar gestores e profissionais de Recursos Humanos a monitorar e apoiar a retenção da equipe.
* **Classificação Técnica**: Heurística de Risco Operacional.
* **Inteligência Artificial**: Esta funcionalidade **não** utiliza modelos generativos ou de caixa-preta baseados em redes neurais profundas na produção para predizer desligamentos de forma autônoma. Todo cálculo é baseado em pesos heurísticos simples determinados a partir dos dados do colaborador.
* **Revisão Humana Obrigatória**: Esta funcionalidade é puramente consultiva, exigindo avaliação manual direta e proibindo o uso isolado para tomada de decisões disciplinares, promocionais, demissionais ou contratuais.

---

## 2. Metodologia de Cálculo
A heurística avalia dados consolidados do colaborador nos últimos **30 dias**:

1. **Assiduidade (Ausências)**:
   - Identifica check-ins remotos marcados com status de falta (`ABSENCE_REPORTED`).
   - Peso por falta: +20 pontos de risco.
   - Código do fator: `ABSENCE_TREND`

2. **Pontualidade (Atrasos)**:
   - Identifica check-ins remotos marcados com status de atraso (`LATE`).
   - Peso por atraso: +8 pontos de risco.
   - Código do fator: `LATE_TREND`

3. **Pesquisas de Clima (Pulse Surveys)**:
   - Identifica respostas de pesquisas pulse com notas muito baixas (score menor ou igual a 2).
   - Peso por resposta baixa: +25 pontos de risco.
   - Código do fator: `LOW_CLIMATE_SURVEY`

O score inicial de linha de base é **15%**. A pontuação final é limitada ao teto de **100%**.

### Classificação do Nível de Risco:
- **LOW** (Baixo): score de 15% a 30%.
- **MODERATE** (Médio): score de 31% a 70%.
- **HIGH** (Alto): score acima de 70%.

---

## 3. Especificação das Rotas da API

### Rota Nova e Semântica:
`GET /api/employees/:id/workforce-risk-signals`
Retorna os fatores calculados com weights e observedValue.

### Rota Legada (Alias Deprecado):
`GET /api/employees/:id/turnover-risk`
Mantida exclusivamente para retrocompatibilidade com clientes legados. Delegada internamente para o mesmo serviço, retornando ambos os formatos para evitar quebras. Marcada no código como `@deprecated`.

---

## 4. Termo de Isenção de Responsabilidade (Disclaimer)
> [!IMPORTANT]
> **Aviso Legal:** Os sinais de risco apresentados são indicadores auxiliares derivados de heurísticas de assiduidade e clima organizacional. Eles não devem ser utilizados de forma automatizada ou isoladamente para justificar rescisões, punições ou qualquer tipo de sanção trabalhista. A revisão por parte do gestor e do setor de RH é indispensável.
