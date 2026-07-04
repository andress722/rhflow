# Playbook de Base de Conhecimento e Central de Ajuda — PresençaFlow RH

Este guia define as políticas operacionais de escrita, categorização, governança de dados e fluxos de atualização para a Base de Conhecimento e a Central de Ajuda.

---

## 1. Fluxo de Criação e Redação

Qualquer membro da equipe de Customer Success ou Engenharia de Suporte pode redigir rascunhos de artigos. No entanto, a publicação oficial (`status: PUBLISHED`) é exclusiva dos administradores seniores (`SUPER_ADMIN`).

### Padrão de Escrita e Estrutura de Documentos:
1. **Título**: Linguagem direta iniciada por verbos de ação ou perguntas comuns (ex: *Como importar funcionários* ou *Como resolver problemas de conexão do WhatsApp*).
2. **Resumo (Summary)**: Uma frase curta (máx 500 caracteres) explicando o objetivo do guia.
3. **Markdown Estruturado**:
   - Utilize Heading 1 (`#`) para o título do corpo.
   - Utilize Heading 2 (`##`) para passos principais.
   - Utilize blocos de código (\`...\`) para referenciar rotas ou IDs de interface.
   - Destaque termos cruciais em negrito.

---

## 2. Classificação de Audiência (Audience Roles)

Para evitar vazamento de regras de negócios confidenciais ou instruções técnicas confusas para usuários errados, siga estritamente a tabela abaixo:

| Audiência | Destinatários | Escopo do Conteúdo |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | Engenheiros de CS / DevOps | Configurações internas de limites de planos, debug de logs de WhatsApp e comandos CLI. |
| **ADMIN_HR** | Administradores de RH dos clientes | Importação de planilhas CSV, configuração de tolerâncias de jornada, aprovação final de atestados. |
| **MANAGER** | Gestores de equipe dos clientes | Revisão e abonos de ocorrências de sua equipe, exportação de relatórios locais. |
| **EMPLOYEE** | Colaboradores finais | Passo a passo para bater ponto no WhatsApp, envio de foto do atestado pelo chat. |
| **PUBLIC** | Clientes prospectos / Não logados | Perguntas frequentes gerais sobre funcionamento da ferramenta e links de suporte externo. |

---

## 3. Conversão de Feedbacks em Artigos

A principal fonte de novos artigos é a Central de Feedbacks. Se mais de 3 incidentes com a categoria `QUESTION` ou `USABILITY` sobre o mesmo tema surgirem na semana:
1. **Analise**: O CS deve condensar as dúvidas em uma instrução passo a passo clara.
2. **Escreva**: Crie um novo artigo com audiência apropriada e salve como `DRAFT`.
3. **Vincule**: No fechamento dos feedbacks resolvidos por este tutorial, selecione o `knowledgeArticleId` correspondente.

---

## 4. Cuidados com LGPD e Privacidade

> [!CAUTION]
> **Segurança de Dados Pessoais na Base de Conhecimento:**
>
> 1. **Zero CPFs/Telefones reais**: Todos os exemplos e capturas de tela simuladas devem usar CPFs mascarados ou nomes fictícios (ex: "Fulano de Tal", "123.456.789-00").
> 2. **Sem dados de Saúde / CIDs**: Jamais cite CIDs médicos (Classificação Internacional de Doenças) ou nomes de doenças associadas a colaboradores em tutoriais de atestado.
> 3. **Higienização Automática**: O backend higieniza tags de scripts e substitui CPFs brutos de 11 dígitos, mas a verificação visual humana antes da publicação é obrigatória.

---

## 5. Rotina de Revisão Semanal

Toda sexta-feira, a equipe de CS deve conduzir uma revisão técnica na base:
- **Artigos Defasados**: Atualizar capturas de tela ou fluxos caso as telas do sistema tenham mudado.
- **Transição de Rascunhos**: Aprovar e publicar artigos criados a partir dos feedbacks semanais.
- **Artigos Stale / Antigos**: Mudar o status para `ARCHIVED` em artigos obsoletos (evitando que apareçam nos resultados de buscas).
