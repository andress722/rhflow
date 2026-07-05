# Importador de Colaboradores V1 - Especificações de Segurança e Robusteza

Esta documentação descreve as regras de negócio, limites operacionais, validações de MIME e proteção contra injeção de fórmulas no Importador Inteligente V1.

---

## 1. Limites Operacionais e Validação de Entrada
Para garantir estabilidade e evitar abuso de recursos (Denial of Service), o importador aplica limites estritos:
* **Tamanho de Arquivo**: Máximo de **2MB** por arquivo enviado.
* **Limite de Linhas**: Máximo de **500 linhas** (colaboradores) por upload de CSV.
* **Validação de Extensão**: Somente arquivos com extensão `.csv` são permitidos.
* **Validação de MIME Type**: O backend valida que o tipo MIME do arquivo pertence aos permitidos (`text/csv`, `application/csv`, `application/vnd.ms-excel`).

---

## 2. Validações de Dados (Estritas por Linha)
Durante a validação e importação em lote, as seguintes regras são aplicadas:
1. **CPF Obrigatório e Válido**: O CPF deve conter exatamente 11 dígitos numéricos após remoção de formatações.
2. **Prevenção de Duplicidades**:
   - Bloqueia uploads contendo CPFs duplicados no próprio arquivo.
   - Bloqueia inserções de CPFs que já constem no banco de dados para a mesma empresa (tenant).
3. **Isolamento Multitenant (Manager/Schedule)**:
   - Se um `managerUserId` for informado, o backend valida se este usuário pertence à mesma empresa (`companyId`).
   - Se um `workScheduleId` for informado, o backend valida se a escala pertence à mesma empresa (`companyId`).
   - Qualquer inconsistência rejeita a linha correspondente com uma mensagem explicativa.

---

## 3. Atomicidade da Importação (All-or-Nothing)
Para a rota de persistência real `/api/employees/batch-import`, o importador adota uma política de **All-or-Nothing** (Tudo ou Nada) utilizando transações Prisma (`prisma.$transaction`). 
- Se qualquer linha contiver erro de dados (CPF duplicado, gestor inválido, etc.) ou violar o isolamento multitenant, a transação inteira sofre rollback, garantindo que a base de dados nunca fique em estado parcial ou inconsistente.

---

## 4. Prevenção a Formula Injection (CSV Export)
Para proteger computadores de administradores contra execução remota de código e vazamento de dados via planilhas eletrônicas (Microsoft Excel, LibreOffice, Google Sheets), todas as células exportadas no relatório operacional CSV passam por higienização:
- Se qualquer valor de célula inicia com `=`, `+`, `-`, ou `@`, o caractere é escapado prependando um apóstrofo `'` na frente da célula. Isso instrui o Excel/Sheets a renderizar o conteúdo estritamente como texto em vez de tentar avaliar a fórmula.
- Arquivo de higienização: [reports.service.ts](file:///e:/RHFLOW/rhflow/backend/src/services/reports.service.ts).
