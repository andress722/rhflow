# Production Readiness Checklist (PresençaFlow RH)

Antes de colocar a aplicação em produção ou abrir acesso a clientes reais, verifique se todos os itens abaixo estão validados e em conformidade.

---

## 🔑 1. Configurações & Variáveis de Ambiente (Env)

- [ ] **Variável `NODE_ENV`:** Definida estritamente como `production` para garantir otimizações de build, proteção de endpoints e tratamento de logs.
- [ ] **Variáveis de Segurança:** `JWT_SECRET`, `ENCRYPTION_SECRET` e `INTERNAL_JOB_SECRET` possuem valores únicos, complexos e com no mínimo 32 caracteres gerados aleatoriamente.
- [ ] **Sem Valores Padrão (Defaults):** Certificar-se de que nenhum segredo padrão de desenvolvimento ou credencial padrão (`postgres` / `dev-safe-*`) esteja configurado no arquivo `.env` de produção.
- [ ] **Endereço do Frontend e Backend:** `FRONTEND_URL` e `APP_BASE_URL` configurados com os domínios HTTPS públicos reais de produção.

---

## 💾 2. Banco de Dados & Armazenamento

- [ ] **Migrações Aplicadas:** Executado `npx prisma migrate deploy` para aplicar todas as migrações estruturais do banco PostgreSQL em vez de usar `db push`.
- [ ] **Isolamento de Portas:** O contêiner de banco de dados (PostgreSQL) e Redis não expõem suas portas de conexão fisicamente para a internet pública (verificar `ports` no `docker-compose.prod.yml`).
- [ ] **Persistência de Dados (Volumes):** Certificar-se de que os volumes do Docker para dados do Postgres e Redis estão mapeados e configurados corretamente para evitar perdas de dados em reinicializações de contêiner.
- [ ] **STORAGE_PATH:** A pasta física para upload de atestados médicos está mapeada para um diretório com permissões de leitura/escrita, e o Readiness Check (`/api/health/ready`) retorna sucesso.

---

## ⚕️ 3. Saúde & Monitoramento (Observabilidade)

- [ ] **Liveness Check (`/api/health/live`):** Integrado ao monitorador do servidor ou orquestrador para verificar a resposta imediata da aplicação.
- [ ] **Readiness Check (`/api/health/ready`):** Validado que responde `200 OK` quando DB e Storage estão conectados, e `503` em caso de erro, sem expor chaves privadas ou caminhos internos em caso de falha.
- [ ] **Logs de Produção (Higienizados):** Logs de tráfego de requisições formatados estruturadamente sem vazar dados pessoais como CPF, informações confidenciais de atestados médicos ou secrets criptográficos.

---

## 💬 4. WhatsApp & Integração Meta Cloud API

- [ ] **Provedores Cadastrados:** O fallback automático de canais `SIMULATED` está funcionando para novas empresas, mas as empresas comerciais em produção estão usando provedores `META_CLOUD` configurados individualmente.
- [ ] **Webhook Registrado:** A URL de Webhook com a `channelKey` está inserida corretamente no portal do Facebook e o webhookSecret corresponde perfeitamente ao configurado na empresa.
- [ ] **Validação HMAC SHA-256:** A validação de assinatura `x-hub-signature-256` está ativada e funcionando para as chamadas que chegam da Meta.

---

## 🧹 5. Rotinas & Jobs Operacionais

- [ ] **Agendamento de Jobs:** Endpoints `/api/internal/jobs/*` estão integrados a um serviço de chamadas recorrentes (como crontab ou scheduler de nuvem) para executar as rotas sob proteção de chave.
- [ ] **Configurações de Retenção:** `WHATSAPP_LOG_RETENTION_DAYS` e `AUDIT_LOG_RETENTION_DAYS` configurados adequadamente, e a execução do job `cleanup-old-logs` rodando periodicamente para expurgo de logs históricos.

---

## 🔒 6. Gestão de Planos & Assinaturas

- [ ] **Plano Padrão de Cadastro:** Empresas novas que se cadastram recebem planos de teste (Trial/Starter) limitando o número de funcionários e envios conforme regras comerciais.
- [ ] **Restrição de Funcionalidades:** Recursos premium como check-ins em lote e módulos médicos bloqueados se o plano contratado não permitir.
