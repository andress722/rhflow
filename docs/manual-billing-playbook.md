# Playbook de Faturamento Manual, Contratos e Assinaturas (Sprint 26)

Este documento descreve as rotinas operacionais, processos administrativos e limites do sistema de faturamento manual e controle de contratos do PresençaFlow RH.

---

## 1. Visão Geral & Limitações

A camada de faturamento da Sprint 26 é estritamente **administrativa e operacional**. Ela foi desenhada para permitir que a equipe comercial e financeira acompanhe o status financeiro de clientes pós-conversão sem introduzir integrações complexas com gateways de pagamento online nesta fase.

> [!WARNING]
> **Limitações do Escopo (O que NÃO está implementado):**
> - **Sem Gateway de Pagamento:** Não há processamento de cartão de crédito online ou débito automático.
> - **Sem Boleto Automático:** O sistema não gera ou envia boletos bancários para os clientes.
> - **Sem Emissão Fiscal:** Não há integração com prefeituras ou SEFAZ para emissão automática de notas fiscais de serviço (NFS-e).
> - **Sem E-mail de Cobrança Automático:** A plataforma não dispara alertas de vencimento ou links de pagamento para o e-mail do cliente final.
> - **Conciliação Externa:** Todas as cobranças reais e conciliações devem ser realizadas de forma manual e externa (ex: via banco, ERP financeiro da empresa ou ferramenta de faturamento dedicada).

---

## 2. Diferença de Status: Técnico (Legado) vs. Financeiro (Manual)

O PresençaFlow mantém duas visões independentes de status de assinatura:

1. **Status Técnico (`SubscriptionStatus` legado em `CompanySubscription.status`):**
   - É o controle técnico que dita se a plataforma está habilitada ou bloqueada para uso dos funcionários do cliente (ex: `ACTIVE`, `PAST_DUE`, `CANCELLED`).
   - Esta sprint não altera este campo de forma automática a fim de evitar bloqueios operacionais indesejados. O status técnico permanece em `ACTIVE` por padrão.
2. **Status Financeiro (`billingStatus` e `effectiveBillingStatus`):**
   - É o controle comercial/financeiro manual feito pelo SUPER_ADMIN.
   - Serve para acompanhar contratos, faturamento offline e adimplência.

### Ciclo de Vida Financeiro (Billing Status)
- **TRIAL:** Período de testes padrão de novos clientes cadastrados.
- **ACTIVE:** Assinatura ativa, indicando que o cliente está com os pagamentos em dia e o serviço habilitado.
- **PAYMENT_PENDING:** Aguardando pagamento. Utilizado para controle operacional durante o período de envio da cobrança manual/boleto bancário gerado fora da plataforma.
- **OVERDUE:** Assinatura vencida.
- **CANCELED:** Assinatura cancelada administrativamente. Exige justificativa detalhada e bloqueia faturamento.

> [!NOTE]
> **Status Efetivo (`effectiveBillingStatus`):**
> É o status computado em tempo de execução. O sistema avalia se a data de vencimento da próxima fatura (`nextBillingAt`) já passou em relação ao dia atual. Se `nextBillingAt < hoje` e o `billingStatus` persistido estiver como `ACTIVE` ou `PAYMENT_PENDING`, o status efetivo retornado será **OVERDUE** (Inadimplente). Assinaturas no status **CANCELED** nunca viram **OVERDUE** mesmo se a data de vencimento for passada.

---

## 3. Rotinas Operacionais

### A. Ativação de Assinatura Manual
Quando uma empresa aceita a proposta comercial e decide assinar:
1. O SUPER_ADMIN acessa a tela de **Gestão de Pilotos** e marca a empresa como `WON` (Ganhador).
2. Em seguida, acesse o menu **Faturamento e Contratos** no painel de `SUPER_ADMIN` e localize a empresa.
3. Se a empresa não possuir um registro de faturamento (CompanySubscription), o sistema exibirá um estado vazio controlado. Ao preencher o formulário do drawer lateral e clicar em **Salvar**, o sistema criará o registro de assinatura associando o plano padrão (ex: `STARTER`).
4. Preencha a data do início da assinatura, o valor negociado e salve.

### B. Registro de Contratos
Ao converter um piloto, o SUPER_ADMIN deve registrar o fluxo contratual:
1. Preencha a data em **Contrato Enviado em** assim que enviar o documento jurídico para assinatura.
2. Quando o cliente assinar o contrato, preencha o campo **Contrato Assinado em** e altere o status para **ACTIVE**.
3. Salve as alterações.

### C. Gestão de Assinatura Ativa
No drawer de detalhes da empresa, defina:
- **Valor Contratado:** O valor mensal bruto acordado em contrato. Digite o valor em Reais (ex: `1250.00` para R$ 1.250,00). O banco salvará o valor correspondente em centavos (`125000`).
- **Ciclo de Faturamento:** Escolha entre **Mensal**, **Trimestral** ou **Anual**.
- **Próximo Vencimento:** Defina a data da próxima fatura (`nextBillingAt`). O sistema usará essa data para monitorar atrasos.

### D. Processo de Cancelamento de Assinatura
Caso o cliente decida cancelar o serviço ou ocorra rescisão contratual:
1. No drawer financeiro, altere o campo **Status Cobrança** para **Cancelado**.
2. O sistema abrirá uma seção de cancelamento.
3. Preencha obrigatoriamente a **Justificativa de Cancelamento** (motivos como preço, perda de fit do produto, encerramento da empresa cliente, etc.).
4. Insira a **Data de Cancelamento** (por padrão, se vazia, o sistema preencherá com o momento atual).
5. Salve. O sistema automaticamente limpará os motivos/datas se a assinatura for reativada futuramente.

---

## 4. Cálculo de Receita Mensal Contratada (MRR)

O painel de faturamento exibe a receita recorrente totalizada baseando-se apenas em clientes que estão gerando faturamento.

- **Fórmula do MRR:** Somatório do equivalente mensal (`monthlyEquivalentCents`) de todas as assinaturas nos status `ACTIVE` ou `PAYMENT_PENDING`.
- **Exclusões:** Clientes nos status `TRIAL` (em testes) ou `CANCELED` (cancelados) são **desconsiderados** no cálculo da receita mensal.
- **Normalização de Ciclos:**
  - `MONTHLY` (Mensal): `contractedAmountCents`
  - `QUARTERLY` (Trimestral): `Math.round(contractedAmountCents / 3)`
  - `YEARLY` (Anual): `Math.round(contractedAmountCents / 12)`

---

## 5. Regras e Validações de Segurança

Para evitar inconsistências no banco de dados e garantir a segurança operacional, as seguintes regras são aplicadas no backend:

- **Não-negatividade:** O valor em centavos (`contractedAmountCents`) é validado estritamente para ser igual ou superior a `0`.
- **Limite Máximo:** O valor em centavos (`contractedAmountCents`) não pode exceder `100.000.000` (R$ 1.000.000,00).
- **Ordem de Datas:**
  - `contractSignedAt` >= `contractSentAt` (data de assinatura deve ser posterior ao envio).
  - `subscriptionStartedAt` >= `contractSignedAt` (início da assinatura deve ser posterior à assinatura do contrato).
  - `canceledAt` >= `subscriptionStartedAt` (cancelamento deve ser posterior ao início da assinatura).
- **Auditoria Rígida:** Qualquer alteração no faturamento dispara uma entrada na tabela de `AuditLog` com o tipo `BILLING_ACCOUNT_UPDATED`. A fim de preservar a segurança dos logs e não estourar tamanhos de campos, anotações e justificativas completas não são salvas brutas na tabela de logs; em vez disso, registramos booleanos sinalizadores (ex: `financeNotesChanged: true` e `cancellationReasonChanged: true`).
