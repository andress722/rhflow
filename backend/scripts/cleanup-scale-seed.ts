import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  // Safety checks
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SCALE_SEED !== 'true') {
    console.error('CRITICAL: Cleanup of scale seed data is blocked in production unless ALLOW_SCALE_SEED=true is set.');
    process.exit(1);
  }

  if (!args.includes('--confirm')) {
    console.error('CRITICAL: You must provide the --confirm argument to execute the scale cleanup.');
    console.error('Usage: npx ts-node scripts/cleanup-scale-seed.ts --confirm');
    process.exit(1);
  }

  console.log('Fetching all SCALE_TEST_ companies...');
  const companies = await prisma.company.findMany({
    where: {
      name: { startsWith: 'SCALE_TEST_' }
    },
    select: { id: true, name: true }
  });

  if (companies.length === 0) {
    console.log('No SCALE_TEST_ companies found. Cleaning up CRM Pilot Leads...');
    const pilotLeadsRes = await prisma.pilotLead.deleteMany({
      where: { name: { startsWith: 'SCALE_TEST' } }
    });
    console.log(`Removed ${pilotLeadsRes.count} pilot leads.`);
    console.log('Cleanup finished.');
    return;
  }

  const companyIds = companies.map(c => c.id);
  console.log(`Found ${companies.length} companies to remove. Purging related records...`);

  // Purge nested records sequentially to avoid foreign key constraints
  const auditLogs = await prisma.auditLog.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${auditLogs.count} audit logs.`);

  const messageLogs = await prisma.whatsAppMessageLog.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${messageLogs.count} WhatsApp message logs.`);

  const usageCounters = await prisma.usageCounter.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${usageCounters.count} usage counters.`);

  const certificates = await prisma.medicalCertificate.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${certificates.count} medical certificates.`);

  const occurrencesEvents = await prisma.occurrenceEvent.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${occurrencesEvents.count} occurrence events.`);

  const occurrences = await prisma.occurrence.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${occurrences.count} occurrences.`);

  const checkins = await prisma.remoteCheckin.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${checkins.count} remote check-ins.`);

  const employees = await prisma.employee.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${employees.count} employees.`);

  const users = await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${users.count} users.`);

  const subscriptions = await prisma.companySubscription.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${subscriptions.count} subscriptions.`);

  const settings = await prisma.companySettings.deleteMany({ where: { companyId: { in: companyIds } } });
  console.log(`Removed ${settings.count} company settings.`);

  const companiesRes = await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  console.log(`Removed ${companiesRes.count} companies.`);

  const pilotLeadsRes = await prisma.pilotLead.deleteMany({
    where: { name: { startsWith: 'SCALE_TEST' } }
  });
  console.log(`Removed ${pilotLeadsRes.count} pilot leads.`);

  console.log('Scale cleanup completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
