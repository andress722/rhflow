# Playbook de Telemetria de Uso e Analytics do Produto — PresençaFlow RH

Este documento define os padrões e boas práticas para instrumentação de eventos de telemetria de uso, monitoramento de adoção e privacidade de dados.

---

## 1. Convenção de Nomenclatura de Eventos

Todos os eventos de telemetria devem seguir o padrão **UPPERCASE_WITH_UNDERSCORES** para manter a consistência com as consultas analíticas:

- **PAGE_VIEW**: Acesso a qualquer tela da aplicação. Deve obrigatoriamente incluir a propriedade `path`.
- **CRITICAL_ACTION**: Ações de core business executadas (ex: `DISPARAR_LOTE`, `APROVAR_ATESTADO`, `EXPORTAR_RELATORIO`).
- **ARTICLE_VIEW**: Leitura de tutoriais na central de ajuda.
- **ONBOARDING_ABANDONED**: Abandono de checklists de ativação.

---

## 2. Categorias de Telemetria

Sempre classifique o evento em uma das categorias centrais de produto:
- `ONBOARDING`
- `PRESENCE`
- `SUPPORT`
- `MEDICAL_CERTIFICATE`
- `KNOWLEDGE_BASE`

---

## 3. Diretrizes de Performance (Client-Side)

> [!TIP]
> **Telemetria Não Bloqueante:**
> 
> A chamada de telemetria deve ser disparada em background usando promessas fire-and-forget. Jamais utilize `await` no fluxo de interface do usuário para aguardar a confirmação do evento de telemetria, evitando lentidões na navegação.

---

## 4. Cuidados e Privacidade (LGPD)

> [!CAUTION]
> **Mascaramento e Dados Pessoais:**
> 
> 1. **Mascaramento Automático**: O backend executa varredura recursiva mascarando CPFs de 11 dígitos identificados nos objetos de propriedades.
> 2. **Sem Nomes ou Dados Médicos**: É expressamente proibido anexar nomes de funcionários, números de telefone reais ou informações de CIDs médicos nos metadados de telemetria. Use apenas identificadores técnicos internos (IDs).

---

## 5. Rotina de Revisão Analítica

Toda segunda-feira, a equipe de CS e Produto deve revisar o painel `/app/admin/analytics`:
- Acompanhar a flutuação do DAU/MAU.
- Analisar as taxas de conversão do funil de onboarding (identificando gargalos de ativação).
- Revisar as páginas mais acessadas para priorizar otimizações de performance nestas rotas específicas.
