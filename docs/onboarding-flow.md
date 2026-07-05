# Fluxo de Onboarding de Clientes

Esta documentação descreve o funcionamento do checklist de onboarding e a integração automática do fluxo de importação corporativa.

---

## 1. Checklist Operacional de Onboarding

O painel de onboarding (`/app/onboarding`) fornece um diagnóstico diagnóstico em tempo real sobre a prontidão operacional de um novo cliente (tenant):

As etapas são divididas em 8 blocos:
1. **Dados da Empresa**: Se o perfil e CNPJ foram preenchidos.
2. **Usuários**: Se existe pelo menos 1 administrador ativo.
3. **Colaboradores**: Verifica se existem funcionários ativos cadastrados (`employeesImported`).
4. **Jornadas**: Se há escalas configuradas.
5. **WhatsApp**: Se o canal está ativo ou em simulação.
6. **Regras Operacionais**: Se atestados e check-ins estão ativados.
7. **Teste Piloto**: Etapas manuais registradas por administradores/sucesso do cliente (treinamento, assinatura, kickoff).
8. **Pronto para Operar**: Liberação do piloto.

---

## 2. Integração com o Importador Corporativo V2

Para acelerar o time-to-value, a ação da etapa "Funcionários Importados" direciona o usuário administrador diretamente para o novo assistente guiado `/app/employees/import/v2`.

Uma vez executado com sucesso e contendo pelo menos um funcionário cadastrado no banco de dados, a propriedade de diagnóstico `employeesImported` passa para concluída (`true`), atualizando automaticamente o checklist visual de onboarding sem intervenção manual.
