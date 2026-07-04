# Playbook de Relatórios Executivos e Pacotes de Evidências

Este playbook orienta o time comercial, de customer success (CS) e os administradores no uso dos relatórios executivos gerados pelo PresençaFlow para comprovação de valor, renovação de contratos e governança de dados.

---

## 1. Quando Gerar o Relatório Executivo

O relatório executivo deve ser gerado e enviado ao cliente nas seguintes ocasiões:
1. **Reunião Mensal de Checkpoint**: Avaliação da adoção operacional do piloto.
2. **Fim do Período de Piloto (Go-Live)**: Apresentação dos resultados gerais para tomada de decisão sobre a contratação definitiva.
3. **Renovação Contratual Anual**: Evidenciar o valor acumulado e justificar o retorno sobre o investimento (ROI).

---

## 2. Como Interpretar as Métricas

### 2.1 Evolução do Health Score
O Health Score avalia a saúde operacional do cliente de 0 a 100 com base em adoção, engajamento e erros.
- **Aumento no Score**: Indica melhora no engajamento dos colaboradores (ex: taxa de resposta superior a 75%) e estabilidade técnica.
- **Queda ou Score Baixo**: Sinaliza gargalos de uso (ex: atestados pendentes na fila, colaboradores não respondendo ou canal do WhatsApp desconectado).

### 2.2 Taxa de Resposta de Check-in
Mede a adesão diária dos colaboradores ao check-in remoto via WhatsApp/Plataforma.
- **Meta Ideal**: > 80%.
- **Menor que 50%**: Indica necessidade de alinhamento interno ou treinamento dos funcionários.

---

## 3. Reuniões de Renovação e Apresentação de Valor

- **Foque nas Evidências**: Use a lista de **Melhorias e Ajustes Entregues no Período** (backlog resolvido) para mostrar que a plataforma evoluiu de acordo com as necessidades específicas do cliente.
- **Aponte os Próximos Passos**: Use a seção de recomendações para engajar o cliente na regularização de pendências (ex: atestados sem avaliação).

---

## 4. Cuidados com a LGPD e Segurança da Informação

Como o relatório pode ser copiado e enviado a diretores e stakeholders externos, a higienização de dados pessoais e sensíveis é obrigatória.

### 4.1 Regras de Higienização Aplicadas pelo Sistema
- **Sem CPFs**: CPFs são automaticamente mascarados para `***.***.***-**`.
- **Sem Dados Médicos Sensíveis**: Não são expostos CIDs, diagnósticos, descrições detalhadas de exames ou nomes de doenças. O sistema resume apenas contagens de atestados enviados e validados.
- **Sem Mensagens WhatsApp**: Nenhuma mensagem ou conversa privada trocada via canal corporativo é transcrita.
- **Sem Informações Comerciais no Relatório do Cliente**: O relatório corporativo do ADMIN/HR é gerado sem anotações comerciais internas (`commercialNotes`) ou dados de faturamento interno.

---

## 5. Linguagem Permitida vs. Linguagem Proibida

Evite promessas indevidas ou afirmações não comprovadas por dados exatos.

| Linguagem Permitida | Linguagem Proibida (Evitar) |
| :--- | :--- |
| "A taxa de resposta dos check-ins atingiu 82% no período analisado." | "O sistema garante conformidade legal e trabalhista completa." |
| "Houve uma evolução de +15 pontos no Health Score da empresa no último mês." | "O PresençaFlow reduziu o absenteísmo em 40% (sem ter o dado real)." |
| "Foram tratados 12 atestados médicos pendentes no período." | "Os funcionários pararam de fraudar atestados médicos com a plataforma." |
| "Itens de backlog entregues no período listados na seção 4." | "A plataforma agora está 100% livre de bugs." |
