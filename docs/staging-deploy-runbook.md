# Runbook de Deploy em Homologação (Staging)

Este guia orienta o provisionamento, configuração e implantação do PresençaFlow RH em ambientes de Homologação (Staging) e Produção.

---

## 🌐 1. Topologia de Rede e Domínios

O deploy ideal consiste em uma separação clara entre a interface de usuário (Frontend) e o barramento de API (Backend):

- **Domínio Frontend:** `https://staging.presencaflow.com`
- **Domínio API (Backend):** `https://api-staging.presencaflow.com`

---

## 🔒 2. Configurações de HTTPS (Nginx / Traefik)

Ambos os serviços devem trafegar sob TLS (HTTPS) ativo. Abaixo está um exemplo de arquivo de configuração do **Nginx** atuando como proxy reverso com SSL Let's Encrypt:

```nginx
# API Backend
server {
    listen 443 ssl http2;
    server_name api-staging.presencaflow.com;

    ssl_certificate /etc/letsencrypt/live/api-staging.presencaflow.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-staging.presencaflow.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## ⚙️ 3. Variáveis de Ambiente e Configuração de CORS

O backend exige validações rígidas no boot quando executado sob `NODE_ENV=production` ou `staging`. Crie um arquivo `.env` seguro no diretório `backend` contendo:

```env
# Ambiente
NODE_ENV=staging
PORT=3001

# Banco de Dados
DATABASE_URL="postgresql://user:secure-password@postgres-db-private:5432/presencaflow?schema=public"

# Redis (Fila / Rate Limit)
REDIS_URL="redis://redis-private:6379"

# Urls e CORS
FRONTEND_URL="https://staging.presencaflow.com"
APP_BASE_URL="https://api-staging.presencaflow.com"

# Storage local persistente para atestados
STORAGE_PATH="/var/lib/presencaflow/storage"

# Segredos Criptográficos (Mínimo de 32 caracteres obrigatórios)
JWT_SECRET="e9a7e289bf5ea56b6c429074b1e4a66e4a29a43a0e69a03975ba69a53be895b6"
ENCRYPTION_SECRET="2a84e39bd0184faeeab12fba828399f90fa1e69b5fa016cba0285a83be908b1a"
INTERNAL_JOB_SECRET="3da299f018e6cb0f92bba02891d09baee8fa1cba90fb12ba97e937d2fba0882e"

# SUPER_ADMIN inicial (Mínimo de 12 caracteres obrigatórios para a senha)
SUPER_ADMIN_EMAIL="superadmin@presencaflow.com"
SUPER_ADMIN_PASSWORD="superpassword123-very-strong-sprint-14"
```

---

## 🐘 4. Banco de Dados PostgreSQL Privado

> [!WARNING]
> **Postgres não exposto publicamente:** A porta `5432` do banco de dados **nunca** deve ser aberta ao tráfego público de internet. O banco de dados deve residir em uma subrede isolada (VPC) ou rede privada virtual acessível unicamente pelos contêineres do backend PresençaFlow.

### Migrations
Em Homologação e Produção, as migrations do banco de dados devem ser executadas com o comando `deploy` para evitar alterações de schema que limpem dados reais (`db push` é proibido):
```bash
npx prisma migrate deploy
```

---

## 🧪 5. Sementes e Demo-Seed

> [!CAUTION]
> **seed:demo bloqueado:** Em ambientes staging/produção, a execução do comando `seed:demo` que popula e apaga dados está bloqueada. Não execute este script em ambientes de staging comerciais ou reais para evitar deleções acidentais. A flag `ALLOW_DEMO_SEED=true` só deve ser habilitada para apresentações comerciais curtas em instâncias totalmente descartáveis.

---

## 📁 6. Persistência de Dados (STORAGE_PATH)

Os atestados médicos enviados por funcionários são gravados no caminho especificado por `STORAGE_PATH`.
- Certifique-se de configurar um volume persistente (e.g. volumes Docker ou montagens de disco EFS/NFS) apontando para a pasta física correspondente ao container para garantir que nenhum atestado seja deletado após uma reinicialização ou atualização do sistema.

---

## 💾 7. Políticas de Backup e Restore

### 1. Criar Backup (Export)
Para realizar o backup programado da base de dados PostgreSQL, execute o utilitário `pg_dump`:
```bash
pg_dump -U postgres -h postgres-db-private -d presencaflow -F c -b -v -f /backups/presencaflow_backup_$(date +%F).dump
```

### 2. Restaurar Backup (Import)
Para restaurar a estrutura e dados em caso de sinistro ou homologação de testes:
```bash
pg_restore -U postgres -h postgres-db-private -d presencaflow -v /backups/presencaflow_backup_XXXX-XX-XX.dump
```

---

## 💬 8. Webhook do WhatsApp

Ao conectar a API oficial da Cloud do WhatsApp no painel administrativo:
1. Copie o endereço `/api/webhooks/whatsapp` exibido nas configurações do canal da empresa.
2. Configure o Webhook do aplicativo no Painel de Desenvolvedores da Meta apontando para a URL de staging (`https://api-staging.presencaflow.com/api/webhooks/whatsapp`).
3. Informe o token de validação correspondente à empresa.
