# Playbook de Implantação e Onboarding Assistido — Cliente Piloto

Este documento fornece as diretrizes para implantadores, gerentes de conta (CS) e administradores de TI ativarem com sucesso um cliente piloto na plataforma PresençaFlow.

---

## 📅 Visão Geral e Tempo Esperado

O tempo estimado para ativação completa de uma empresa no programa piloto é de **3 a 5 dias úteis**, dependendo da agilidade na coleta de dados dos funcionários.

| Fase | Ação | Responsável | Tempo Estimado |
| :--- | :--- | :--- | :--- |
| **Dia 1** | Reunião de Alinhamento (Kickoff) | CS / Implantador | 1 hora |
| **Dia 2** | Importação de Dados & Configuração | Cliente (Admin/HR) | 2 horas |
| **Dia 3** | Integração do WhatsApp & Regras | TI do Cliente / CS | 1 hora |
| **Dia 4** | Treinamento dos Gestores & Equipe | CS / Liderança | 1.5 horas |
| **Dia 5** | Teste Prático & Go-Live | CS & Admin do Cliente | 1 hora |

---

## 🛠️ Passo a Passo para Ativação do Cliente

### Passo 1: Kickoff Inicial
- Realizar a reunião inicial de kickoff com a gerência do cliente piloto.
- Alinhar expectativas, coletar informações básicas e definir o patrocinador do piloto.
- **Ação no Sistema**: Marcar a etapa manual `kickoff_done` (Reunião de Alinhamento) como concluída no painel de onboarding.

### Passo 2: Configuração da Conta e Equipe
1. **Perfil da Empresa**: Acessar as Configurações da Empresa e preencher a Razão Social/Fantasia e o CNPJ.
2. **Administradores**: Garantir a criação de pelo menos 1 usuário Administrador ativo na plataforma.
3. **Regras**: Definir regras padrão de tolerância (tempo de tolerância de atraso) e habilitar o módulo de check-in remoto.

### Passo 3: Importação de Funcionários e Jornadas
1. **Jornadas**: Criar jornadas de trabalho com os horários planejados de entrada/saída.
2. **Funcionários**: Importar a base de colaboradores (via planilha CSV ou preenchimento manual).
3. **Atribuição**: Vincular cada funcionário a uma jornada de trabalho e a um gestor responsável.

### Passo 4: Ativação do Canal de WhatsApp
- Configurar e conectar o número de telefone da empresa na plataforma.
- Certificar-se de que a conexão esteja com status `CONNECTED`. Se operando localmente ou em desenvolvimento, utilize a conexão `SIMULATION` ou o provider `SIMULATED` para testes preliminares.

### Passo 5: Treinamento e Homologação
- Executar os treinamentos práticos com os RHs e Gestores operacionais.
- **Ação no Sistema**: Marcar a etapa manual `customer_trained` como concluída.

### Passo 6: Teste de Prontidão e Homologação
- Acessar o painel de Onboarding e clicar em **"Testar Prontidão"** para executar o diagnóstico não destrutivo.
- Corrigir eventuais bloqueios críticos levantados pelo diagnóstico.

---

## 🔍 Como Interpretar Diagnósticos (Blockers & Warnings)

O dashboard calcula um score dinâmico baseado na conclusão das etapas obrigatórias.

### 🔴 Bloqueios Críticos (Blockers)
Impedem o lançamento da operação do piloto e devem ser solucionados imediatamente:
- **Sem Administrador Ativo**: A empresa não possui um ponto de contato de gerenciamento.
- **Sem Funcionários Ativos**: Não há destinatários para o envio de check-ins de ponto.
- **Sem Jornada de Trabalho Ativa**: O sistema não consegue monitorar atrasos ou ausências sem uma referência de jornada.
- **Sem Regras de Empresa (CompanySettings)**: Limites de tolerância e regras operacionais estão ausentes.
- **Canal de WhatsApp Ausente**: O motor de comunicação não pode enviar as mensagens de alerta.

### 🟡 Alertas Recomendados (Warnings)
Não impedem a operação técnica, mas podem prejudicar a experiência ou a governança do piloto:
- **WhatsApp em Simulação**: Indica que as mensagens de teste não serão enviadas a telefones reais.
- **Sem Gestores Atribuídos**: Alertas de ocorrências operacionais podem não ser direcionados para as pessoas certas.
- **Sem Check-in Testado**: Recomenda-se realizar pelo menos 1 disparo de teste de presença remota antes de ir a campo.
- **Sem Ocorrência Registrada**: Recomenda-se validar a criação automática ou registro manual de incidentes.

---

## ⚠️ Principais Erros no Onboarding e Como Evitá-los

1. **CPF ou WhatsApp inválidos no CSV**: Importações falham se o formato de CPF contiver espaços ou se os números de WhatsApp não estiverem com DDD e código de país corretos.
2. **Jornada não atribuída**: Se um funcionário for cadastrado sem escala vinculada, o sistema não calculará seus horários de batida, gerando ausências fictícias.
3. **Storage sem permissão**: Em novas implantações, certifique-se de que o diretório definido por `STORAGE_PATH` possui permissão de escrita para salvamento de atestados e imagens.
