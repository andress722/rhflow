# Guia de Go-Live e Homologação em Staging (Sprint 12)

Este guia descreve as etapas necessárias para implantar, provisionar e homologar o **PresençaFlow RH** em ambiente de staging/homologação de forma autônoma e segura.

---

## 1. Provisionar o Ambiente de Staging

### Pré-requisitos
- Um servidor ou container Linux (Ubuntu/Debian) com Docker e Docker Compose instalados.
- Um banco de dados PostgreSQL.
- Um serviço Redis (opcional, pode rodar no mesmo host).

### Variáveis de Ambiente Obrigatórias
No arquivo `.env` de staging, configure as seguintes variáveis obrigatórias:

```env
PORT=3001
NODE_ENV=staging
DATABASE_URL=postgresql://db_user:db_password@db_host:5432/presencaflow_staging?schema=public
REDIS_URL=redis://redis_host:6379
JWT_SECRET=sua_chave_jwt_secreta_com_no_minimo_32_caracteres_123!
ENCRYPTION_SECRET=chave_de_encriptacao_aes_256_gcm_de_32_caracteres
INTERNAL_JOB_SECRET=internal_job_secret_chave_secreta_com_no_minimo_32_caracteres

# Credenciais SUPER_ADMIN de Plataforma (Não usar senhas fracas!)
SUPER_ADMIN_EMAIL=admin.plataforma@presencaflow.com
SUPER_ADMIN_PASSWORD=uma_senha_forte_e_longa_com_mais_de_16_caracteres_A1!
```

---

## 2. Executar as Migrações do Banco de Dados

> [!WARNING]
> Nunca utilize `npx prisma db push` em staging ou produção para evitar corrupção de dados ou inconsistências de versionamento.

Rode o comando de deploy de migrações versionadas:
```bash
npx prisma migrate deploy
```
E regenere o cliente do Prisma:
```bash
npx prisma generate
```

---

## 3. Inicializar a Plataforma (Criar SUPER_ADMIN)

Rode o script de sementes (seed) da base global para criar os planos padrão (`STARTER`, `PRO`, `BUSINESS`) e o usuário `SUPER_ADMIN` configurado nas variáveis de ambiente:

```bash
npm run seed
```

---

## 4. Onboardar Empresa Piloto (Como SUPER_ADMIN)

1. Faça login na interface com a conta `SUPER_ADMIN_EMAIL` e `SUPER_ADMIN_PASSWORD`.
2. Acesse o **Painel Plataforma** em `/app/admin/companies`.
3. Clique em **Onboard Nova Empresa**.
4. Insira os dados da empresa piloto e do administrador inicial:
   - **Nome Fantasia**: `Empresa Piloto Ltda`
   - **Razão Social**: `Empresa Piloto de Testes Limitada`
   - **CNPJ**: `12.345.678/0001-00`
   - **Nome do Administrador**: `Carlos Gestor`
   - **E-mail do Administrador**: `admin@empresapiloto.com`
   - **Plano**: `PRO`
5. Clique em **Salvar e Gerar Credenciais**.
6. **Importante**: Copie a senha temporária exibida em tela imediatamente. Ela é salva de forma segura apenas como hash (`pbkdf2Sync`) no banco de dados e nunca mais será exibida.

---

## 5. Importar Funcionários via CSV

Acesse o sistema com a conta de e-mail do administrador inicial criado no onboarding. Acesse `/app/employees/import` e faça o upload de uma planilha contendo a equipe piloto.

### Exemplo de CSV Válido (`funcionarios.csv`)
```csv
name,cpf,email,whatsapp,sector,workModel,managerEmail,workScheduleName
Ana Souza,12345678901,ana.souza@empresapiloto.com,5511999990001,Vendas,REMOTE,,Jornada Remota Flexível
Carlos Lima,23456789012,carlos.lima@empresapiloto.com,5511999990002,Vendas,PRESENTIAL,admin@empresapiloto.com,Jornada Presencial Standard
Julia Cruz,34567890123,julia.cruz@empresapiloto.com,5511999990003,T.I.,HYBRID,admin@empresapiloto.com,Jornada Presencial Standard
```

*Nota: Se o CPF do funcionário já estiver cadastrado na empresa, ele será pulado (skipped). Qualquer erro de validação (como CPF incompleto) aborta toda a transação.*

---

## 6. Configurar Canal de WhatsApp Simulado

Para fins de validação no ambiente de staging:
1. Vá em **Config. WhatsApp** (`/app/settings/whatsapp`).
2. O canal já vem configurado de fábrica no modo `SIMULATED` para testes sem custo.
3. Você pode ver as mensagens trocadas no log de mensagens simuladas do dashboard para garantir que os check-ins estão disparando corretamente.

---

## 7. Validar Health Checks do Sistema

Verifique a saúde operacional dos serviços fazendo requisições GET:

- `/api/health/live`: Retorna status `200 OK` básico.
- `/api/health/ready`: Valida conexões ativas com o banco de dados PostgreSQL, caminhos de storage, e decodificação das chaves de criptografia.

---

## 8. Rodar Checklist de Homologação

Como administrador da empresa piloto, acesse `/app/onboarding` para ver a lista interativa de etapas de go-live dinâmicas e garanta que todos os requisitos estejam verdes.
