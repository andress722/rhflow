# Roteiro Operacional de Piloto Assistido (Pilot Operation Runbook)

Este documento atua como checklist de validação em campo para a operação assistida do PresençaFlow RH. Marque cada etapa à medida que a validação for realizada com o cliente piloto ou em ambiente controlado.

---

## 🏢 Fase 1: Setup e Onboarding

- [ ] **1. Criação/Onboarding da Empresa Piloto pelo SUPER_ADMIN**
  - Acessar o Painel de Plataforma em `/app/admin/companies`.
  - Cadastrar a empresa piloto com CNPJ, Razão Social e Nome Fantasia válidos.
  - Cadastrar o usuário administrador inicial (`ADMIN`) da empresa.
  - Copiar e guardar de forma segura a senha temporária gerada de uso único.

- [ ] **2. Primeiro Acesso do ADMIN**
  - Fazer login na tela `/login` utilizando as credenciais criadas.
  - Validar que o sistema detecta o primeiro acesso e impede a navegação normal.

- [ ] **3. Troca Obrigatória de Senha**
  - O sistema deve forçar o redirecionamento imediato do usuário para `/change-password`.
  - Cadastrar uma nova senha que atenda à política forte (min. 12 caracteres, maiúscula, minúscula, número e símbolo).
  - Validar que o login é atualizado e o usuário é direcionado ao painel corporativo.

- [ ] **4. Configuração de Tolerância da Empresa**
  - Acessar "Config. Empresa" em `/app/settings/company`.
  - Definir os minutos de tolerância de atraso (ex: 30 minutos).

- [ ] **5. Configuração do WhatsApp**
  - Acessar "Config. WhatsApp" em `/app/settings/whatsapp`.
  - Validar que o canal está configurado em modo de simulação (`SIMULATION`) ou conectar o provedor oficial Meta Cloud se disponível.

- [ ] **6. Importação CSV de Funcionários**
  - Acessar `/app/employees/import`.
  - Enviar a planilha CSV contendo os funcionários de teste.
  - Confirmar o processamento dos novos cadastros e a listagem correta na aba de funcionários.

- [ ] **7. Validação do Checklist de Onboarding**
  - Acessar `/app/onboarding` para visualizar as etapas.
  - Confirmar que as etapas realizadas anteriormente (cadastro de escala, funcionários e configurações) constam como concluídas.

---

## ⏰ Fase 2: Ciclo de Operação Diária

- [ ] **8. Disparo de Check-in Individual**
  - Ir para a tela `/app/presence`.
  - Disparar um check-in de teste manualmente para um único funcionário específico.
  - Validar que o status do check-in fica `PENDING`.

- [ ] **9. Disparo de Check-in em Lote**
  - Chamar o job de criação em lote (`POST /api/internal/jobs/remote-checkin-batch`) com o cabeçalho `x-internal-job-secret` correto.
  - Validar que o lote de check-ins correspondentes ao dia foi gerado para toda a empresa.

- [ ] **10. Simulação de Resposta WhatsApp**
  - Enviar a simulação de mensagem respondida pelo WhatsApp (ex: confirmando entrada) utilizando o console do canal simulado.
  - Verificar que o check-in correspondente é marcado como `CONFIRMED` ou `LATE` conforme o horário.

- [ ] **11. Marcação de Não Respondidos**
  - Chamar o job de finalização de tolerância (`POST /api/internal/jobs/mark-not-responded`) com o secret correto.
  - Validar que os check-ins pendentes foram fechados como `NOT_RESPONDED`.

- [ ] **12. Tratamento de Ocorrências**
  - Acessar o painel em `/app/occurrences`.
  - Localizar as ocorrências geradas automaticamente no dia (ex: atrasos, não respondidos).
  - Justificar e fechar as ocorrências aplicando o status `RESOLVED`.

---

## 📄 Fase 3: Movimentações e Fechamento

- [ ] **13. Upload de Atestado Médico**
  - Acessar `/app/medical-certificates`.
  - Submeter um documento PDF/Imagem de atestado simulando a entrega pelo funcionário.
  - Verificar que o documento entra no status `RECEIVED` ou `UNDER_REVIEW`.

- [ ] **14. Aprovação/Rejeição de Atestado**
  - Acessar o detalhamento do atestado como administrador.
  - Informar a quantidade de dias e aprovar o atestado.
  - Validar a criação do registro de afastamento (`AbsenceRecord`) para o período.

- [ ] **15. Geração de Relatório Operacional**
  - Acessar `/app/reports`.
  - Filtrar o período de testes para visualizar os consolidados de presença e faltas no dashboard.

- [ ] **16. Exportação CSV**
  - Clicar em Exportar Relatório em CSV.
  - Baixar o arquivo e garantir que todas as colunas de dados confidenciais (e.g. CPF) estão mascaradas para privacidade.

- [ ] **17. Validação do AuditLog**
  - Consultar a tabela de Auditoria no banco ou painel para confirmar os eventos gerados (como `LOGIN_SUCCESS`, `PASSWORD_CHANGED`, `EMPLOYEES_IMPORTED`).

---

## 💾 Fase 4: Infraestrutura e Encerramento

- [ ] **18. Execução de Jobs Internos**
  - Testar todas as chamadas de Job em `/api/internal/jobs/*` validando a exigência do segredo de autenticação.

- [ ] **19. Backup Antes/Depois do Piloto**
  - Executar a exportação dump do banco de dados antes de iniciar o piloto (estado limpo) e após a conclusão da simulação comercial.

- [ ] **20. Registro de Decisão Final**
  - Consolidar as evidências e preencher a decisão Go/No-Go no documento `pilot-evidence.md`.
