# Runbook de Deploy em Produção (Go-Live) — PresençaFlow RH

Este documento serve como guia oficial e checklist de passos obrigatórios para a implantação do PresençaFlow RH em ambiente de produção comercial.

---

## 1. Configurações Pré-Deploy (Checklist de Requisitos)

Antes de iniciar o processo de subida, certifique-se de que os seguintes recursos de infraestrutura e rede estão devidamente configurados:

### A. Estratégia de DNS e Redirecionamento HTTPS
Os registros DNS no provedor (ex: Cloudflare, Registro.br) devem apontar para a infraestrutura de produção:
- `presencaflow.com.br` (Domínio Principal do Frontend)
- `api.presencaflow.com.br` (API Gateway / Backend)
- `www.presencaflow.com.br` (Subdomínio alternativo)

#### Redirecionamentos Obrigatórios (Configurar no Proxy/Nginx/Cloudflare Rules):
1. `http://presencaflow.com.br` ➔ `https://presencaflow.com.br`
2. `http://www.presencaflow.com.br` ➔ `https://presencaflow.com.br`
3. `https://www.presencaflow.com.br` ➔ `https://presencaflow.com.br`

*Nota: O domínio canonical oficial a ser indexado por SEO deve ser sempre `https://presencaflow.com.br`.*

### B. CORS Seguro (Cross-Origin Resource Sharing)
O backend em produção restringe conexões de origens web. Certifique-se de que as requisições de origem cruzada estejam configuradas para aceitar **apenas** `https://presencaflow.com.br` e `https://www.presencaflow.com.br`. Chamadas originárias de `localhost`, servidores de staging ou quaisquer domínios não homologados serão sumariamente rejeitadas com erro CORS.

### C. Variáveis de Ambiente de Produção (Definitivas)

#### Backend (`/backend/.env`):
- `NODE_ENV=production`
- `DATABASE_URL` (Conexão com banco Postgres de produção - isolada e segura)
- `JWT_SECRET` (Mínimo de 32 caracteres gerados aleatoriamente)
- `ENCRYPTION_SECRET` (Chave forte de 32 bytes para criptografia de dados confidenciais)
- `INTERNAL_JOB_SECRET` (Segredo forte de no mínimo 32 caracteres para validação de jobs internos)
- `FRONTEND_URL=https://presencaflow.com.br`
- `APP_BASE_URL=https://presencaflow.com.br`
- `STORAGE_PATH` (Volume de disco persistente para upload de atestados de forma isolada)

#### Frontend (`/frontend/.env`):
- `NEXT_PUBLIC_API_BASE_URL=https://api.presencaflow.com.br`
- `NEXT_PUBLIC_ANALYTICS_ENABLED=false` (Se desabilitado conscientemente no go-live inicial para conformidade prévia de cookies)
- `NEXT_PUBLIC_ANALYTICS_PROVIDER` (Vazio ou configurado como `console`/`plausible`/`umami` se ativado)
- `NEXT_PUBLIC_ANALYTICS_SITE_ID` (Identificador do domínio configurado no provedor de estatísticas)

### D. Regras de Segurança Críticas
- **Exposição do Postgres**: O banco de dados Postgres **não deve** ter a porta 5432 aberta para o mundo. O acesso deve ser restrito aos IPs do backend por meio de Security Groups (AWS/Azure) ou regras de rede privada Docker.
- **Mascaramento de Logs**: Todos os logs de depuração estão configurados para mascarar senhas, tokens de autenticação (incluindo `debugToken`), segredos de webhooks, CPFs e dados pessoais. Nunca desative essa flag em produção.

---

## 2. Ordem de Execução do Deploy

O deploy deve seguir rigorosamente a ordem abaixo para evitar indisponibilidade de serviços ou falhas de dados com clientes.

### [PASSO 1] Backup Pré-Deploy
Gere um backup completo e consistente do banco de dados imediatamente antes do início das operações de deploy.
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/ops/backup-postgres.ps1 -DatabaseUrl "SUA_DATABASE_URL_PRODUCTION" -OutputDir "./backups_pre_deploy"
```
*Validação*: Verifique se o arquivo `.dump` foi criado no diretório especificado com tamanho consistente (diferente de 0 bytes).

### [PASSO 2] Compilação do Build / Imagem Pronta
Gere a build de produção de ambos os workspaces para assegurar que nenhum erro de sintaxe ou compilação TypeScript interfira na execução.
```bash
# Backend Build
cd backend && npm run build

# Frontend Build
cd ../frontend && npm run build
```
*Validação*: Ambos os comandos devem terminar com sucesso. No frontend, valide se o diretório `.next` foi gerado.

### [PASSO 3] Migrations de Banco de Dados
Rode as migrations pendentes no banco usando o comando seguro do Prisma. **Nunca utilize db push em produção.**
```bash
cd backend
npx prisma migrate deploy
```
*Validação*: Certifique-se de que a migration `20260621150000_add_lead_campaign_metadata` e anteriores foram aplicadas com sucesso ao banco sem erros de rede.

### [PASSO 4] Subir Aplicação (Start)
Coloque a nova versão da aplicação em execução.
```bash
# Backend Start
npm run start

# Frontend Start
# (Se subir via node local ou container Docker)
npm run start
```

### [PASSO 5] Health Checks (live/ready)
Aguarde alguns segundos para inicialização das portas e consulte as APIs de saúde:
- `https://api.presencaflow.com.br/api/health/live` ➔ Esperado retornar `{ "status": "OK" }`
- `https://api.presencaflow.com.br/api/health/ready` ➔ Esperado retornar `{ "status": "OK" }` (indica conexão com banco e Redis ativa).

---

## 3. Validação do Go-Live (Smoke Test e Auditoria)

Após a subida da aplicação, execute o smoke test automatizado a partir de uma máquina externa com acesso à internet para atestar o pleno funcionamento.

### A. Smoke Test Automatizado
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/smoke/production-smoke-test.ps1 `
  -ApiBaseUrl "https://api.presencaflow.com.br" `
  -FrontendBaseUrl "https://presencaflow.com.br" `
  -SuperAdminEmail "superadmin@presencaflow.com.br" `
  -SuperAdminPassword "SENHA_FORTE_AQUI" `
  -InternalJobSecret "SEGREDO_INTERNO_AQUI"
```
*Critério de Sucesso*: O console deve emitir `[PASS]` em todas as 10 etapas da suíte e terminar com `[EXIT 0]`.

### B. Validação Manual de SEO e Indexação
1. **Robots**: Acesse `https://presencaflow.com.br/robots.txt`. Verifique se o arquivo está acessível e bloqueia `/app` e `/api`.
2. **Sitemap**: Acesse `https://presencaflow.com.br/sitemap.xml`. Valide se aponta corretamente para `https://presencaflow.com.br` e não vaza rotas protegidas ou endpoints `/api`.
3. **Páginas Legais**: Verifique se `/privacy` e `/terms` estão abrindo sem erros de renderização e exibem o conteúdo de conformidade LGPD.
4. **Metadados de Rede Social**: Insira o link da home em um validador de cartões (ex: LinkedIn Post Inspector ou compartilhando em um grupo do WhatsApp) e valide se o título e a descrição são renderizados corretamente com a identidade da marca.

### C. Validação de Backup/Restore em Ambiente Isolado
1. Restaure o dump gerado no **PASSO 1** em uma base de dados local de teste usando o script operacional:
   ```powershell
   powershell -ExecutionPolicy Bypass -File ./scripts/ops/restore-postgres.ps1 `
     -TargetDatabaseUrl "postgresql://postgres:postgres@localhost:5432/presencaflow_test_restore" `
     -BackupFile "./backups_pre_deploy/presencaflow_XXX.dump"
   ```
2. Inicialize o servidor backend apontando para `presencaflow_test_restore`.
3. Certifique-se de que a aplicação se conecta corretamente e lê todos os dados das empresas piloto e dores cadastradas anteriormente.
