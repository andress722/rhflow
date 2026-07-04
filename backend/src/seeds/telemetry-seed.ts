import { prisma } from '../lib/prisma';

export async function seedTelemetryEvents() {
  console.log('Seeding simulated telemetry events...');

  const now = new Date();
  const eventCategories = ['ONBOARDING', 'PRESENCE', 'SUPPORT', 'MEDICAL_CERTIFICATE', 'KNOWLEDGE_BASE'];

  // Let's create page views, critical actions, and report exports for the last 30 days
  const eventsToCreate: any[] = [];

  // Generate 50 simulated events
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const rand = Math.random();
    let eventName = 'PAGE_VIEW';
    let category = 'PRESENCE';
    let properties: any = { path: '/app/presence' };

    if (rand < 0.4) {
      eventName = 'PAGE_VIEW';
      const paths = ['/app/presence', '/app/onboarding', '/app/reports', '/app/medical-certificates', '/app/help'];
      const chosenPath = paths[Math.floor(Math.random() * paths.length)];
      category = chosenPath.includes('help') ? 'KNOWLEDGE_BASE' : 'PRESENCE';
      properties = { path: chosenPath };
    } else if (rand < 0.7) {
      eventName = 'CRITICAL_ACTION';
      const actions = ['DISPARAR_LOTE', 'APROVAR_ATESTADO', 'JUSTIFICAR_OCORRENCIA'];
      const action = actions[Math.floor(Math.random() * actions.length)];
      category = action.includes('ATESTADO') ? 'MEDICAL_CERTIFICATE' : 'PRESENCE';
      properties = { actionType: action };
    } else if (rand < 0.85) {
      eventName = 'REPORT_EXPORTED';
      category = 'REPORTS';
      properties = { format: 'CSV', filters: { month: '2026-06' } };
    } else {
      eventName = 'ARTICLE_VIEW';
      category = 'KNOWLEDGE_BASE';
      const articles = [
        'Como importar funcionários',
        'Como usar check-in remoto',
        'Como enviar e revisar atestados',
        'Como interpretar Health Score',
      ];
      const title = articles[Math.floor(Math.random() * articles.length)];
      properties = { title, slug: title.toLowerCase().replace(/\s+/g, '-') };
    }

    eventsToCreate.push({
      companyId: 'company-1',
      userId: `user-${Math.floor(Math.random() * 5) + 1}`,
      eventName,
      category,
      properties,
      createdAt: date,
    });
  }

  // Use createMany to seed fast
  await prisma.usageTelemetry.createMany({
    data: eventsToCreate,
  });

  console.log(`Seeded ${eventsToCreate.length} telemetry events successfully.`);
}

if (require.main === module) {
  seedTelemetryEvents()
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
