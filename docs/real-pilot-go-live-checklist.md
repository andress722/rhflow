# Checklist de Go-Live de Cliente Piloto Real — PresençaFlow RH

Este checklist serve de guia operacional e técnico para implantar o PresençaFlow RH para o primeiro cliente piloto real.

---

## 1. Dados e Configuração Básica da Empresa

- [ ] **Homologação Cadastral:**
  - Razão Social e Nome Fantasia revisados.
  - CNPJ validado na base oficial da Receita.
- [ ] **Configurações Multi-tenant:**
  - Fuso horário definido como `America/Sao_Paulo` (ou conforme região).
  - Configurações de tolerância (Grace Period) e jornada diária cadastrados em `CompanySettings`.
- [ ] **Plano Comercial Definido:**
  - Cadastro de `CompanySubscription` com plano correto (`STARTER`, `PRO` ou `BUSINESS`).
  - Lançamento do faturamento manual inicial (valor contratado, ciclo mensal/anual).

---

## 2. Usuários e Acessos Iniciais

- [ ] **Usuários do RH (Admin):**
  - Cadastro do Administrador Primário do cliente.
  - Teste de login inicial e instrução para alteração obrigatória de senha temporária.
- [ ] **Cadastro de Gestores (Managers):**
  - Registro de usuários gestores e vínculo correspondente a seus times.

---

## 3. Carga e Estruturação de Funcionários

- [ ] **Limpeza de CPFs e Telefones:**
  - Revisão de planilha/layout de importação de funcionários (CPFs válidos, sem caracteres e DDD correto).
- [ ] **Importação via API/Interface:**
  - Execução da carga em massa de colaboradores no painel.
- [ ] **Distribuição de Jornadas:**
  - Associação de cada funcionário às escalas/jornadas criadas.

---

## 4. Integração do WhatsApp e Canais

- [ ] **Conexão Real do Canal:**
  - Disparo de QR Code de produção e emparelhamento do número corporativo do cliente.
  - Confirmação de status `CONNECTED` no console do `SUPER_ADMIN`.
- [ ] **Garantias Operacionais:**
  - Disparo de mensagem de teste para número do gestor para validar conciliação.

---

## 5. Fluxos e Diagnósticos Iniciais

- [ ] **Teste de Diagnóstico (Readiness API):**
  - Executar o diagnóstico de go-live no painel admin para a empresa do piloto real.
  - Validar que a flag `goLiveReady` retorna `true` com zero bloqueios técnicos.
- [ ] **Fluxo da Primeira Semana (Operação Assistida):**
  - Verificação diária da taxa de resposta global no dashboard do cliente.
  - Acompanhamento de atestados anexados.
