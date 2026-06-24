# Guia de Teste de Fumaça (Smoke Test)

Este documento orienta a execução do script de teste de fumaça (`staging-smoke-test.ps1`), projetado para validar de forma automatizada e idempotente a saúde e a segurança de instâncias do PresençaFlow RH (seja em Staging ou local em modo de produção).

---

## 📋 Pré-requisitos

Para executar o script de teste de fumaça a partir de sua máquina de homologação/desenvolvimento:
- **PowerShell 7+** instalado.
- Conectividade de rede com o endereço da API e do Frontend configurados.
- Uma instância funcional do PresençaFlow RH com migrations executadas e o usuário `SUPER_ADMIN` provisionado no banco.

---

## ⚙️ Parâmetros do Script

O script `staging-smoke-test.ps1` é parametrizado para garantir que nenhuma chave de segurança ou senha seja gravada no código fonte (hardcoded).

| Parâmetro | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `ApiBaseUrl` | String | Sim | URL base da API (ex: `https://api-staging.presencaflow.com` ou `http://localhost:3001`) |
| `FrontendBaseUrl` | String | Sim | URL base do Frontend (ex: `https://staging.presencaflow.com` ou `http://localhost:3000`) |
| `SuperAdminEmail` | String | Sim | E-mail do usuário SUPER_ADMIN da plataforma |
| `SuperAdminPassword` | String | Sim | Senha do SUPER_ADMIN para autenticação inicial |
| `InternalJobSecret` | String | Sim | Chave de segurança interna para agendamento de jobs |
| `TestCompanyCnpj` | String | Não | CNPJ personalizado para a empresa de teste (se omitido, gera um CNPJ fake aleatório por timestamp) |
| `TestCompanyName` | String | Não | Nome da empresa de teste (se omitido, gera um nome baseado em timestamp) |

---

## 🚀 Exemplos de Execução

Abra o console do PowerShell e execute:

```powershell
./scripts/smoke/staging-smoke-test.ps1 `
  -ApiBaseUrl "http://localhost:3001" `
  -FrontendBaseUrl "http://localhost:3000" `
  -SuperAdminEmail "superadmin@presencaflow.com" `
  -SuperAdminPassword "superpassword123-very-strong-sprint-14" `
  -InternalJobSecret "dev-internal-job-secret-key-default-32-chars"
```

---

## 📊 Interpretação dos Resultados (PASS / FAIL)

O script executa etapas consecutivas e imprime logs claros no console. Cada etapa exibe:

- `[PASS] Nome da Etapa`: Ação executada e validada com sucesso.
- `[FAIL] Nome da Etapa - Motivo`: Falha encontrada durante a execução da etapa.

### Códigos de Saída (Exit Codes)
- **Exit 0:** Todas as etapas obrigatórias foram executadas e validadas com sucesso. O ambiente está estável e seguro.
- **Exit 1:** Ocorreu falha em alguma etapa. O script interrompe imediatamente as etapas subsequentes para fins de debug e retorna erro.

---

## 🔒 Cuidados Importantes com Secrets

- **Sem Hardcode:** Nunca insira senhas, chaves de API (`INTERNAL_JOB_SECRET`) ou tokens JWT diretamente no corpo do script do PowerShell. Passe-os sempre como argumentos nomeados.
- **Mascaramento em Logs:** O script faz requisições capturando a senha temporária e o token de acesso de forma interna em variáveis locais do PowerShell, **nunca** exibindo esses valores em tela ou gravando-os em arquivos de log de execução pública.
- **Higienização de Terminais:** Após executar os testes em terminais compartilhados, limpe o histórico de comandos digitados para evitar a exposição acidental das senhas.
