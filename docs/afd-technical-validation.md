# Validação Técnica da Exportação AFD

A exportação AFD (Arquivo de Fonte de Dados) no PresençaFlow é auditada de forma estrutural pelo `AfdValidatorService`.

---

## Regras de Validação Técnica
- **Sequência de Registros**: O identificador inicial numérico (primeiros 9 caracteres) é incrementado sequencialmente de 1 em 1.
- **Estrutura dos Tipos**: Cabeçalho (tipo 1), Trailer (tipo 9) e registros intermediários obrigatórios.
- **Terminadores de Linha**: Padrão do layout exige terminação Windows CRLF (`\r\n`).
- **Limitação**: O validador técnico valida apenas a conformidade sintática, não garantindo a homologação legal perante o MTE.
