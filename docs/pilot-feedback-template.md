# Template de Feedback do Piloto (Pilot Feedback Template)

Utilize a tabela abaixo para registrar todos os atritos, bugs, dúvidas ou melhorias observadas pelos usuários (RH, Gestores, Super Admin) durante a execução da operação assistida.

| ID | Data | Usuário | Perfil | Empresa | Tela | Descrição do Problema | Passos para Reproduzir | Resultado Esperado | Resultado Obtido | Severidade | Prioridade | RequestID | Evidência/Print | Responsável | Status | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **001** | 21/06/2026 | ana@piloto.com | HR | Empresa Piloto A | Login | Erro de senha incorreta exibe mensagem crua sem estilização amigável. | 1. Tentar logar com senha errada | Mensagem de erro vermelha com animação de shake e estilo premium. | Texto padrão do navegador em modal simples sem alinhamento. | Cosmético | P3 | - | - | João | Concluído | Ajustado estilo visual na tela de login. |
| **002** | 21/06/2026 | jose@piloto.com | ADMIN | Empresa Piloto B | Importação CSV | Submissão de planilha sem CPF travou sem resposta visual. | 1. Subir CSV inválido | Exibição clara de erro de validação (Zod) informando que o CPF é obrigatório. | Botão congelado indefinidamente e erro no console. | Alto | P1 | `52fa8087-faec-4f11-8be9-e092106ca8ef` | - | Maria | Concluído | Injetado requestId no console e adicionado disabled no botão de submit. |
| **003** | 21/06/2026 | gestor@piloto.com | MANAGER | Empresa Piloto A | Dashboard | Exibição de 403 Forbidden ao tentar exportar sem permissão não explica o motivo. | 1. Tentar exportar relatório como MANAGER | Mensagem informativa indicando que o plano atual não suporta exportações. | Tela branca com erro genérico de rede. | Médio | P2 | `99ef7190-bebc-4d32-90ab-129aa87e834b` | - | João | Concluído | Ajustado interceptor no frontend para decodificar códigos e apresentar toast amigável. |

---

## 📌 Guia de Referência

### Severidade
* **Crítico:** Falha que impede a continuação da operação (crash, travamento geral de fluxo essencial).
* **Alto:** Bug funcional importante que possui alternativa difícil (ex: importação de arquivos falhando de vez).
* **Médio:** Comportamento incorreto de UI ou fluxo secundário com alternativa simples.
* **Baixo:** Comportamento inconsistente ou detalhe menor de facilidade de uso.
* **Cosmético:** Erro de escrita, alinhamento, cores ou fontes.

### Prioridade
* **P0:** Bloqueante, deve ser corrigido imediatamente para viabilizar o piloto.
* **P1:** Urgente, deve ser corrigido antes do término do piloto.
* **P2:** Importante, planejar correção para a próxima release.
* **P3:** Desejável, melhorias gerais e cosméticas sem impacto imediato.
