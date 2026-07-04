# Checklist de Hardening de Segurança (Sprint 28)

Este documento descreve as auditorias de segurança, controles e verificações executadas para blindar o PresençaFlow RH antes do lançamento oficial em ambiente de produção.

---

## 1. Auditoria de Controle de Acesso (RBAC)

Verificamos sistematicamente que cada perfil de usuário acessa estritamente os recursos autorizados:

- [x] **SUPER_ADMIN:** Acesso exclusivo aos endpoints administrativos `/api/admin/*`, faturamento comercial, CRM de pilotos e retenção geral. Bloqueado de operar endpoints corporativos normais sem o escopo de tenant correspondente.
- [x] **ADMIN & HR:** Acesso total à gestão de colaboradores, jornadas, ocorrências, atestados, relatórios e configurações de WhatsApp e empresa dentro do seu próprio tenant (empresa).
- [x] **MANAGER:** Acesso restrito a relatórios e visualizações de colaboradores sob sua supervisão direta (ou de sua própria empresa). Bloqueado de editar configurações globais da empresa.
- [x] **VIEWER:** Acesso somente-leitura. Bloqueado de criar, atualizar ou remover qualquer recurso (todas as requisições `POST`, `PUT`, `PATCH` e `DELETE` retornam `403 Forbidden`).

---

## 2. Isolamento de Tenants (Multi-Tenancy)

Garantimos que a arquitetura isola completamente os dados de empresas clientes distintas:

- [x] **Identificação de Tenant:** Cada requisição autenticada extrai e valida o `companyId` codificado no JWT seguro.
- [x] **Isolamento de Queries:** Todas as buscas no banco de dados de funcionários, jornadas, check-ins, ocorrências, atestados e relatórios contêm cláusulas estritas `where: { companyId }`.
- [x] **Prevenção de Cruzamento:** Testes automatizados confirmam que se um administrador da *Empresa A* tentar ler ou editar a ID de um colaborador da *Empresa B*, a API responderá com `404 Not Found`, ocultando a existência do recurso.

---

## 3. Conformidade de Dados e LGPD Operacional

Privacidade de informações sensíveis implementada:

- [x] **Mascaramento de CPF:** CPFs em visualizações da lista e exportações CSV de presença de colaboradores são ocultados.
- [x] **Omissão de Chaves de Acesso:** Tokens JWT expirados, segredos de assinatura e tokens de integração (WhatsApp secrets, chaves de webhook) nunca são retornados nas APIs públicas.
- [x] **Logs de Auditoria Seguros (`AuditLog`):** Logs de auditoria de CRM e Notas Financeiras salvam apenas indicadores booleanos de alteração (ex: `financeNotesChanged: true`), impedindo que textos longos de justificativas comerciais ou notas de caixa contendo dados sensíveis entrem em logs brutos legíveis.

---

## 4. Segurança do Ambiente (Ambiente de Produção)

Hardening de variáveis e endpoints em produção:

- [x] **Stack Traces:** Em ambiente de produção (`NODE_ENV === 'production'`), mensagens de erro internas são ocultadas por uma mensagem genérica de segurança e o stack trace do Node.js é completamente omitido.
- [x] **Internal Jobs:** Endpoints de jobs internos (`/api/internal/jobs/*`) exigem obrigatoriamente o cabeçalho `x-internal-job-secret` para serem executados, retornando `401 Unauthorized` em caso de ausência ou inconsistência.
- [x] **Health Check Cleanliness:** A rota `/api/health/ready` de telemetria não expõe segredos de conexão.
- [x] **CORS:** O CORS de produção restringe requisições para origens expressamente autorizadas.
