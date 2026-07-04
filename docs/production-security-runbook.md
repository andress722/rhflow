# Runbook de Segurança em Produção (Sprint 28)

Este runbook descreve as rotinas de infraestrutura, rotação de segredos e plano de resposta a incidentes de segurança para o PresençaFlow RH.

---

## 1. Gestão e Rotação de Chaves Criptográficas

Todas as chaves criptográficas de produção devem ser armazenadas de forma segura em gerenciadores de segredos (ex: AWS Secrets Manager, HashiCorp Vault ou secrets da plataforma de hospedagem).

### Chaves Críticas:
1. **`JWT_SECRET`:** Utilizada para assinar tokens de autenticação de usuários.
2. **`ENCRYPTION_SECRET`:** Chave AES de 32 bytes (256-bit) utilizada para encriptar dados sensíveis de contato e tokens de terceiros no banco de dados.
3. **`INTERNAL_JOB_SECRET`:** Chave de autorização de requisições HTTPS para execução de cronjobs.

### Procedimento de Rotação de `JWT_SECRET`:
> [!WARNING]
> A rotação da `JWT_SECRET` invalidará imediatamente todas as sessões ativas dos clientes, exigindo que realizem login novamente.
1. Gere um novo hash seguro: `openssl rand -base64 32`.
2. Atualize a variável `JWT_SECRET` nas configurações do ambiente de produção.
3. Realize o deploy contínuo da aplicação para recarregar o processo.

---

## 2. Backup e Restauração de Dados (Disaster Recovery)

### Backup Automatizado (Banco de Dados PostgreSQL):
- Configure snapshots automáticos diários com retenção de 30 dias na console RDS/Cloud SQL.
- Backup lógico preventivo via CLI:
  ```bash
  pg_dump -U postgres -h [host_prod] -d presencaflow -F c -b -v -f presencaflow_backup_$(date +%F).dump
  ```

### Procedimento de Restauração (Restore):
1. Crie uma nova base de dados limpa.
2. Restaure o dump:
  ```bash
  pg_restore -U postgres -h [host_prod] -d presencaflow -v presencaflow_backup_xxxx.dump
  ```

---

## 3. Resposta a Incidentes de Segurança

### Vazamento ou Suspeita de Comprometimento de Chave:
1. **Identifique a Extensão:** Verifique qual segredo foi comprometido (ex: `ENCRYPTION_SECRET`).
2. **Substituição Imediata:** Revogue a chave afetada e gere uma substituta seguindo o passo 1.
3. **Auditoria:** Consulte a tabela de `AuditLog` filtrando por ações atípicas no período.
4. **Comunicação (LGPD):** Caso dados pessoais de colaboradores (ex: CPF, telefone) tenham sido expostos, notifique o encarregado DPO da empresa cliente afetada dentro do prazo legal.

---

## 4. Hardening de Infraestrutura de Rede

- **Portas Expostas:** Somente as portas `80` (HTTP redirecionado) e `443` (HTTPS) devem ser expostas publicamente.
- **Isolamento do Banco de Dados:** O banco de dados PostgreSQL e o cache Redis devem rodar dentro de sub-redes privadas (VPC) sem acesso direto à internet.
- **Cabeçalhos de Segurança:** O backend utiliza proteção CORS restrita em produção, limitando requisições apenas a partir do domínio configurado em `FRONTEND_URL`.
