# Procedimentos de Backup e Restauração (Postgres & Storage)

Este guia documenta o processo de backup e restauração dos dados estruturados do banco de dados (PostgreSQL) e dos arquivos físicos enviados pelos usuários (atestados médicos e comprovantes) armazenados no `STORAGE_PATH`.

---

## 💾 1. Backup do Banco de Dados (PostgreSQL)

O banco de dados PostgreSQL roda dentro do contêiner Docker `presencaflow-db-prod`. Para fazer o backup completo de forma consistente sem interromper o serviço, execute o utilitário `pg_dump`:

### Comando para gerar backup em arquivo compactado:
```bash
docker exec -t presencaflow-db-prod pg_dump -U postgres -F c presencaflow > ./backups/db_backup_$(date +%Y%m%d_%H%M%S).dump
```

---

## 📂 2. Backup dos Arquivos Físicos (STORAGE_PATH)

Os arquivos enviados pelos funcionários (como atestados médicos e mídias) ficam persistidos no volume persistente do Docker mapeado no caminho `STORAGE_PATH` (definido no contêiner backend em `/app/storage`).

Para fazer o backup dessa pasta, execute um backup compactado em `tar`:

### Comando de backup do Storage:
```bash
tar -czf ./backups/storage_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /var/lib/docker/volumes/presencaflow_agent_base_backend_storage/_data .
```
*(Nota: Ajuste o caminho do volume persistente de acordo com o mapeamento configurado no Docker Host local).*

---

## 🔄 3. Procedimento de Restauração (Restore)

### Restauração do Banco de Dados (Postgres)
Se for necessário subir uma nova instância ou restaurar o banco de dados a partir de um backup dump:

1. Pare os contêineres dependentes (backend/frontend) para interromper conexões abertas:
   ```bash
   docker compose -f docker-compose.prod.yml stop backend frontend
   ```
2. Derrube e recrie o banco de dados vazio:
   ```bash
   docker exec -it presencaflow-db-prod dropdb -U postgres presencaflow
   docker exec -it presencaflow-db-prod createdb -U postgres presencaflow
   ```
3. Execute a restauração do arquivo dump:
   ```bash
   docker exec -i presencaflow-db-prod pg_restore -U postgres -d presencaflow < ./backups/db_backup_arquivo.dump
   ```
4. Suba novamente toda a pilha de contêineres:
   ```bash
   docker compose -f docker-compose.prod.yml start
   ```

### Restauração dos Arquivos Físicos (Storage)
Para restaurar a pasta de atestados a partir do backup compactado `.tar.gz`:

1. Localize o volume físico do Docker correspondente ao storage ou o diretório de storage definido no `.env` (ex: `/app/storage`).
2. Descompacte os arquivos no diretório de destino:
   ```bash
   tar -xzf ./backups/storage_backup_arquivo.tar.gz -C /var/lib/docker/volumes/presencaflow_agent_base_backend_storage/_data
   ```
3. Certifique-se de que as permissões de leitura/escrita pertençam ao usuário ou grupo correto para evitar erros de escrita em produção.

---

## ⏰ 4. Automação de Backups Diários (Sugestão via Crontab)

Recomenda-se criar um script shell agendado via cron para automatizar os backups no servidor:

```bash
#!/bin/bash
BACKUP_DIR="/opt/presencaflow/backups"
mkdir -p $BACKUP_DIR

# Backup DB
docker exec -t presencaflow-db-prod pg_dump -U postgres -F c presencaflow > $BACKUP_DIR/db_$(date +%F).dump

# Backup Storage Files
tar -czf $BACKUP_DIR/storage_$(date +%F).tar.gz -C /var/lib/docker/volumes/presencaflow_agent_base_backend_storage/_data .

# Limpeza: apagar backups com mais de 15 dias de histórico
find $BACKUP_DIR -type f -mtime +15 -delete
```
