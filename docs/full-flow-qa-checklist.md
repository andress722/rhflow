# Roteiro de QA de Fluxo Completo (Sprint 28)

Este documento descreve o roteiro de testes ponta a ponta (E2E) para homologação manual e verificação operacional do ciclo de vida completo de uma empresa cliente no PresençaFlow RH.

---

## Passo 1: Captação de Lead & CRM Comercial
1. [ ] Acesse a landing page pública da plataforma e preencha o formulário de interesse em participar do piloto.
2. [ ] Entre como `SUPER_ADMIN` e acesse o **Painel Comercial** (`/app/admin/leads`).
3. [ ] Certifique-se de que o novo lead aparece listado na tabela com a etiqueta `NEW` e os parâmetros UTM salvos.
4. [ ] Atualize o lead para o status `QUALIFIED` e defina uma data de demonstração.

---

## Passo 2: Conversão em Piloto & Onboarding da Empresa
1. [ ] No painel de leads, clique em **Converter em Piloto**.
2. [ ] Preencha a razão social, CNPJ e crie o administrador principal. Salve.
3. [ ] Acesse **Gestão de Pilotos** (`/app/admin/pilots`) e verifique se a nova empresa está listada como piloto no status `ACTIVE`.
4. [ ] Faça login com as credenciais do novo `ADMIN` corporativo criado.
5. [ ] Siga as etapas do **Checklist de Onboarding** (`/app/onboarding`):
   - Configure o canal do WhatsApp (ou utilize o canal de simulação).
   - Cadastre pelo menos uma jornada de trabalho ativa.
   - Importe colaboradores (em lote via CSV ou manualmente).
   - Ative as configurações de check-in remoto e atestados.

---

## Passo 3: Operação de Ponto, Ocorrências e Atestados
1. [ ] Com o canal do WhatsApp ativo em modo simulação, dispare um lote de check-in.
2. [ ] Responda ao check-in simulado por meio da interface de simulação de mensagens WhatsApp.
3. [ ] No painel de presenças (`/app/presence`), verifique se o check-in do colaborador foi registrado com geolocalização e foto.
4. [ ] Crie uma ocorrência de atraso ou falta injustificada para um colaborador.
5. [ ] Acesse **Ocorrências** (`/app/occurrences`), aprove ou justifique o atraso.
6. [ ] Faça o upload de um atestado médico pelo colaborador.
7. [ ] Acesse **Atestados Médicos** (`/app/medical-certificates`) como `HR` e aprove o documento para abonar a ocorrência.

---

## Passo 4: Telemetria de Sucesso & Conversão
1. [ ] Como `SUPER_ADMIN`, acesse o **Painel de Suporte / CS** (`/app/admin/support/customer-success`).
2. [ ] Localize a empresa e comprove que o **Health Score** foi calculado e reflete o uso ativo de check-ins e atestados.
3. [ ] No painel comercial do lead correspondente, clique em **Gerar Proposta Comercial**.
4. [ ] Preencha os valores da proposta e envie (status muda para `PROPOSAL_SENT`).
5. [ ] Marque o piloto como ganho (`WON`). O status da empresa comercial vira **CONVERTED**.

---

## Passo 5: Configuração Financeira & Análise de Retenção
1. [ ] Acesse **Faturamento e Contratos** (`/app/admin/billing`).
2. [ ] Localize a empresa convertida (estará com status `TRIAL`).
3. [ ] Clique em editar, preencha o valor contratado, ciclo de faturamento e as datas de envio e assinatura do contrato.
4. [ ] Altere o status de cobrança para **ACTIVE** (Ativo).
5. [ ] Acesse **Retenção e Churn** (`/app/admin/retention`).
6. [ ] Certifique-se de que a empresa é classificada na probabilidade de churn (ex: `LOW` se estiver ativa e com uso saudável).
7. [ ] Force um cenário de atraso editando o vencimento (`nextBillingAt`) para uma data passada. Verifique se o status efetivo muda para **OVERDUE** e o risco de churn é reclassificado.
