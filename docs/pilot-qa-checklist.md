# Checklist de QA Comercial — Piloto Controlado

Este checklist orienta o time de QA e operação na validação ponta a ponta do PresençaFlow RH em ambientes de Staging/Homologação, simulando a jornada completa de um cliente real.

---

## 📋 Etapas do Roteiro de Validação

### 🏢 1. Onboarding da Empresa Piloto
- [ ] Acessar o Painel de Plataforma do Super Admin.
- [ ] Criar uma nova empresa piloto informando:
  - Nome Fantasia, Razão Social e CNPJ válido (não duplicado).
  - E-mail e Nome do Administrador (ex: `admin.empresa@piloto.com`).
  - Plano de Uso (Starter, Pro ou Business).
- [ ] Capturar a senha temporária exibida na tela uma única vez.
- [ ] Garantir que o banco de dados criou a empresa, a assinatura ativa, a escala padrão e o canal de WhatsApp em modo simulado.

### 🔑 2. Primeiro Acesso e Troca de Senha Obrigatória
- [ ] Tentar acessar qualquer rota interna corporativa diretamente (ex: `/app/dashboard`) com a sessão limpa e validar que o sistema redireciona para `/login`.
- [ ] Fazer login com o e-mail cadastrado e a senha temporária.
- [ ] Verificar que o sistema redireciona o usuário imediatamente para a tela `/change-password` e impede a navegação normal.
- [ ] Tentar trocar a senha por uma senha fraca ou igual à temporária e validar que o sistema rejeita com erro apropriado.
- [ ] Definir uma nova senha forte (min. 12 caracteres, maiúscula, minúscula, número e símbolo).
- [ ] Confirmar que o sistema altera a senha no banco, define `mustChangePassword = false` e redireciona para o painel principal (`/app/dashboard`).

### ⚙️ 3. Configurações da Empresa e WhatsApp
- [ ] Acessar "Config. Empresa" e definir a tolerância de atraso padrão e o horário padrão de envio.
- [ ] Acessar "Config. WhatsApp" e verificar que o canal simulado está ativo como `SIMULATION`.
- [ ] Copiar os dados do Webhook listados para verificar a máscara dos dados confidenciais (secrets nunca são expostos).

### 📥 4. Importação de Funcionários via CSV
- [ ] Preparar um arquivo CSV contendo os dados dos funcionários conforme o padrão exigido.
- [ ] Tentar subir um CSV contendo erros críticos (CPFs duplicados, modelo de trabalho inválido) e validar que a transação sofre rollback (nenhum funcionário é criado).
- [ ] Corrigir o arquivo CSV e efetuar o upload de importação em `/app/employees/import`.
- [ ] Garantir que o sistema exibe o resumo com a quantidade de cadastros concluídos com sucesso e os registros pulados (skipped).

### ⏰ 5. Ciclo de Presença e Jobs Internos
- [ ] Disparar a criação automática da jornada de trabalho enviando uma chamada para a rota de criação de check-ins (`POST /api/internal/jobs/remote-checkin-batch`) com o header de autenticação correto.
- [ ] Verificar se os check-ins pendentes foram gerados para os funcionários.
- [ ] **Simular Resposta WhatsApp:** Fazer o input de simulação de resposta do funcionário no fluxo remoto (ex: informando que iniciou o expediente).
- [ ] **Processar Sem Resposta (Job):** Chamar o job de finalização por estouro de tolerância (`POST /api/internal/jobs/mark-not-responded`) com o secret correto.
- [ ] Validar que o funcionário que não respondeu teve uma ocorrência do tipo `REMOTE_CHECKIN_NOT_RESPONDED` criada automaticamente no painel de ocorrências.

### 📄 6. Atestados Médicos e Afastamentos
- [ ] Acessar a tela de "Atestados" e submeter um novo arquivo de atestado simulando a recepção pelo funcionário.
- [ ] Verificar se o atestado entra em status `RECEBIDO` ou `EM_REVISAO`.
- [ ] Revisar o atestado, definir a quantidade de dias recomendada e clicar em **Aprovar**.
- [ ] Validar no painel do funcionário que o status dele mudou para afastamento ativo e que um registro de `AbsenceRecord` foi criado no banco de dados.

### 📊 7. Relatórios, Exportação de CSV e Higienização de CPF
- [ ] Acessar `/app/reports` e verificar os sumários operacionais de ocorrências e atestados consolidados no período.
- [ ] Exportar o relatório operacional no formato CSV.
- [ ] Abrir o arquivo CSV gerado e validar:
  - O cabeçalho e as linhas contêm a coluna "CPF mascarado" preenchida apenas com `***.***.***-**`.
  - O arquivo **não** contém nenhuma sequência numérica exposta de 11 dígitos referentes a CPFs reais.

### 🔒 8. Auditoria de Logs de Segurança
- [ ] Acessar a tabela ou logs de `AuditLog` e verificar os registros criados:
  - `LOGIN_SUCCESS` e `LOGIN_FAILED` (sem expor as credenciais).
  - `PASSWORD_CHANGED` após a troca obrigatória de senha.
  - `USER_INVITED` ao enviar convites a terceiros.
- [ ] Confirmar que nenhum log estruturado gravado no servidor expõe dados de senhas, JWTs, CPFs reais ou segredos criptográficos.

### 💾 9. Backup, Restore e Persistência física do STORAGE_PATH
- [ ] Realizar um restart completo dos containers da aplicação em staging.
- [ ] Entrar na tela de Atestados e verificar que os arquivos de documentos enviados anteriormente continuam acessíveis (o diretório `STORAGE_PATH` persistiu).
- [ ] Executar o backup via runbook e realizar o restore em uma base limpa em ambiente isolado de validação para confirmar a integridade de todas as tabelas e relacionamentos.
