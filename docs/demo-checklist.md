# Roteiro de Demonstração Comercial — PresençaFlow RH

Este documento apresenta o checklist e o passo a passo para realizar uma demonstração comercial completa do **PresençaFlow RH**, cobrindo desde o login até a auditoria.

---

## Preparação de Ambiente
Antes de iniciar a apresentação:
1. Certifique-se de que o backend e o frontend estão rodando.
2. Execute o seed de demonstração para carregar a base comercial e os dados simulados:
   ```bash
   cd backend
   npm run seed:demo
   ```

---

## Roteiro de Apresentação Passo a Passo

### 1. Login Administrativo (ADMIN)
*   **Ação:** Acesse a tela de login (`http://localhost:3000/login`).
*   **Dados:** Insira o e-mail `admin@presencaflow.com` e a senha `password123`.
*   **Destaque Visual:** Mostre o painel lateral com a proposta de valor do produto ("Automatize faltas, atestados e presença via WhatsApp").

### 2. Dashboard Estratégico
*   **Ação:** Visualize os cards estatísticos logo após o login.
*   **Destaque:** Mostre os indicadores de Ocorrências Abertas, Faltas Hoje, Taxa de Resposta das cobrâncias e Atestados Médicos aguardando análise. Saliente que o painel é atualizado em tempo real.

### 3. Plano e Uso (Billing)
*   **Ação:** No menu lateral, acesse **Plano e Uso**.
*   **Destaque:** Explique o modelo SaaS de limites de assinatura (STARTER, PRO, BUSINESS). Mostre o uso da empresa de demonstração que está no plano **PRO** e perto do limite (80% de consumo em check-ins remotos, uploads de atestados e exportações).

### 4. Configurações da Empresa (Company Settings)
*   **Ação:** No menu lateral, acesse **Config. Empresa**.
*   **Destaque:** Demonstre a flexibilidade de parametrização sem código (tolerância em minutos do check-in remoto, ativação/desativação de módulos como o de atestados médicos, e personalização dos templates de mensagens enviadas via WhatsApp).

### 5. Gestão de Funcionários
*   **Ação:** Vá para a aba **Funcionários**.
*   **Destaque:** Apresente os filtros e a listagem dos 20 funcionários. Destaque a LGPD: o CPF aparece mascarado (`***.***.***-**`) para manter a privacidade dos dados.

### 6. Painel de Presença & Disparos
*   **Ação:** Vá para **Presença**.
*   **Destaque:**
    *   **Disparo Individual:** Clique em "Disparar Individual", selecione um funcionário e confirme. Explique que o sistema dispara uma notificação interativa pelo WhatsApp.
    *   **Disparo em Lote:** Clique em "Disparar em Lote". Sem selecionar filtros (para priorizar Remote/Hybrid) ou aplicando um filtro setorial, confirme o envio. Mostre a tela de resumo de envio do lote.

### 7. Simulação de Resposta do WhatsApp (Webhook)
*   **Ação:** Simule uma resposta positiva do WhatsApp via API. Pode ser feito executando um script ou usando a chamada curl/Postman na porta `3001` (ou simulando no console do navegador):
    ```bash
    curl -X POST http://localhost:3001/api/webhooks/whatsapp/inbound \
      -H "Content-Type: application/json" \
      -d '{"companyId":"SUA_COMPANY_ID","from":"5511990000001","message":"Sim, confirmado hoje","timestamp":"2026-06-19T21:00:00Z"}'
    ```
*   **Destaque:** Atualize a tela de presença e mostre o status do funcionário mudando para **Confirmado** de forma assíncrona.

### 8. Varredura e Tolerância (Marcar Sem Resposta)
*   **Ação:** Na tela de presença, clique em "Marcar Sem Resposta".
*   **Destaque:** Use a tolerância padrão de 30 minutos. Explique que o sistema encerra a janela e gera automaticamente uma ocorrência de `REMOTE_CHECKIN_NOT_RESPONDED` no perfil dos colaboradores atrasados.

### 9. Upload de Atestado Médico
*   **Ação:** Vá para **Atestados** e clique em enviar atestado.
*   **Destaque:** Selecione o funcionário, anexe um arquivo simulado e envie. Mostre o atestado no status **Recebido** e a criação automática da ocorrência no sistema.

### 10. Fluxo de Análise e Aprovação de Atestado
*   **Ação:** Clique no atestado recém-enviado para abrir a gaveta de análise.
*   **Destaque:**
    *   Mostre a pré-visualização segura do arquivo (PDF/Imagem) obtida via stream seguro.
    *   Aprove o atestado definindo as datas. Mostre o fechamento automático da ocorrência e a notificação simulada de WhatsApp para o gestor.

### 11. Relatório Operacional e Fechamento
*   **Ação:** Vá para **Relatórios**.
*   **Destaque:** Filtre o período e visualize o fechamento consolidado. Demonstre o card "Pendências de Fechamento" que reúne inconformidades antes de rodar a folha de pagamento.

### 12. Exportação de CSV Segura
*   **Ação:** Clique em **Exportar CSV**.
*   **Destaque:** Abra a planilha baixada e mostre que as colunas de CPF estão rigorosamente mascaradas, sem nenhum vazamento de informações sensíveis (atende à LGPD e segurançaDP).

### 13. Trilhas de Auditoria (Audit Log)
*   **Ação:** Explique que toda exportação e ação administrativa gera um registro automático de auditoria com IP, User Agent e Timestamp no banco de dados.

---

## Resumo das Credenciais da Demo
*   **Admin:** `admin@presencaflow.com` / `password123`
*   **RH:** `rh@presencaflow.com` / `password123`
*   **Gestor (Carlos):** `gestor@presencaflow.com` / `password123`
*   **Viewer:** `viewer@presencaflow.com` / `password123`
