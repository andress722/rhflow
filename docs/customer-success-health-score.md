# Documentação do Health Score de Sucesso do Cliente Piloto

Este documento descreve os objetivos, critérios de cálculo, indicadores de risco, recomendações e a rotina operacional recomendada para o acompanhamento da primeira semana de implantação de um cliente piloto no PresençaFlow.

---

## 🎯 1. Objetivo do Health Score

O **Health Score** é um indicador operacional dinâmico que varia de **0 a 100**. Seu propósito é medir a **prontidão, adoção, engajamento e estabilidade técnica** da empresa piloto durante os primeiros dias e semanas de uso. Ele serve para:
1. Identificar gargalos de implantação antes do lançamento oficial.
2. Detectar riscos de baixo engajamento dos colaboradores em tempo real.
3. Alertar sobre eventuais falhas críticas na infraestrutura de envio (erros de WhatsApp ou erros do sistema).
4. Auxiliar a equipe de Suporte (SUPER_ADMIN) a priorizar contatos proativos de Customer Success.

---

## 🧮 2. Como o Score é Calculado

O score é dividido em 4 pilares principais, somando no máximo 100 pontos:

### A) Adoção e Uso — Até 40 Pontos
* **Colaboradores Ativos Cadastrados**: `+15 pontos` se houver pelo menos 1 funcionário com status `ACTIVE`.
* **Disparo de Check-ins nos últimos 7 dias**: `+15 pontos` se houver pelo menos 1 check-in enviado no período (se o recurso de check-in remoto estiver habilitado). Caso esteja desabilitado, os pontos são concedidos automaticamente.
* **Atividade Operacional Recente**: `+10 pontos` se houver qualquer registro recente (últimos 7 dias) de logins, check-ins, ocorrências, atestados ou logs de auditoria.

### B) Resposta dos Funcionários (Engajamento) — Até 25 Pontos
Mede a taxa de resposta dos colaboradores aos disparos de check-in remoto de presença nos últimos 7 dias (`responseRate7d`):
* `responseRate7d >= 75%`: `+25 pontos` (Adoção Excelente)
* `responseRate7d` entre `50%` e `74%`: `+15 pontos` (Adoção Moderada)
* `responseRate7d` entre `25%` e `49%`: `+8 pontos` (Adoção Baixa)
* `responseRate7d < 25%`: `+0 pontos` (Adoção Crítica)

*Nota: Se o check-in remoto estiver desabilitado no CompanySettings, os 25 pontos são concedidos de forma a não penalizar a empresa.*

### C) Operação sem Erros Críticos (Estabilidade) — Até 20 Pontos
* **Canal WhatsApp Saudável**: `+10 pontos` se o canal estiver conectado (`CONNECTED`), em simulação (`SIMULATION`) ou operando com provedor simulado (`SIMULATED`). Se o status for `ERROR` ou `DISCONNECTED`, soma `0 pontos`.
* **Erros de Disparo (WhatsApp)**: `+5 pontos` se houver zero mensagens com erro (`FAILED`) em 7d. Se houver entre 1 e 5 erros, soma `+3 pontos`.
* **Erros de Sistema (Log de Erros)**: `+5 pontos` se houver zero erros operacionais (`OperationalErrorLog`) em 7d. Se houver entre 1 e 5 erros, soma `+3 pontos`.

### D) Gestão e Relatórios (Liderança do Cliente) — Até 15 Pontos
* **Uso de Relatórios**: `+5 pontos` se houver consultas ou exportações de relatórios nos últimos 7 dias ou histórico registrado.
* **Tratamento de Ocorrências**: `+5 pontos` se houver zero ocorrências abertas (`OPEN`) ou pelo menos 1 ocorrência resolvida nos últimos 7 dias.
* **Módulo de Atestados**: `+5 pontos` se o módulo estiver desligado ou, se estiver ligado, se houver zero atestados pendentes de análise (`RECEIVED`) ou pelo menos 1 atestado revisado nos últimos 7 dias.

---

## 🚦 3. Classificação de Status

* **🟢 HEALTHY (Saudável)**: Health Score `>= 80` **E** nenhum sinal de risco com severidade `HIGH`.
* **🟡 ATTENTION (Atenção)**: Health Score entre `50` e `79` **OU** pelo menos 1 sinal de risco com severidade `MEDIUM`.
* **🔴 CRITICAL (Crítico)**: Health Score `< 50` **OU** qualquer sinal de risco com severidade `HIGH`.

---

## 🚨 4. Risk Signals (Sinais de Risco)

O sistema gera alertas automáticos com base no comportamento da empresa:
* **`NO_ACTIVE_EMPLOYEES` (HIGH)**: Nenhum colaborador ativo cadastrado.
* **`NO_ACTIVE_SCHEDULES` (HIGH)**: Nenhuma jornada de trabalho (escala) ativa cadastrada.
* **`WHATSAPP_ERROR` (HIGH)**: O canal de WhatsApp está em status de falha (`ERROR`).
* **`LOW_RESPONSE_RATE`**:
  * **HIGH**: Taxa de resposta abaixo de 25%.
  * **MEDIUM**: Taxa de resposta abaixo de 50%.
* **`NO_RECENT_CHECKINS` (HIGH/MEDIUM)**: Nenhum check-in enviado nos últimos 7 dias (com check-in remoto habilitado).
* **`MANY_OPERATIONAL_ERRORS`**:
  * **HIGH**: Mais de 10 erros operacionais nos últimos 7 dias.
  * **MEDIUM**: Mais de 2 erros operacionais.
* **`MANY_OPEN_OCCURRENCES` (MEDIUM)**: Mais de 5 ocorrências pendentes sem tratamento.
* **`PENDING_MEDICAL_CERTIFICATES` (MEDIUM)**: Atestados recebidos acumulados sem revisão.
* **`NO_REPORT_ACTIVITY` (MEDIUM)**: O RH não realizou nenhuma consulta ou exportação de relatórios.

---

## 💡 5. Recommendations (Recomendações Acionáveis)

Para restabelecer a integridade da operação do cliente piloto, as seguintes recomendações são fornecidas:
1. **`IMPORT_EMPLOYEES` (HIGH)**: Importar a lista de colaboradores piloto para a plataforma.
2. **`CONFIGURE_SCHEDULES` (HIGH)**: Criar e associar escalas de horários para os funcionários.
3. **`ASSIGN_MANAGERS` (MEDIUM)**: Configurar gestores operacionais responsáveis pelos funcionários.
4. **`TEST_WHATSAPP` (HIGH)**: Validar a conexão da API de WhatsApp.
5. **`SEND_FIRST_CHECKIN` (HIGH)**: Enviar o primeiro disparo de presença piloto para homologar a comunicação.
6. **`REVIEW_OPEN_OCCURRENCES` (MEDIUM)**: Acessar a tela de ocorrências para validar justificativas e abonos.
7. **`REVIEW_MEDICAL_CERTIFICATES` (MEDIUM)**: Analisar atestados de afastamento pendentes de auditoria médica.
8. **`EXPORT_FIRST_REPORT` (MEDIUM)**: Visualizar ou exportar o primeiro relatório consolidado.
9. **`OPEN_ONBOARDING` (LOW)**: Revisar o status de prontidão técnica no Checklist geral de onboarding.

---

## 📅 6. Rotina Recomendada para a Primeira Semana

Para garantir o sucesso do piloto, siga este cronograma:
* **Dia 1 (Go-Live)**: Acompanhar o primeiro disparo de check-in remoto. Intervir se a taxa de resposta for `< 50%` nas primeiras 4 horas.
* **Dia 3 (Acompanhamento)**: Verificar se há ocorrências acumuladas. Se houver `MANY_OPEN_OCCURRENCES`, treinar os gestores operacionais no fluxo de resolução.
* **Dia 5 (Homologação)**: Acessar a tela de relatórios gerenciais e exportar o PDF consolidado com o RH para alinhar o formato de fechamento do ponto.

---

## ⚠️ 7. Limitações do Score e Aviso Legal

> [!CAUTION]
> **AVISO LEGAL E LIMITAÇÕES DO SCORE**:
> 1. **Métrica Puramente Operacional**: O Health Score é uma ferramenta interna de Customer Success para medir engajamento técnico e engajamento da equipe piloto. Ele **NÃO** representa, sob nenhuma hipótese, conformidade jurídica trabalhista, auditoria de ponto legal, ou cumprimento de regras da CLT (Consolidação das Leis do Trabalho).
> 2. **Sem Validade de Auditoria Trabalhista**: O score não valida se as escalas ou horas extras atendem à convenção coletiva do cliente ou à legislação fiscal.
> 3. **Interrupções Técnicas**: Instabilidades de rede, celulares sem bateria ou bloqueio de chip no WhatsApp distorcem temporariamente a taxa de resposta e o score, sem que isso signifique insatisfação do cliente ou desídia do colaborador.
