# Guia de Implantação e Deploy (Produção)

Este documento descreve o procedimento passo a passo para implantar o **PresençaFlow RH** em ambiente de produção utilizando contêineres Docker e Docker Compose.

---

## 🚀 Requisitos de Infraestrutura

- Servidor Linux (Ubuntu 20.04 LTS ou superior recomendado)
- **Docker Engine** v20.10+ instalado
- **Docker Compose** v2.0+ instalado
- Mínimo de 2 vCPUs e 4GB de memória RAM livres
- Acesso à internet para download de imagens docker e comunicação com APIs externas (Meta Cloud API)

---

## ⚙️ Diferenças de Ambientes

### Produção vs. Desenvolvimento/Staging
- **Migração de Banco de Dados:** 
  - Em **produção**, as migrações devem ser aplicadas estritamente usando `npx prisma migrate deploy` para aplicar migrações estruturadas históricas. Nunca execute `prisma db push` diretamente, pois ele pode apagar dados e tabelas se houver inconsistências.
- **Seeds de Demonstração:**
  - O script `npm run seed:demo` (ou qualquer script de seed de demonstração) é **estritamente proibido** em ambiente produtivo. Ele apenas deve ser executado em ambientes locais, demonstrativos ou staging.
- **Isolamento de Banco de Dados:**
  - Em produção, a porta física `5432` do PostgreSQL e a porta `6379` do Redis **não devem ser expostas publicamente**. O tráfego de dados deve trafegar internamente apenas através da rede interna do Docker (Docker Network).

---

## 🔒 Variáveis de Ambiente Obrigatórias (Produção)

No diretório raiz do projeto, crie um arquivo `.env` configurando os seguintes valores para produção:

```ini
PORT=3001
NODE_ENV=production

# URLs de Conexão
DATABASE_URL="postgresql://postgres:postgres_secure_password_prod@db:5432/presencaflow?schema=public"
REDIS_URL="redis://redis:6379"

# Segredos Seguros (Gerar chaves aleatórias complexas de no mínimo 32 caracteres)
JWT_SECRET="sua-chave-secreta-jwt-super-segura-de-32-chars"
ENCRYPTION_SECRET="sua-chave-secreta-encriptacao-super-segura-de-32-chars"
INTERNAL_JOB_SECRET="sua-chave-secreta-interna-jobs-super-segura-de-32-chars"

# URLs de roteamento do sistema
FRONTEND_URL="https://app.presencaflow.com"
APP_BASE_URL="https://api.presencaflow.com"

# Caminho para armazenamento físico persistente de arquivos (atestados médicos)
STORAGE_PATH="/app/storage"

# Retenção de Dados
WHATSAPP_LOG_RETENTION_DAYS=180
AUDIT_LOG_RETENTION_DAYS=365
```

---

## 🐋 Implantação com Docker Compose

Para realizar a implantação automatizada em produção, siga os passos abaixo:

1. Clone o repositório no servidor de produção.
2. Crie e configure o arquivo `.env` na raiz do projeto com base nas chaves obrigatórias acima.
3. Execute o build e inicialização dos contêineres:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. Após o primeiro boot, aplique as migrações do Prisma no banco de dados produtivo:
   ```bash
   docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
   ```

---

## 🏥 Monitoramento e Health Checks

Utilize os seguintes endpoints configurados no balanceador de carga ou orquestrador para monitorar a saúde da aplicação:

- **Liveness Check (`GET /api/health/live`):**
  - Retorna HTTP `200 OK` instantaneamente indicando que o processo Node/Fastify está ativo.
- **Readiness Check (`GET /api/health/ready`):**
  - Valida a conectividade ativa com o banco de dados PostgreSQL (`SELECT 1`), valida as permissões de leitura/escrita no diretório físico configurado em `STORAGE_PATH` e verifica se o segredo de criptografia está configurado corretamente.
  - Retorna `200 OK` se tudo estiver operacional ou `503 Service Unavailable` em caso de indisponibilidade de algum componente vital.

---

## 💬 Integração WhatsApp (Meta Cloud API Webhook)

Para que a recepção de check-ins e respostas dos funcionários funcione corretamente:

1. No console do desenvolvedor do Facebook (Meta Developers Portal), crie um Webhook direcionado a mensagens do WhatsApp.
2. Defina a **Callback URL** no painel da Meta apontando para o endpoint seguro do canal da empresa:
   `https://api.presencaflow.com/api/webhooks/whatsapp/{channelKey}/inbound`
3. Configure o campo **Verify Token** com o `webhookSecret` gerado no painel do sistema (visível mascarado na tela de configurações administrativas do WhatsApp).
