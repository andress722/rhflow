# Plano de Rollback de Produção — PresençaFlow RH

Este documento define as diretrizes, gatilhos de severidade e procedimentos técnicos detalhados para reverter com segurança uma implantação em produção comercial em caso de falha crítica pós-deploy.

---

## 1. Critérios de Acionamento (Gatilhos de Severidade)

O comitê técnico/responsável operacional deve avaliar e acionar o rollback caso qualquer uma das seguintes situações ocorra nas primeiras **24 horas pós-deploy**:

| Severidade | Descrição / Sintoma | Ação Recomendada |
| :--- | :--- | :--- |
| **SEV 1 — Crítico** | Falha geral da API (Erro 500 generalizado), banco de dados inacessível, vazamento visível de credenciais nos logs públicos, ou falha persistente no Health Check `ready`. | **Rollback Imediato** (Prazo de decisão: 15 minutos). |
| **SEV 2 — Alto** | Incapacidade total de cadastrar leads no `/pilot`, falha persistente de autenticação de usuários administradores, falha crítica na importação de CSVs. | **Rollback Planejado** se não houver correção (hotfix) viável em até 1 hora. |
| **SEV 3 — Médio** | Falha nos scripts analíticos (Analytics), sitemap ausente, erros de formatação de copy menores na Landing Page. | **Não reverter**. Resolver via hotfix ou deploy subsequente na fila de desenvolvimento. |

---

## 2. Procedimento Técnico de Reversão

Siga as etapas abaixo para restabelecer o ambiente comercial na última versão estável conhecida.

### Passo A: Reversão da Aplicação (Frontend/Backend)
Reverta os servidores da aplicação para a imagem estável anterior (ou commit tag estável anterior).

#### Se usando Docker / Containers:
Substitua a tag da imagem de produção no arquivo de deploy pela tag da versão anterior e aplique:
```bash
# Exemplo se rodando docker-compose
docker-compose -f docker-compose.prod.yml down
# Ajustar tag no arquivo ou .env
docker-compose -f docker-compose.prod.yml up -d
```

#### Se usando Git local:
```bash
git checkout TAG_VERSAO_ANTERIOR
cd backend && npm run build && npm run start
cd ../frontend && npm run build && npm run start
```

### Passo B: Reversão de Configurações (Env)
Se o deploy envolveu novas variáveis de ambiente que causaram incompatibilidade, restaure o arquivo `.env` para a cópia de segurança salva antes do deploy.

---

## 3. Cuidado com as Migrations e Reversão do Banco de Dados

> [!CAUTION]
> **Migrations do Prisma NÃO são reversíveis de forma automática.** O comando `prisma migrate deploy` é destrutivo por natureza caso altere restrições ou tipos de colunas.
>
> Reverter apenas o código da aplicação mantendo a estrutura do banco atualizada **pode causar falhas de inicialização** no backend anterior devido à divergência de schemas (divergência de tabelas ou campos ausentes).

Para lidar com a divergência de banco no rollback, escolha **uma** das estratégias abaixo de acordo com o impacto de dados do período em que o novo sistema esteve no ar:

### Cenário 1: Sem dados reais inseridos no período do bug (Recomendado)
Se a falha foi detectada imediatamente pós-deploy (pelo smoke test) e nenhum cliente real inseriu dados novos na aplicação:
1. **Restaurar Banco Pré-Deploy**: Restaure o dump de segurança gerado imediatamente antes do deploy usando o script operacional:
   ```powershell
   powershell -ExecutionPolicy Bypass -File ./scripts/ops/restore-postgres.ps1 `
     -TargetDatabaseUrl "SUA_DATABASE_URL_PRODUCTION" `
     -BackupFile "./backups_pre_deploy/presencaflow_backup_pre_deploy.dump" `
     -AllowProductionOverride
   ```
   *Nota: O script exigirá a confirmação digitando `RESTORE` para validar a operação.*

### Cenário 2: Clientes reais inseriram dados novos na aplicação
Se o bug foi detectado horas após o go-live e reverter o banco por completo causará perda de registros válidos de batida de ponto ou atestados de colaboradores:
1. **Manter o Schema**: Não restaure o backup antigo. Tente reverter apenas o código da aplicação e verifique se o Prisma Client antigo funciona contra a estrutura de banco atualizada (geralmente funciona se foram criados apenas novos campos opcionais ou tabelas independentes, como a tabela de UTMs no banco).
2. **Escrever Migration Manual**: Se houver incompatibilidade física, a equipe de banco de dados deve aplicar scripts SQL manuais de alteração (`ALTER TABLE`) para adequar as colunas aos requisitos da versão anterior sem apagar as linhas inseridas.

---

## 4. Validação Pós-Rollback

Após restabelecer o código e banco na versão estável anterior, verifique os seguintes indicadores:
1. Acesse `https://api.presencaflow.com.br/api/health/ready` e confirme status `OK`.
2. Acesse `/login` e tente se autenticar com uma conta corporativa existente.
3. Consulte a fila do Redis e logs de ocorrências para certificar-se de que os workers não estão falhando ao processar novas batidas de ponto.

---

## 5. Comunicação de Indisponibilidade

Caso o processo de rollback demande um período de manutenção offline de mais de **10 minutos**, emita um aviso formal no site para os clientes corporativos do RH.

### Template de E-mail / Comunicado na Plataforma:
> **Comunicado Importante: Manutenção Emergencial na Plataforma**
>
> Prezado Cliente PresençaFlow,
>
> Identificamos uma instabilidade técnica momentânea durante nossa última atualização do sistema. Para garantir a integridade dos seus dados corporativos e o correto registro de ponto dos seus colaboradores, nossa equipe técnica está executando um procedimento de manutenção preventiva.
>
> A plataforma ficará temporariamente instável/indisponível durante os próximos [X] minutos. Fique tranquilo: todos os batimentos de presença pelo WhatsApp pendentes serão enfileirados e processados normalmente assim que os sistemas forem restabelecidos.
>
> Agradecemos a compreensão.
>
> *Equipe de Engenharia PresençaFlow RH*
