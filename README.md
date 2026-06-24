# PresençaFlow RH — Plataforma de Gestão Operacional de Presença

PresençaFlow RH é uma plataforma vertical para automatizar o gerenciamento de faltas, atrasos, atestados médicos, check-in remoto e ponto esquecido via WhatsApp, organizando tudo em um painel web com protocolo, evidências, timeline e relatórios para RH e gestores.

---

## 🚀 Requisitos de Sistema

Certifique-se de ter instalado em sua máquina:
- **Node.js** (v18 ou superior recomendado)
- **npm** (v9 ou superior)
- **Docker** e **Docker Compose**

---

## 🛠️ Stack Tecnológica

- **Backend**: Node.js + TypeScript + Fastify + Prisma + PostgreSQL + Redis (ioredis)
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS

---

## 🏗️ Como Inicializar o Projeto Localmente

### 1. Iniciar os Serviços de Infraestrutura (Docker)

Certifique-se de que o Docker está em execução e suba os containers do **PostgreSQL** e **Redis**:

```bash
docker compose up -d
```

*Os volumes locais de dados serão criados automaticamente para manter o estado persistente do banco e cache.*

### 2. Configurar e Iniciar o Backend

1. Entre no diretório do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. O projeto já inclui arquivos pré-configurados. Caso queira customizar, verifique as variáveis no arquivo `.env`. O `.env.example` serve como modelo.
4. Execute as migrações iniciais do banco de dados (Prisma):
   ```bash
   npx prisma db push
   ```
5. Gere o Prisma Client:
   ```bash
   npx prisma generate
   ```
6. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

O backend estará respondendo em `http://localhost:3001`.

### 3. Configurar e Iniciar o Frontend

1. Abra um novo terminal e entre no diretório do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. O frontend já contém um arquivo `.env` configurado apontando para a API do backend local.
4. Inicie o servidor de desenvolvimento do Next.js:
   ```bash
   npm run dev
   ```

O painel web estará disponível em `http://localhost:3000`.

---

## 🔍 Health Checks da API

O backend expõe rotas de saúde em `/api/health*` para monitoramento das conexões ativas:

- **Liveness Check**: `http://localhost:3001/api/health/live` (Valida se a aplicação está rodando)
- **Readiness Check**: `http://localhost:3001/api/health/ready` (Valida se o PostgreSQL e o Redis estão conectados com sucesso)
- **Health Summary**: `http://localhost:3001/api/health` (Resumo com detalhamento por componente)

---

## 🗂️ Estrutura do Repositório

```txt
presencaflow-rh/
├── backend/            # Fastify API Server + Prisma Schema
│   ├── src/
│   │   ├── config/     # Arquivos de configuração de variáveis
│   │   ├── lib/        # Clientes singleton (Prisma, Redis)
│   │   ├── plugins/    # Plugins do Fastify (CORS, etc.)
│   │   ├── routes/     # Rotas e controladores da API
│   │   └── app.ts      # Inicialização do Fastify app
│   └── prisma/         # Arquivos de migração e schema.prisma
├── frontend/           # Next.js SPA
│   ├── src/
│   │   └── app/        # Páginas do App Router (login, app/dashboard)
│   │   └── lib/        # Utilitários (cn, etc.)
├── docker-compose.yml  # Configuração do banco PostgreSQL e Redis
└── README.md           # Guia de instalação e uso
```
