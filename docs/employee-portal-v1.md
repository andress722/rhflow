# Portal do Colaborador V1 - Documentação de Segurança e IDOR

Esta documentação descreve a arquitetura de segurança do Portal do Colaborador V1 no PresençaFlow RH.

## Escopo Funcional V1
O portal do colaborador destina-se a dar acesso direto ao funcionário para consultar suas próprias informações operacionais de jornada de trabalho:
1. **Minhas Batidas**: Histórico de marcações de check-in remoto realizadas no mês atual.
2. **Meu Saldo**: Saldo consolidado no Banco de Horas e extrato de transações de ajuste (crédito/débito).
3. **Minhas Solicitações/Afastamentos**: Histórico e status de solicitações de abonos, folgas e férias (`LeaveRequest`).

---

## Estratégia de Prevenção a IDOR (Insecure Direct Object Reference)

### 1. Derivação do Perfil via Contexto JWT
Para evitar ataques de IDOR e parameter tampering (onde um usuário altera parâmetros para obter dados de terceiros), os endpoints de consulta do portal **nunca** aceitam um `employeeId` enviado nas rotas, parâmetros de query ou corpo da requisição.

A identificação é feita de forma estritamente implícita no backend:
- O middleware de autenticação decodifica o token JWT e extrai o `email` e o `companyId` do usuário autenticado.
- O backend busca a linha correspondente na tabela `Employee` onde `email === request.user.email` e `companyId === request.user.companyId`.
- Caso o e-mail não esteja vinculado a nenhum funcionário da mesma empresa, o backend retorna `404 Not Found` imediatamente.

### 2. Restrições Multitenant
Toda consulta posterior (extrato do banco de horas, marcações de check-in e solicitações de afastamento) filtra os registros obrigatoriamente pelo ID do colaborador derivado de forma segura no passo anterior, impedindo qualquer acesso a dados de outros funcionários ou de outras empresas (tenants).

---

## Testes de Validação
Os cenários de segurança foram cobertos na suíte automatizada `backend/tests/sprint52.test.ts`:
- **IDOR**: Tentativas de burlar o parâmetro para ler dados de outro colaborador.
- **Cross-tenant**: Tentativa de um colaborador logado em uma empresa ler dados de um funcionário cadastrado em outra empresa (bloqueado com 404/403).
