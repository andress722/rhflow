# Playbook de Backlog do Piloto e Release Notes — PresençaFlow RH

Este documento define o fluxo operacional e as diretrizes para triagem de feedbacks do cliente piloto, transformação em itens de backlog de engenharia, classificação, redação de notas de lançamento (release notes) e governança LGPD.

---

## 1. Fluxo de Triagem e Conversão (Feedback &rarr; Backlog)

Todo feedback ou incidente reportado na primeira semana pelo cliente piloto real deve passar pelo processo de triagem antes de ir para a fila de desenvolvimento técnico:

1. **Captura inicial**: Feedbacks entram como `PilotFeedback` (status `OPEN` ou `IN_REVIEW`) via painel ou APIs de monitoramento.
2. **Avaliação Técnica**: O `SUPER_ADMIN` ou Engenheiro de CS avalia o impacto e a viabilidade da correção.
3. **Conversão**: O feedback é convertido em `PilotBacklogItem` clicando no botão "Criar Backlog" na interface de feedbacks. Isso realiza o vínculo entre as entidades e move o feedback automaticamente para o status `PLANNED`.

---

## 2. Tipos de Item no Backlog

Categorize o item de backlog de acordo com a natureza da ação:

- **BUGFIX (Correção de Bug)**: Correção de falha sistêmica onde a plataforma não executa a regra de negócio correta (ex: atestado médico recusado sem log).
- **IMPROVEMENT (Melhoria)**: O fluxo funciona, mas a usabilidade ou performance pode ser refinada (ex: carregar histórico de ponto 2 segundos mais rápido).
- **CONFIGURATION (Configuração)**: Parâmetros operacionais específicos da empresa que precisam de ajuste manual no banco ou ambiente (ex: alteração nos limites de tolerância de atraso).
- **TRAINING (Treinamento)**: Demanda de mentoria, explicações adicionais ao RH ou novos tutoriais.
- **DOCUMENTATION (Documentação)**: Atualização em playbooks, manuais do usuário ou runbooks de infraestrutura.
- **FEATURE_REQUEST (Solicitação de Recurso)**: Escopo de produto novo que não faz parte do MVP da Sprint atual.

---

## 3. Critérios de Prioridade e Níveis de Acordo de Serviço (SLA)

| Prioridade | Gravidade Correspondente | Impacto Operacional | Tempo de Resposta (SLA) |
| :--- | :--- | :--- | :--- |
| **URGENT** | CRITICAL | Sistema indisponível ou vazamento de dados. | Resolução em até 1 hora. |
| **HIGH** | HIGH | Bloqueio de funcionalidade core para um departamento inteiro. | Resolução em até 4 horas. |
| **MEDIUM** | MEDIUM | Erro pontual com contorno alternativo funcional. | Resolução em até 24 horas. |
| **LOW** | LOW | Melhoria estética ou dúvida simples de layout. | Planejado para sprint seguinte. |

---

## 4. Redação de Release Notes e Comunicação

Ao finalizar um item de backlog, defina o campo `releaseNote` com linguagem amigável focada no usuário final, evitando detalhes técnicos complexos.

### Bons Exemplos de Release Note:
- **Correto**: *"Corrigimos a validação no upload de atestados médicos. Agora, arquivos PDF com mais de 5MB são validados antes do envio com mensagem clara de limite."*
- **Incorreto**: *"Ajustado o middleware de validação do Multer limitando bytes no header HTTP e corrigido erro 500 no backend."*

### Como Comunicar Correções ao Cliente:
1. Gere o documento de Release Notes filtrando os itens `DONE` da empresa do cliente pelo período desejado.
2. Copie o markdown gerado no modal da interface.
3. Envie via canal de WhatsApp integrado ou e-mail de fechamento semanal ao gestor de RH do cliente piloto.

---

## 5. Cuidados de Privacidade e LGPD

> [!IMPORTANT]
> **Privacidade dos Dados no Backlog:**
>
> 1. **Mascaramento Automático**: O backend mascarará automaticamente CPFs identificados nos campos de texto livre (`title`, `description`, `rootCause`, `plannedAction`, `releaseNote`).
> 2. **Dados Sensíveis de Saúde**: Não escreva descrições contendo nomes de colaboradores associados a CIDs médicos específicos. Use sempre IDs técnicos para rastrear problemas no processamento de atestados.
> 3. **Causa Raiz & Ações**: Não exponha tokens de APIs da Meta ou senhas do banco de dados na causa raiz do item do backlog.
