# Playbook de Conversão de Clientes Piloto

Este documento serve como guia operacional e comercial para orientar o time de Suporte, Sucesso do Cliente (CS) e Vendas (SUPER_ADMIN) no acompanhamento, qualificação e conversão de empresas piloto em assinaturas ativas na plataforma PresençaFlow.

---

## 🎯 1. Objetivo da Conversão de Piloto

O programa piloto tem como objetivo demonstrar o valor prático da plataforma PresençaFlow nos primeiros dias de adoção pelo cliente (geralmente nos primeiros 7 a 30 dias). 
A conversão foca em:
1. Validar a ativação técnica (integração do WhatsApp, importação de funcionários, parametrização de jornadas).
2. Estimular o engajamento e adesão dos funcionários na batida de ponto remota (taxa de resposta).
3. Gerar dados reais de telemetria operacional (ocorrências, atestados) para embasar a proposta comercial de fechamento de contrato.

---

## 🔄 2. Ciclo de Vida e Definições de Status (Fisologia do Funil)

Os status do piloto em `Company.pilotStatus` devem ser atualizados conforme as etapas abaixo:

### NOT_STARTED (Não Iniciado)
* **Quando aplicar**: Logo após a criação da empresa no sistema, antes do início efetivo de qualquer teste prático.
* **Ação**: O time de suporte inicia a parametrização inicial da empresa.

### ACTIVE (Ativo / Em Teste)
* **Quando aplicar**: No momento do kick-off técnico (primeiro disparo de check-in remoto feito com sucesso ou primeiro funcionário ativo batendo ponto).
* **Regra automática**: O backend preenche a data atual (`pilotStartedAt`) se estiver vazia. Limpa qualquer `pilotLostReason`.
* **Foco**: Garantir que a empresa atinja o *Readiness Score* recomendado para que o piloto rode com o menor nível de atrito possível.

### PROPOSAL_SENT (Proposta Enviada)
* **Quando aplicar**: Após o período de avaliação (ou próximo do fim), quando o time comercial gera e envia a proposta financeira e o resumo operacional.
* **Regra automática**: O backend preenche a data atual (`proposalSentAt`) se estiver vazia. Limpa qualquer `pilotLostReason`.

### WON (Ganho / Convertido em Assinatura)
* **Quando aplicar**: No momento em que o cliente aceita formalmente a proposta comercial e fecha o contrato.
* **Regra automática**: O backend preenche a data atual (`convertedAt`) se estiver vazia. Limpa qualquer `pilotLostReason`.
* **Importante**: A ativação comercial não aciona faturamento recorrente automático (billing com gateway de pagamento online) nesta sprint; ela apenas marca a conversão operacional. Se houver necessidade de habilitar planos superiores, deve ser feito o update manual de plano (`planId`).

### LOST (Perdido / Cancelado)
* **Quando aplicar**: Quando o cliente decide descontinuar o uso da plataforma durante o piloto ou rejeita a proposta final.
* **Requisito Obrigatório**: É **obrigatório** preencher o campo `pilotLostReason` com o motivo da perda. A data `convertedAt` é limpa.

---

## ❌ 3. Motivos Comuns de Perda comercial (LOST)

Ao marcar um piloto como `LOST`, identifique e registre o motivo real para análise futura. Os motivos mais comuns incluem:
* **Falta de engajamento da liderança**: Supervisores e gerentes não acompanharam os alertas de check-in e ocorrências pendentes.
* **Resistência dos colaboradores**: Funcionários se recusaram a usar o canal de WhatsApp para justificar ou responder check-ins.
* **Preço / Orçamento**: O custo do plano por usuário excedeu o orçamento aprovado do cliente.
* **Mudança de prioridade interna**: Reestruturação no RH ou na diretoria do cliente que postergou o projeto de automação de ponto.
* **Concorrência**: Opção por outro software ou manutenção do controle de ponto tradicional (físico/manual).

---

## 📊 4. Como usar o Health Score e Riscos na Proposta

O **Health Score** da PresençaFlow (calculado dinamicamente pelo `CustomerSuccessService`) mede o engajamento operacional da empresa piloto nos últimos 7 dias. Ele varia de 0 a 100 e deve ser usado comercialmente como argumento de venda:

* **HEALTHY (Score >= 70)**: 
  * *Argumento*: A operação está rodando muito bem. A taxa de adesão é alta e os gerentes estão resolvendo pendências rapidamente. É o momento perfeito para fechamento rápido.
* **ATTENTION (Score 40-69)**: 
  * *Argumento*: Identifique onde estão os gargalos (ex: baixa taxa de resposta ou atestados acumulados) e ofereça uma sessão extra de suporte rápido como bônus na assinatura para normalizar o uso.
* **CRITICAL (Score < 40)**: 
  * *Argumento*: Indica que o piloto corre risco de cancelamento. Não force a assinatura sem antes realizar uma reunião de alinhamento com os administradores da empresa para entender as dificuldades técnicas ou operacionais.

### Interpretação de Riscos
O resumo da proposta exibe os riscos operacionais calculados (como `NO_ACTIVITY_7D` ou `LOW_RESPONSE_RATE`). Use-os de forma consultiva: mostre ao cliente que a plataforma detecta e avisa proativamente os problemas de conformidade de ponto que a empresa sofria antes de informatizar a rotina.

---

## 📝 5. Resumo Operacional da Proposta Comercial

Para facilitar a geração da proposta, use o botão **"Gerar Resumo Operacional"** na tela de gestão de pilotos. Ele gera um texto em Markdown contendo:
* Número de colaboradores ativos engajados.
* Taxa de resposta de check-ins no período.
* Ocorrências geradas e tratadas (evidência de conformidade).
* Atestados revisados e relatórios extraídos pelo RH.

> [!TIP]
> Copie o texto Markdown gerado e anexe-o diretamente à sua proposta comercial ou no e-mail de fechamento para provar o retorno sobre o investimento (ROI) obtido pela empresa durante o período de testes.

---

## 🗓️ 6. Rotina Semanal de Conversão (Recomendada)

1. **Segunda-feira**: Filtrar pilotos com status `ACTIVE` e com data de término (`pilotEndsAt`) nos próximos 7 dias. Avaliar o Health Score de cada um.
2. **Terça-feira**: Entrar em contato com pilotos saudáveis (`HEALTHY`), gerando o resumo operacional para enviar a proposta formal (`PROPOSAL_SENT`).
3. **Quarta-feira / Quinta-feira**: Para pilotos em estado de atenção (`ATTENTION` ou `CRITICAL`), agendar call rápida de suporte/ajuste e alinhar com o RH.
4. **Sexta-feira**: Atualizar o status das propostas respondidas para `WON` (e alterar plano se necessário) ou `LOST` (preenchendo a justificativa detalhada).

---

## ⚠️ 7. Limites Operacionais da Sprint 25

* **Sem cobrança automática**: Não há processamento de cartão de crédito, emissão de boletos ou integração de Pix nesta sprint. 
* **Conversão Manual**: A ativação da assinatura é puramente declarativa no banco de dados para controle de funil e liberação de acesso (limites de plano).
* **Exposição de Dados**: Os dados comerciais e métricas do piloto (notas comerciais, data de envio de proposta) são restritos ao `SUPER_ADMIN`. Administradores normais das empresas (ADMIN/HR) não têm acesso a essas informações para manter a discrição comercial da plataforma.
