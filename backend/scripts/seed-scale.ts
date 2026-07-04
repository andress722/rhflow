import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST)
    .toString('hex');
  return `${salt}:${hash}`;
}

function generateFakeCPF(): string {
  const num = () => Math.floor(Math.random() * 9);
  const n = Array.from({ length: 9 }, num);
  
  // First digit
  let d1 = n.reduce((acc, digit, idx) => acc + digit * (10 - idx), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  
  // Second digit
  let d2 = n.reduce((acc, digit, idx) => acc + digit * (11 - idx), 0) + d1 * 2;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  
  return `${n.join('')}${d1}${d2}`;
}

async function main() {
  // Safety checks
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SCALE_SEED !== 'true') {
    console.error('CRITICAL: Seeding scale data is blocked in production unless ALLOW_SCALE_SEED=true is set.');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  let companiesCount = 20;
  let employeesCount = 100;
  let managersCount = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--companies') companiesCount = parseInt(args[i + 1], 10);
    if (args[i] === '--employees') employeesCount = parseInt(args[i + 1], 10);
    if (args[i] === '--managers') managersCount = parseInt(args[i + 1], 10);
  }

  console.log(`Starting scale seed: ${companiesCount} companies, ${employeesCount} employees/co, ${managersCount} managers/co.`);
  
  // Compute password hash once to save cpu iterations
  const HASHED_PASSWORD = hashPassword('password123');

  // Verify or retrieve a Plan
  let plan = await prisma.plan.findFirst({ where: { code: 'PRO' } });
  if (!plan) {
    plan = await prisma.plan.findFirst();
  }
  if (!plan) {
    // Create fallback PRO plan
    plan = await prisma.plan.create({
      data: {
        name: 'Pro Fallback',
        code: 'PRO',
        maxEmployees: 1000,
        maxMonthlyCheckins: 50000,
        maxMonthlyUploads: 5000,
        maxMonthlyExports: 500,
        enableReports: true,
        enableBatchCheckin: true,
        enableMedicalModule: true,
        enableExports: true,
      }
    });
  }

  const now = new Date();

  for (let c = 1; c <= companiesCount; c++) {
    const companyName = `SCALE_TEST_Company_${c}`;
    const cnpj = `99${String(c).padStart(12, '0')}`;

    console.log(`Creating company: ${companyName}...`);

    // 1. Company
    const company = await prisma.company.create({
      data: {
        name: companyName,
        legalName: `${companyName} S.A.`,
        cnpj,
        timezone: 'America/Sao_Paulo',
        isActive: true,
        pilotStatus: 'WON',
        convertedAt: new Date(),
      }
    });

    // 2. Settings
    await prisma.companySettings.create({
      data: {
        companyId: company.id,
      }
    });

    // 3. Subscription
    await prisma.companySubscription.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        billingStatus: 'ACTIVE',
        contractedAmountCents: 250000, // R$ 2.500,00
        billingCycle: 'MONTHLY',
        subscriptionStartedAt: now,
        nextBillingAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      }
    });

    // 4. Managers
    for (let m = 1; m <= managersCount; m++) {
      await prisma.user.create({
        data: {
          companyId: company.id,
          name: `SCALE_TEST_Manager_${c}_${m}`,
          email: `manager_${c}_${m}@scale-test.com`,
          passwordHash: HASHED_PASSWORD,
          role: 'MANAGER',
          isActive: true,
        }
      });
    }

    // 5. Employees
    const employees = [];
    for (let e = 1; e <= employeesCount; e++) {
      const emp = await prisma.employee.create({
        data: {
          companyId: company.id,
          fullName: `SCALE_TEST_Employee_${c}_${e}`,
          email: `employee_${c}_${e}@scale-test.com`,
          whatsapp: `551199999${String(c).padStart(2, '0')}${String(e).padStart(3, '0')}`,
          cpf: generateFakeCPF(),
          status: 'ACTIVE',
        }
      });
      employees.push(emp);
    }

    // 6. Checkins (last 30 days, sampled)
    console.log(`Generating check-ins for ${companyName}...`);
    const checkinDays = 30;
    const checkinsBatch = [];

    for (let d = 0; d < checkinDays; d++) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);

      // Only generate check-ins for a fraction of employees to simulate realistic response rates
      for (const emp of employees) {
        if (Math.random() > 0.3) { // 70% response rate simulation
          const isLate = Math.random() > 0.9;
          const status = Math.random() > 0.05 ? (isLate ? 'LATE' : 'CONFIRMED') : 'PENDING';
          const option = status === 'CONFIRMED' ? 'PRESENTE' : (status === 'LATE' ? 'ATRASO' : null);
          
          checkinsBatch.push({
            companyId: company.id,
            employeeId: emp.id,
            checkinDate: date,
            sentAt: new Date(date.getTime() + 8 * 60 * 60 * 1000), // 8:00 AM
            respondedAt: status !== 'PENDING' ? new Date(date.getTime() + 8 * 15 * 60 * 1000) : null,
            status: status as any,
            responseOption: option,
            responseText: option === 'ATRASO' ? 'Trânsito na Marginal' : null,
          });
        }
      }
    }

    // Bulk create checkins
    await prisma.remoteCheckin.createMany({
      data: checkinsBatch
    });

    // 7. Occurrences (e.g. 5 occurrences per company)
    console.log(`Generating occurrences for ${companyName}...`);
    for (let o = 1; o <= 5; o++) {
      const emp = employees[Math.floor(Math.random() * employees.length)];
      const types: any[] = ['ABSENCE', 'LATE_ARRIVAL', 'REMOTE_CHECKIN_NOT_RESPONDED'];
      const type = types[Math.floor(Math.random() * types.length)];
      const status = Math.random() > 0.5 ? 'RESOLVED' : 'OPEN';

      await prisma.occurrence.create({
        data: {
          companyId: company.id,
          employeeId: emp.id,
          type,
          status,
          title: `SCALE_TEST Ocorrência ${type}`,
          description: 'Gerado automaticamente para teste de carga e escala.',
          occurrenceDate: new Date(now.getTime() - o * 2 * 24 * 60 * 60 * 1000),
          severity: o % 2 === 0 ? 'MEDIUM' : 'LOW',
        }
      });
    }

    // 8. Medical Certificates
    console.log(`Generating certificates for ${companyName}...`);
    for (let mc = 1; mc <= 2; mc++) {
      const emp = employees[Math.floor(Math.random() * employees.length)];
      await prisma.medicalCertificate.create({
        data: {
          companyId: company.id,
          employeeId: emp.id,
          originalFilename: `atestado_${mc}.pdf`,
          storedFilename: `scale_test_atestado_${c}_${mc}.pdf`,
          mimeType: 'application/pdf',
          fileSize: 1024 * 100,
          storagePath: `/tmp/scale_test_atestado_${c}_${mc}.pdf`,
          status: mc % 2 === 0 ? 'APPROVED' : 'RECEIVED',
          startDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          endDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          approvedDays: mc % 2 === 0 ? 3 : null,
        }
      });
    }

    // 9. Message logs
    console.log(`Generating message logs for ${companyName}...`);
    const logsBatch = [];
    for (let l = 1; l <= 50; l++) {
      logsBatch.push({
        companyId: company.id,
        direction: 'OUTBOUND' as any,
        provider: 'SIMULATED' as any,
        to: `55119999900${l}`,
        from: '5511900000000',
        body: `Mensagem sintética de teste ${l}`,
        status: 'SIMULATED' as any,
      });
    }
    await prisma.whatsAppMessageLog.createMany({ data: logsBatch });

    // 10. Audit logs
    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        action: 'SCALE_SEED',
        entity: 'Company',
        entityId: company.id,
        metadata: { companiesCount, employeesCount, managersCount },
      }
    });
  }

  // 11. CRM Pilot Leads & platform view seeds
  console.log('Generating platform/CRM CRM Pilot Leads...');
  for (let l = 1; l <= 10; l++) {
    await prisma.pilotLead.create({
      data: {
        name: `SCALE_TEST Lead ${l}`,
        companyName: `SCALE_TEST CRM Company ${l}`,
        email: `lead_${l}@scale-test-crm.com`,
        whatsapp: `55119888800${l}`,
        status: 'QUALIFIED',
      }
    });
  }

  console.log('Scale seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
