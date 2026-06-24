# Checklist de Ativação Operacional — Piloto

Este documento contém os marcos operacionais detalhados que devem ser seguidos e verificados antes e durante a primeira semana de operação de um cliente piloto na plataforma PresençaFlow.

---

## 📋 Checklist Pré-Piloto (Antes do Go-Live)

- [ ] **Alinhamento Inicial**: Kickoff concluído e aprovado formalmente.
- [ ] **Empresa e CNPJ**: Razão Social e CNPJ cadastrados nas configurações.
- [ ] **Jornadas Cadastradas**: Pelo menos 1 jornada de trabalho ativa e parametrizada com horários e tolerância corretos.
- [ ] **Funcionários Importados**: Lista de funcionários piloto cadastrada com CPFs e números de WhatsApp válidos.
- [ ] **Responsáveis Configurados**: Pelo menos 1 administrador do cliente treinado na plataforma.
- [ ] **WhatsApp Homologado**: Canal conectado com sucesso e mensagem padrão de boas-vindas testada.
- [ ] **Diagnóstico Técnico**: Execução do "Teste de Prontidão" finalizada sem blockers críticos ativos.

---

## 🌞 Checklist do Primeiro Dia de Operação

- [ ] **Monitoramento do Primeiro Disparo**: Validar se os check-ins remotos automáticos de ponto foram gerados nos horários corretos baseados nas escalas dos funcionários.
- [ ] **Acompanhamento no WhatsApp**: Garantir que as mensagens foram entregues pelo canal e certificar-se de que não há logs de erro em `WhatsAppMessageLog`.
- [ ] **Atendimento ao Colaborador**: Garantir suporte rápido caso algum funcionário informe erro no recebimento ou preenchimento das respostas de presença.
- [ ] **Fechamento de Batidas**: Verificar a geração de ocorrências automáticas para colaboradores que não responderam na janela de grace period de check-in.

---

## 📅 Checklist da Primeira Semana

- [ ] **Rotina de Gestores**: Acompanhar se os gestores responsáveis estão analisando e justificando as ocorrências de sua equipe diariamente.
- [ ] **Módulo de Atestados**: Simular o envio e homologação de pelo menos 1 atestado médico recebido para validar o fluxo de abono e anexação de arquivos.
- [ ] **Revisão de Indicadores**: Gerar os relatórios operacionais consolidados de presença e exportar a planilha semanal para conferência de auditoria.
- [ ] **Feedback de TI**: Verificar logs de erros operacionais no painel do suporte a fim de garantir estabilidade contínua.

---

## 🎯 Critérios de Sucesso (Go-Ahead)

O piloto é considerado um sucesso técnico e operacional se atender aos seguintes critérios após 7 dias de monitoramento:
1. **Engajamento**: Taxa de resposta de check-in dos funcionários superior a **90%**.
2. **Tempo de Resolução**: Ocorrências tratadas e resolvidas pelos gestores/RH em menos de **24 horas**.
3. **Estabilidade**: Zero falhas críticas de infraestrutura ou perda de arquivos de atestados.
4. **Precisão**: Batidas e abonos correspondendo exatamente com a realidade informada.

---

## 🛑 Critérios de Impasse (No-Go)

A operação piloto deve ser suspensa ou postergada caso:
1. **Bloqueio de Canal**: O número de WhatsApp da empresa seja banido ou sofra bloqueio consecutivo pelos serviços da Meta.
2. **Adesão Crítica**: Menos de **50%** dos colaboradores respondam aos alertas nas primeiras 48 horas de operação.
3. **Instabilidade do Banco**: Erros recorrentes de escrita no banco de dados impedindo o registro de ocorrências ou pontos.
4. **Falta de Liderança**: Liderança ou gerência do cliente piloto não acompanhando as atividades e ignorando o tratamento do fluxo operacional.

---

## ☎️ Quando Escalar para o Suporte Técnico

Os administradores do cliente devem acionar o suporte técnico global PresençaFlow em caso de:
- Falhas na geração automática de arquivos temporários de storage ao testar a prontidão.
- Instabilidade recorrente ou mensagens de erro `500 Server Error` com IDs de request (`requestId`) nas telas de configuração.
- Erros de autenticação ou quebra de sessão para usuários administradores.
- Rejeição de requisições de webhook da API do WhatsApp.
