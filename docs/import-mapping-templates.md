# Modelos de Mapeamento (Mapping Templates)

Esta documentação descreve o funcionamento e a governança de templates de mapeamento no PresençaFlow RH.

---

## 1. Funcionamento Técnico

Quando os cabeçalhos de uma planilha (CSV ou XLSX) não condizem com a nomenclatura interna das propriedades, o usuário pode configurar de forma personalizada o mapeamento no passo 4 do wizard.

Para evitar re-configuração repetitiva para planilhas geradas de forma padronizada por sistemas de folha de pagamento externos, o usuário pode salvar o layout como template:
* O template associa um nome personalizado (ex: "Planilha Admissão Senior") ao mapeamento de colunas correspondentes.
* Os dados são armazenados na tabela `ImportMappingTemplate` no banco de dados.

---

## 2. Isolamento de Tenants (Multitenancy)

O isolamento é rígido a nível de banco de dados (`companyId` indexado):
* As operações de leitura, criação e atualização validam o `companyId` do token JWT do usuário autenticado.
* Consultas a templates inexistentes ou pertencentes a outros tenants retornam erro `404 Not Found` de forma neutra, impedindo vazamento de layouts estruturais ou informações corporativas confidenciais.
