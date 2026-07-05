# Sprint 53 — Enterprise Import & Customer Onboarding

Este documento descreve a entrega de engenharia da Sprint 53, detalhando o novo Importador Corporativo V2, a reestruturação das etapas de validação e mapeamento, suporte a arquivos CSV e XLSX, controle de limites e segurança.

---

## 1. Escopo Técnico da Sprint

O principal objetivo da Sprint foi implementar um fluxo robusto e seguro para importação de colaboradores, reduzindo a fricção no onboarding de novos clientes de larga escala (tenants com centenas ou milhares de colaboradores).

Principais módulos desenvolvidos:
* **Upload e Parse Seguro**: Suporte real a CSV e XLSX (SheetJS), com detecção de delimitadores, decodificação BOM UTF-8 e rejeição por magic bytes.
* **Mapeamento de Colunas (Visual)**: Interface interativa de 8 etapas guiadas, permitindo salvar predefinições de templates mapeados por empresa.
* **Auto-Mapeamento Heurístico**: Reconhecimento automático de cabeçalhos baseado em regras de aliases textuais com remoção de acentos e normalizações de caixa de texto.
* **Validação em Lote (Engine)**: Validação matemática do dígito verificador do CPF (checksum real), validação de e-mails, números de WhatsApp estruturados e integridade do multitenant (gestor e escalas scoped por tenant).
* **Fila Assíncrona via Redis**: Processamento em segundo plano desvinculado da thread HTTP, processando os registros em chunks transacionais de 100 linhas.
* **Estatísticas e Relatórios**: Download de planilha de erros com proteção contra Injeção de Fórmulas.

---

## 2. Ordem de Execução e Arquitetura

O processamento segue o seguinte pipeline:

```
Upload (CSV/XLSX) ➔ Worksheet Choice ➔ Preview (10 rows) ➔ Auto-Mapping ➔ Validation ➔ Confirm Mode ➔ Redis Queue ➔ Workers ➔ Progress Polling ➔ Final Statistics & Error Report
```

Todos os endpoints e esquemas foram validados com testes automatizados dedicados, garantindo isolamento completo de multitenant e prevenção contra ataques maliciosos baseados em arquivos de planilha.
