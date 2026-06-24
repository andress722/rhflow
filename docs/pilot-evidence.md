# Registro de Evidências do Piloto (Pilot Evidence)

Este documento registra formalmente a validação de homologação e a execução de testes do piloto do PresençaFlow RH para subsidiar a tomada de decisão comercial e técnica de implantação.

---

## 💻 1. Metadados do Ambiente

* **Ambiente de Teste:** Homologação Local (Staging-like) / Staging
* **URL Frontend:** `http://localhost:3000` (Staging: `https://staging.presencaflow.com`)
* **URL API (Backend):** `http://localhost:3001` (Staging: `https://api-staging.presencaflow.com`)
* **Data/Hora da Execução:** 21/06/2026 às 02:00 BRT
* **Build/Commit Hash:** `sprint-15-release-candidate-v1.0.3`
* **Versão Backend:** `v1.0.3`
* **Versão Frontend:** `v1.0.3`

---

## 👥 2. Participantes e Usuários Envolvidos

* **Empresa Piloto:** Empresa Teste Comercial Ltda (CNPJ: `992606210000`)
* **Usuário Super Admin:** `superadmin@presencaflow.com` (Responsável pela Plataforma)
* **Usuário Admin da Empresa:** `admin.comercial@empresateste.com` (Responsável pelo DP/RH)
* **Usuário Manager:** `gestor.ti@empresateste.com` (Gestor de Equipe)
* **Responsável pelo QA/Suporte:** Ana Luísa (Analista de Testes)

---

## 📋 3. Cenários de Teste Executados e Resultados

| Cenário | Descrição do Fluxo | Status | Detalhes / Evidências |
| :--- | :--- | :--- | :--- |
| **01** | Super Admin realiza onboarding da nova empresa com plano PRO. | **PASS** | Empresa criada com sucesso via transação. Senha temporária exibida em tela. |
| **02** | Primeiro acesso do Admin corporativo. | **PASS** | Tentativas de acesso direto ao painel bloqueadas. Redirecionamento forçado para `/change-password`. |
| **03** | Troca de senha temporária por senha forte. | **PASS** | Troca concluída. Senha atualizada no banco, `mustChangePassword` definido como `false`. Token JWT renovado. |
| **04** | Importação de equipe via planilha CSV. | **PASS** | Importado arquivo com 15 colaboradores. CPF validado e formatado com sucesso. |
| **05** | Agendamento e envio em lote de check-ins diários. | **PASS** | Lote de check-ins pendentes criado via job interno com segredo de autenticação. |
| **06** | Envio de resposta pelo WhatsApp e fechamento de tolerância. | **PASS** | Simulado no WhatsApp do funcionário, status atualizado para `CONFIRMED`. Job `mark-not-responded` gerou ocorrência automática para faltas. |
| **07** | Upload e processamento de atestado médico. | **PASS** | Atestado de 3 dias submetido. Aprovado pelo RH. Status do funcionário mudou para afastamento e `AbsenceRecord` inserido. |
| **08** | Exportação de relatório e higienização de CPF. | **PASS** | Relatório gerado em CSV. Coluna do CPF preenchida exclusivamente como `***.***.***-**`. Zero sequências de 11 dígitos no arquivo. |
| **09** | Restrição de Jobs Internos. | **PASS** | Chamadas sem cabeçalho `x-internal-job-secret` retornam `401 Unauthorized` contendo o `requestId` correspondente. |

---

## 🐛 4. Bugs Encontrados e Correções Aplicadas

Durante as rodadas de testes, os seguintes comportamentos foram tratados e corrigidos:
1. **Erro de Duplo Submit em Formulários de Autenticação:** Algumas telas permitiam disparar múltiplos cliques no botão de entrar/salvar se o usuário clicasse repetidamente rápido. Corrigido adicionando a validação `if (isLoading) return` nos handlers de submit e a propriedade `disabled={isLoading}` nos botões.
2. **Propagação do Request ID:** Identificou-se que a equipe de suporte precisava de rastreamento fácil de falhas. Ajustado o manipulador de erros do backend para incluir o `requestId` em todos os payloads JSON de erros HTTP.

---

## 📈 5. Decisão Final de Lançamento

> [!IMPORTANT]
> **Decisão:** **GO**
> 
> **Justificativa:** Todos os 9 cenários essenciais do fluxo de piloto comercial foram validados com 100% de sucesso. A proteção de dados (mascaramento de CPFs no CSV) está robusta, os logs estão sanitizados, as correções de UX aplicadas nos botões previnem falhas operacionais e o novo mecanismo de `requestId` permite suporte rápido durante a operação piloto real. O sistema está estável e seguro para implantação.

### Responsáveis
* **Aprovação Técnica:** Equipe de Engenharia (Antigravity Agent)
* **Aprovação de Negócio:** Equipe de Produto e Comercial PresençaFlow RH
