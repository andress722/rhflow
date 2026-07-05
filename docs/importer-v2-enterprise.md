# Importador Corporativo V2 — Especificações Técnicas

Esta documentação descreve os endpoints da API, o esquema de dados do banco de dados e os fluxos de validação aplicados no Importador Corporativo V2 do PresençaFlow RH.

---

## 1. Modelos de Dados (Prisma Schema)

Foram criados três novos modelos no banco de dados para gerenciar o estado da importação:

### `ImportJob`
Modela uma importação do início ao fim, mantendo o status, os registros brutos em formato JSON e contadores estatísticos:
* `status`: `UPLOADED | PARSING | MAPPING | VALIDATING | READY | QUEUED | IMPORTING | COMPLETED | PARTIAL | FAILED | CANCELLED`
* `mode`: `CREATE_ONLY | UPDATE_EXISTING | UPSERT`
* `parsedData`: Armazena as linhas lidas do arquivo em JSONB (evitando re-leitura de buffers).

### `ImportMappingTemplate`
Salva as configurações de colunas associadas a um tenant.
* `mappings`: Objeto JSON contendo o de/para de cabeçalhos.

### `ImportValidationIssue`
Armazena inconsistências encontradas durante a validação prévia de cada linha.

---

## 2. API Contract

### Envio do Arquivo
* **Endpoint**: `POST /api/import-jobs/upload`
* **Content-Type**: `multipart/form-data`
* **Response**: Retorna prévia das primeiras 10 linhas, cabeçalhos identificados e `jobId`.

### Salvar Mapeamento
* **Endpoint**: `PUT /api/import-jobs/:jobId/mapping`
* **Payload**: `{ mappings: { name: '...', cpf: '...', ... } }`
* **Ação**: Atualiza o job e roda a validação prévia.

### Confirmação e Fila
* **Endpoint**: `POST /api/import-jobs/:jobId/confirm`
* **Payload**: `{ mode: 'CREATE_ONLY | UPDATE_EXISTING | UPSERT' }`
* **Ação**: Move o job para `QUEUED` e insere na fila de processamento Redis `rhflow:import:queue`.

### Progresso
* **Endpoint**: `GET /api/import-jobs/:jobId/progress`
* **Response**: Retorna a contagem atual e percentual de progresso em tempo real.

### Download de Erros
* **Endpoint**: `GET /api/import-jobs/:jobId/errors/download`
* **Response**: Stream de arquivo CSV com os erros higienizados.
