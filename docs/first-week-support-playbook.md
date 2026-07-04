# Playbook de Suporte e Acompanhamento na Primeira Semana (D+7)

Este playbook orienta o time de Customer Success e Operações de Suporte no monitoramento inicial do primeiro cliente piloto ativo.

---

## 1. Rotina Diária de Telemetria (Checklist Diário)

1. **Checagem do Command Center (9h):**
   - Acesse o Command Center do `SUPER_ADMIN` e monitore a contagem de falhas de envio de mensagens nas últimas 24h.
2. **Saúde da Empresa (Health Score):**
   - Acompanhe a taxa de resposta dos check-ins diários (mínimo de 60% esperado para um piloto engajado).
3. **Erros de Sistema e Jobs:**
   - Acesse **Rotinas e Jobs** (`/app/admin/jobs`) e certifique-se de que os jobs `REMOTE_CHECKIN_BATCH` e `MARK_NOT_RESPONDED` executaram pontualmente.

---

## 2. Indicadores de Risco de Engajamento

- **Falta de Resposta Sistêmica (Sinal Vermelho):**
  - Taxa de resposta de check-ins acumulada de 7 dias abaixo de 40%.
  - Ação: CS deve entrar em contato com o RH da empresa para verificar se os telefones dos colaboradores estão corretos ou se houve problema no número corporativo.
- **Acúmulo de Atestados não Homologados (Sinal Amarelo):**
  - Mais de 5 atestados médicos pendentes na fila do cliente há mais de 48h.
  - Ação: Recomendar ao RH a revisão e homologação no sistema.

---

## 3. Matriz de Escalação de Incidentes

| Tipo de Incidente | Sintoma | Responsável primário | Ação Técnico / Comercial |
| :--- | :--- | :--- | :--- |
| **Erro de Cadastro** | Funcionário com DDD ou CPF errado | Suporte L1 (CS) | Corrigir diretamente via interface do usuário. |
| **Erro de Conexão WhatsApp** | Canal desconectado | Operações de Infra | CS apoia o cliente para refazer a leitura do QR Code. |
| **Erro de Banco/API** | Travamentos ou Erro 500 | Engenharia (L3) | Acionar comitê técnico para analisar stack do OperationalErrorLog. |
