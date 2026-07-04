# Playbook do Command Center Executivo & Operações SaaS (Sprint 29)

Este manual estabelece as rotinas diárias e semanais de monitoramento comercial, financeiro, técnico e de suporte que o `SUPER_ADMIN` deve executar por meio do Command Center Consolidado do PresençaFlow RH.

---

## 1. Rotina Diária do SUPER_ADMIN (Cockpit Check)

Toda manhã (preferencialmente até as 09:30), o administrador deve abrir o **Command Center** (`/app/admin/command-center`) e executar a varredura preventiva:

1. **Atestar Erros Operacionais (Plataforma):**
   - Verifique o card **Erros (24h)**. Se houver mais de 5 erros acumulados, acesse a tela de **Suporte** para inspecionar os logs de exceção do sistema.
2. **Priorizar Alertas Críticos (HIGH/Vermelhos):**
   - **Mensalidade Vencida (`OVERDUE_ACCOUNT`):** Acione imediatamente o time de contas a receber para conciliação ou cobrança amigável.
   - **Alto Risco de Churn (`HIGH_CHURN_RISK`):** Envie um e-mail de engajamento preventivo ou marque uma reunião técnica rápida de suporte com o RH do cliente.
   - **Saúde Crítica (`CRITICAL_HEALTH`):** O cliente está com uso baixíssimo da plataforma de ponto. Agende uma reunião de capacitação com a equipe deles.
3. **Revisar Erros de Conexão WhatsApp:**
   - Se o card de telemetria indicar alertas de WhatsApp, acesse o painel correspondente para reconectar o QR Code da empresa cliente afetada.

---

## 2. Rotina Semanal de Gestão SaaS

Toda sexta-feira à tarde, realize a consolidação do funil comercial e faturamento:

1. **Avaliação de Receita (MRR Manual):**
   - Acompanhe a evolução do MRR Manual consolidando o valor dos clientes ativos e aguardando pagamento.
2. **Revisão de Leads Parados (CRM Comercial):**
   - Acesse os alertas do tipo **Lead Sem Contato** ou **Follow-up Vencido** e mova os leads pendentes no funil.
3. **Janelas de Renovação Contratual:**
   - Filtre renovações para os próximos 30 dias. Entre em contato com clientes saudáveis (`healthStatus === 'GOOD'`) para assinar o termo de renovação antecipadamente.

---

## 3. Interpretação dos KPIs Principais

- **MRR Manual:** Soma equivalente mensal do valor negociado em contratos físicos das assinaturas nos status ativos ou aguardando pagamento. Clientes em trial ou cancelados não entram.
- **Risco Churn Alto:** Contas ativas com inadimplência prolongada combinada com engajamento de uso crítico ou sem nenhuma batida de ponto recente (14 dias).
- **Taxa de Resposta Global:** Média percentual da taxa de resposta de check-ins de todas as empresas cadastradas nos últimos 7 dias. O ideal saudável é manter este índice acima de 75%.

---

## 4. Limitações dos Indicadores

- **Sem Gateway Integrado:** Todas as conciliações de pagamento exibidas no painel de MRR dependem de preenchimento manual de data de recebimento e baixa feita pelo SUPER_ADMIN.
- **Auditoria de Erros:** Os contadores de erros são baseados em exceções capturadas e gravadas no `AuditLog`. Interrupções completas de rede externa do servidor podem não ser contabilizadas localmente.
