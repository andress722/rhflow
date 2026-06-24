# 05 — Frontend: Páginas e Componentes

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Query
- React Hook Form
- Zod

## Layout principal

- Sidebar
- Header
- Breadcrumb
- Área de conteúdo
- Toasts
- Modal de confirmação

## Rotas

- /login
- /app/dashboard
- /app/employees
- /app/employees/[id]
- /app/work-schedules
- /app/occurrences
- /app/occurrences/[id]
- /app/medical-certificates
- /app/absences
- /app/remote
- /app/reports
- /app/settings/users
- /app/settings/automation

## Dashboard

Cards:

- Sem ponto hoje
- Atrasos hoje
- Faltas avisadas
- Atestados em análise
- Afastamentos ativos
- Problemas técnicos remotos
- Pendências por gestor

Tabelas:

- Ocorrências abertas
- Atestados pendentes
- Check-ins remotos não respondidos

## Funcionários

Tabela com:

- Nome
- CPF mascarado
- WhatsApp
- Setor
- Gestor
- Modelo de trabalho
- Status
- Ações

Ações:

- Ver detalhes
- Editar
- Inativar

## Ocorrências

Tabela com:

- Tipo
- Funcionário
- Setor
- Gestor
- Data
- Status
- Origem
- Ações

Detalhe:

- Dados principais
- Timeline
- Mensagens WhatsApp
- Anexos
- Ações: resolver, rejeitar, comentar, encaminhar ao RH

## Atestados

Tabela com:

- Funcionário
- Data de envio
- Status
- Dias aprovados
- Período de afastamento
- Ações

Tela de análise:

- Preview do arquivo
- Dados do funcionário
- Campos de decisão do RH
- Aprovar
- Rejeitar
- Solicitar reenvio

## Trabalho remoto

Telas:

- Check-ins pendentes
- Check-outs pendentes
- Problemas técnicos
- Status por funcionário

## Relatórios

Filtros:

- Período
- Setor
- Gestor
- Tipo de ocorrência
- Status

Exportações:

- Excel
- CSV
- PDF gerencial no futuro
