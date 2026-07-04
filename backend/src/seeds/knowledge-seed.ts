import { prisma } from '../lib/prisma';

const initialArticles = [
  {
    title: 'Como importar funcionários',
    slug: 'como-importar-funcionarios',
    category: 'ONBOARDING' as const,
    audience: 'ADMIN_HR' as const,
    status: 'PUBLISHED' as const,
    summary: 'Aprenda como formatar a planilha CSV e importar sua base de funcionários para o PresençaFlow RH.',
    contentMarkdown: `# Como Importar Funcionários

Siga este passo a passo para importar os funcionários do seu cliente piloto:

1. **Baixar o Modelo**: Na tela de Onboarding, clique em "Baixar modelo CSV".
2. **Preencher as Colunas**:
   - \`name\`: Nome completo do funcionário.
   - \`email\`: E-mail corporativo ou pessoal.
   - \`cpf\`: Mascarado ou padrão.
   - \`phone\`: Telefone com DDD e DDI (ex: 5511999999999).
3. **Fazer o Upload**: Selecione o arquivo preenchido e clique em "Processar Importação".
4. **Verificar logs**: Revise os logs para garantir que não houve erros de formato de telefone ou CPFs duplicados.
`,
    tags: ['importação', 'csv', 'onboarding'],
    relatedUrl: '/app/onboarding',
  },
  {
    title: 'Como configurar jornadas',
    slug: 'como-configurar-jornadas',
    category: 'ONBOARDING' as const,
    audience: 'ADMIN_HR' as const,
    status: 'PUBLISHED' as const,
    summary: 'Guia prático para criar e associar escalas e jornadas de trabalho aos colaboradores.',
    contentMarkdown: `# Como Configurar Jornadas de Trabalho

Configurar jornadas corretas é crucial para o cálculo exato de atrasos e faltas operacionais:

1. Acesse o menu **Jornadas** (\`/app/work-schedules\`).
2. Clique em "Nova Jornada" e dê um título identificador (ex: "Escala Administrativa 40h").
3. Defina as tolerâncias de atraso e horário limite de entrada e saída.
4. Salve e clique em "Associar Colaboradores" para aplicar a escala aos funcionários desejados.
`,
    tags: ['jornada', 'escala', 'configuração'],
    relatedUrl: '/app/work-schedules',
  },
  {
    title: 'Como usar check-in remoto',
    slug: 'como-usar-check-in-remoto',
    category: 'CHECKIN' as const,
    audience: 'EMPLOYEE' as const,
    status: 'PUBLISHED' as const,
    summary: 'Instruções para colaboradores baterem ponto remoto via canal do WhatsApp de forma simplificada.',
    contentMarkdown: `# Como Usar o Check-in Remoto pelo WhatsApp

Bater ponto no PresençaFlow RH é extremamente fácil:

1. Envie qualquer mensagem no WhatsApp para o número oficial do seu canal corporativo.
2. O sistema responderá com a solicitação de confirmação de presença.
3. Responda com a palavra de confirmação ou clique no botão rápido.
4. O sistema registrará sua presença e guardará a data e hora oficial.
`,
    tags: ['ponto', 'checkin', 'whatsapp'],
    relatedUrl: '/app/presence',
  },
  {
    title: 'Como revisar ocorrências',
    slug: 'como-revisar-ocorrencias',
    category: 'OCCURRENCES' as const,
    audience: 'MANAGER' as const,
    status: 'PUBLISHED' as const,
    summary: 'Instruções para gestores revisarem faltas, atrasos e justificativas pendentes de colaboradores.',
    contentMarkdown: `# Guia do Gestor: Como Revisar Ocorrências

Acompanhe atrasos e justificativas da sua equipe:

1. Acesse o menu **Ocorrências** (\`/app/occurrences\`).
2. Utilize os filtros de data para visualizar pendências abertas.
3. Se um funcionário justificou a falta, analise o anexo e clique em "Aprovar Justificativa" para abonar, ou "Recusar" para manter o desconto de horas.
`,
    tags: ['ocorrências', 'gestor', 'justificativa'],
    relatedUrl: '/app/occurrences',
  },
  {
    title: 'Como enviar e revisar atestados',
    slug: 'como-enviar-e-revisar-atestados',
    category: 'MEDICAL_CERTIFICATES' as const,
    audience: 'EMPLOYEE' as const,
    status: 'PUBLISHED' as const,
    summary: 'Aprenda como colaboradores anexam atestados médicos e como o RH os valida na plataforma.',
    contentMarkdown: `# Envio e Validação de Atestados Médicos

Processo completo de fluxo de atestados:

1. **Colaborador**: Envia a foto ou PDF do atestado no canal do WhatsApp.
2. **Validação do RH**:
   - Vá para **Atestados Médicos** (\`/app/medical-certificates\`).
   - Clique em "Analisar" no item pendente.
   - Verifique a assinatura do médico e datas de repouso.
   - Aprove para abonar a ocorrência do dia correspondente de forma automatizada.
`,
    tags: ['atestado', 'médico', 'rh'],
    relatedUrl: '/app/medical-certificates',
  },
  {
    title: 'Como exportar relatório',
    slug: 'como-exportar-relatorio',
    category: 'REPORTS' as const,
    audience: 'MANAGER' as const,
    status: 'PUBLISHED' as const,
    summary: 'Guia de fechamento de folha e exportação de dados consolidados em planilhas.',
    contentMarkdown: `# Exportando Relatórios Operacionais

Feche a folha com facilidade:

1. Acesse a tela **Relatórios** (\`/app/reports\`).
2. Escolha entre "Relatório Operacional de Presença" ou "Exportação de Fechamento".
3. Filtre pelo mês atual e clique em "Exportar CSV".
4. O download iniciará de forma assíncrona garantindo a segurança multitenant.
`,
    tags: ['relatórios', 'exportar', 'excel'],
    relatedUrl: '/app/reports',
  },
  {
    title: 'Como interpretar Health Score',
    slug: 'como-interpretar-health-score',
    category: 'FAQ' as const,
    audience: 'ADMIN_HR' as const,
    status: 'PUBLISHED' as const,
    summary: 'Entenda os critérios que compõem a métrica de engajamento e saúde das empresas.',
    contentMarkdown: `# Entendendo o Health Score da sua Empresa

O Health Score mede a aderência e engajamento com a ferramenta:

- **HEALTHY (80-100)**: Colaboradores batem ponto frequentemente e RH valida atestados pendentes em menos de 24h.
- **ATTENTION (50-79)**: Taxa de resposta de check-ins menor que 70% ou ocorrências abertas acumuladas.
- **CRITICAL (0-49)**: Inatividade sistêmica. Fale com nosso suporte.
`,
    tags: ['health', 'score', 'engajamento'],
    relatedUrl: '/app/customer-success',
  },
  {
    title: 'Como acionar suporte',
    slug: 'como-acionar-suporte',
    category: 'TROUBLESHOOTING' as const,
    audience: 'PUBLIC' as const,
    status: 'PUBLISHED' as const,
    summary: 'Canais de comunicação oficiais com o comitê PresençaFlow RH durante o piloto.',
    contentMarkdown: `# Como Acionar o Suporte Técnico

Estamos disponíveis para resolver bugs e dúvidas rapidamente:

1. **WhatsApp Suporte**: Envie mensagem para nosso canal de ajuda dedicado.
2. **Reunião de Alinhamento**: CS realiza chamadas diárias de feedback.
3. **Incidentes Críticos**: Relate qualquer instabilidade geral imediatamente.
`,
    tags: ['suporte', 'ajuda', 'chamado'],
    relatedUrl: '/app/help',
  },
  {
    title: 'Perguntas frequentes do piloto',
    slug: 'perguntas-frequentes-do-piloto',
    category: 'FAQ' as const,
    audience: 'PUBLIC' as const,
    status: 'PUBLISHED' as const,
    summary: 'FAQ com respostas rápidas para as principais dúvidas de implantação.',
    contentMarkdown: `# FAQ — Perguntas Frequentes do Piloto

### O ponto pelo WhatsApp consome dados móveis altos?
Não. A interação é baseada em texto simples ou cliques curtos.

### Como corrigir um ponto registrado incorretamente?
O funcionário deve acionar o gestor de RH, que poderá fazer o ajuste manual da ocorrência no painel administrativo.
`,
    tags: ['faq', 'dúvidas', 'piloto'],
    relatedUrl: '/app/help',
  }
];

export async function seedKnowledgeArticles() {
  console.log('Seeding initial knowledge articles...');
  for (const art of initialArticles) {
    await prisma.knowledgeArticle.upsert({
      where: { slug: art.slug },
      update: {
        title: art.title,
        category: art.category,
        audience: art.audience,
        status: art.status,
        summary: art.summary,
        contentMarkdown: art.contentMarkdown,
        tags: art.tags,
        relatedUrl: art.relatedUrl,
      },
      create: {
        title: art.title,
        slug: art.slug,
        category: art.category,
        audience: art.audience,
        status: art.status,
        summary: art.summary,
        contentMarkdown: art.contentMarkdown,
        tags: art.tags,
        relatedUrl: art.relatedUrl,
      }
    });
  }
  console.log(`Upserted ${initialArticles.length} articles successfully.`);
}

if (require.main === module) {
  seedKnowledgeArticles()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
