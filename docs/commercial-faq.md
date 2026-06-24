# FAQ Comercial — PresençaFlow RH

Dúvidas recorrentes apresentadas por prospects, clientes e parceiros durante a qualificação comercial.

---

## 💬 1. O WhatsApp utilizado é real ou simulado?

- **Durante Testes/Piloto:** Disponibilizamos um canal simulado na plataforma para validação ágil do fluxo, permitindo que a empresa teste a jornada de ponta a ponta sem burocracia ou custos extras de telefonia.
- **Em Produção:** O cliente pode integrar o sistema com o canal de WhatsApp oficial da sua empresa através da API oficial do Meta Cloud, garantindo confiabilidade técnica, verificação oficial e entrega de mensagens em alta escala.

---

## 🗄️ 2. O PresençaFlow substitui o Relógio de Ponto Eletrônico (REP)?

- **Não.** A plataforma atua como uma ferramenta operacional complementar e de auditoria para o RH. O PresençaFlow automatiza a coleta de check-ins de presença de colaboradores externos/remotos e o upload de atestados médicos.
- **Como integrar:** Ao final de cada período, o RH exporta o arquivo CSV estruturado da plataforma e o importa no software de tratamento de ponto convencional homologado da empresa.

---

## 🛡️ 3. O sistema está em conformidade com a LGPD?

- **Sim.** O PresençaFlow foi projetado com forte isolamento lógico entre empresas (arquitetura multi-tenant), garantindo que os dados de colaboradores nunca sejam compartilhados ou acessados por terceiros.
- **Tratamento de dados:** Coletamos apenas informações estritamente necessárias para a auditoria de presença laboral (nome, whatsapp, e-mail e atestados). Os metadados de diagnóstico técnicos são limpos e sanitizados de forma automatizada nos logs internos do servidor para preservar a privacidade individual.

---

## 🚀 4. Como funciona o processo de implantação (onboarding)?

O processo é extremamente rápido e estruturado em 3 etapas simples:
1. **Configuração da Empresa e Escala:** Definição dos horários de tolerância e canais de notificação no painel admin.
2. **Cadastro da Equipe:** Importação de funcionários por planilha CSV ou convite direto por e-mail.
3. **Ativação:** Disparo automático dos check-ins diários e treinamento do RH para recebimento de justificativas e atestados.

---

## 👥 5. Gestores de equipe possuem acesso ao painel?

- **Sim.** A plataforma utiliza Controle de Acesso Baseado em Perfis (RBAC).
- O perfil de **MANAGER** (Gestor) visualiza apenas os colaboradores e ocorrências pertencentes à sua respectiva equipe, permitindo descentralizar a validação operacional e reduzindo a carga de trabalho do RH central.

---

## 📊 6. Quais relatórios a plataforma disponibiliza?

Disponibilizamos relatórios consolidados em formato CSV, contendo:
- Histórico completo de check-ins confirmados, atrasados e não respondidos.
- Períodos de afastamentos e ocorrências justificadas ou com atestados médicos associados.
- Filtros avançados por escala de trabalho, setor da empresa e colaborador específico.

---

## 💳 7. Quais são os planos e limites de uso?

Oferecemos planos baseados no número de funcionários ativos no cadastro:
- **Starter (R$ 99/mês):** Até 5 funcionários ativos, check-ins ilimitados, relatórios simples.
- **Professional (R$ 299/mês):** Até 50 funcionários ativos, suporte a módulo de atestados médicos, ocorrências em lote e auditoria.
- **Enterprise (Sob Consulta):** Funcionários ilimitados, canal WhatsApp dedicado (Meta Cloud) e acordos de suporte sob SLA.
