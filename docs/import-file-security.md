# Importador de Colaboradores — Políticas de Segurança de Arquivos

Esta documentação descreve as camadas de segurança física e lógica aplicadas ao processamento de planilhas de importação (CSV e XLSX) no PresençaFlow RH.

---

## 1. Controle de Limites Físicos (DoS & ZipBomb Protection)
Para evitar exaustão de memória no servidor Fastify durante o parse de arquivos XLSX:
* **Tamanho Máximo do Arquivo**:
  * **CSV**: Capped em **2MB** por requisição.
  * **XLSX**: Capped em **10MB** por requisição.
* **Quantidade de Linhas**: Limite rígido de **5.000 linhas** por importação. Arquivos com mais linhas são rejeitados imediatamente no upload antes do parse de todas as células.
* **Timeout de Parsing**: Operações de parse síncronas de planilhas são protegidas por limites de tempo na leitura de células do SheetJS.

---

## 2. Validação por Magic Bytes (Falsificação de Mime/Extensão)
Para mitigar uploads maliciosos contendo executáveis camuflados de planilhas:
* O backend lê os primeiros 4 bytes do buffer enviado.
* Arquivos XLSX são arquivos ZIP compactados. É verificado se o arquivo inicia obrigatoriamente com a assinatura PK Zip (`0x50 0x4B 0x03 0x04`). Se a extensão for `.xlsx` mas os magic bytes não condizerem, o arquivo é descartado imediatamente (`MALFORMED_FILE`).

---

## 3. Prevenção a Fórmulas e Macros (Excel Formula Injection - CSV Injection)
Para evitar que atacantes gravem comandos maliciosos no banco de dados que possam ser executados por administradores ao baixar planilhas:
* **Macros e Fórmulas Ignoradas**: O parser XLSX é instruído a ignorar e não executar fórmulas no SheetJS (`cellFormula: false`).
* **Proteção de Saída (Sanitização no download)**:
  * Qualquer célula de erro ou metadados que inicie com `=`, `+`, `-` ou `@` é higienizada prependando um apóstrofo `'` antes do caractere. Isso garante que visualizadores de planilhas interpretem o conteúdo como string pura.
