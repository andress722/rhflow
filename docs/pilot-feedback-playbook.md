# Playbook de Feedback e Registro de Incidentes do Cliente Piloto — PresençaFlow RH

Este guia define os processos de registro técnico, classificação de severidade, privacidade e governança LGPD para coletar e tratar feedbacks do primeiro cliente piloto.

---

## 1. Categorias de Feedback

Para categorizar corretamente os registros na plataforma:

- **BUG:** Comportamento inesperado do sistema que impede a conclusão de um fluxo (ex: erro 500 ao salvar atestado).
- **QUESTION (Dúvida):** Colaborador ou gestor não sabe como executar um processo que funciona normalmente.
- **USABILITY (Usabilidade):** O fluxo é confuso, demandando múltiplos cliques ou com visual poluído.
- **TRAINING (Treinamento):** RH solicita videochamada ou material explicativo adicional.
- **FEATURE_REQUEST:** Solicitação de novas regras de negócio não cobertas pelo escopo original da plataforma.
- **INCIDENT (Incidente):** Falha que impacta a infraestrutura de comunicação (ex: mensagens enfileiradas no WhatsApp sem envio).
- **COMMERCIAL:** Questões contratuais ou financeiras de faturamento.

---

## 2. Classificação de Severidade

Defina a criticidade para priorização na fila de desenvolvimento técnico:

| Severidade | Descrição | Ação Esperada |
| :--- | :--- | :--- |
| **LOW (Baixa)** | Pequeno ajuste de layout ou alteração textual simples. | Tratamento na fila normal de sprints subsequentes. |
| **MEDIUM (Média)** | Dúvida de uso ou erro em fluxo secundário com contorno simples. | Resolução ou material de suporte enviado em até 24h. |
| **HIGH (Alta)** | Bloqueio de fluxo principal de um grupo de funcionários (ex: atestado falhando). | Correção resolvida em até 4h por hotfix. |
| **CRITICAL (Crítica)** | Interrupção total do sistema, vazamento ou falha geral (ex: check-ins do WhatsApp parados). | Acionamento imediato do comitê com resolução em até 1h. |

---

## 3. Diretrizes de Privacidade e LGPD

> [!CAUTION]
> **Proteção de Dados Pessoais (LGPD):**
> É expressamente proibido salvar informações pessoais sensíveis nos campos de descrição, impacto ou ação tomada do feedback.
>
> 1. **CPF de Colaboradores:** Nunca insira o CPF completo nos logs. O backend automaticamente substituirá CPFs brutos detectados por `***.***.***-**`.
> 2. **Dados Médicos e Atestados:** Não transcreva diagnósticos de CIDs ou laudos médicos na descrição dos bugs de atestado. Limite-se a descrever a falha sistêmica (ex: "erro de upload no arquivo do colaborador ID X").
> 3. **Imagens/Prints:** Evite salvar prints contendo fotos pessoais ou informações sensíveis sem desfoque (blur).

---

## 4. Fluxo de Backlog e Resolução

1. **Captura:** O time de Customer Success registra o feedback no console admin (`/app/admin/pilot-feedback`).
2. **Priorização:** Itens classificados como `HIGH` ou `CRITICAL` acionam alertas visuais automáticos no **Command Center**.
3. **Escalação:** Engenharia atua no bug gerando um hotfix e atualizando o status para `RESOLVED` no painel.
4. **Comunicação:** CS notifica o RH do cliente piloto real detalhando a ação corretiva adotada.
