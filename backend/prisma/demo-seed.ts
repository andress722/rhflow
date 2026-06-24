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

async function main() {
  console.log('Starting demo seed process...');

  // 1. Safety Checks (Block execution in non-development/non-test environments unless ALLOW_DEMO_SEED=true)
  const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  if (!isDevOrTest && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('CRITICAL: demo-seed execution is BLOCKED in non-development environments unless ALLOW_DEMO_SEED=true is set.');
    process.exit(1);
  }

  // 2. Selective clearing (Wipe ONLY data related to the Demo Company Ltda)
  const demoCnpj = '12345678000199';
  const existingCompany = await prisma.company.findFirst({
    where: { cnpj: demoCnpj },
  });

  if (existingCompany) {
    const cid = existingCompany.id;
    console.log(`Demo company found with ID: ${cid}. Clearing related selective data...`);

    await prisma.companySubscription.deleteMany({ where: { companyId: cid } });
    await prisma.usageCounter.deleteMany({ where: { companyId: cid } });
    await prisma.medicalCertificate.deleteMany({ where: { companyId: cid } });
    await prisma.occurrenceEvent.deleteMany({ where: { companyId: cid } });
    await prisma.occurrence.deleteMany({ where: { companyId: cid } });
    await prisma.absenceRecord.deleteMany({ where: { companyId: cid } });
    await prisma.remoteCheckin.deleteMany({ where: { companyId: cid } });
    await prisma.employee.deleteMany({ where: { companyId: cid } });
    await prisma.workSchedule.deleteMany({ where: { companyId: cid } });
    await prisma.user.deleteMany({ where: { companyId: cid } });
    await prisma.auditLog.deleteMany({ where: { companyId: cid } });
    await prisma.company.delete({ where: { id: cid } });

    console.log('Selective demo data cleared.');
  } else {
    console.log('No existing Demo Company found. Proceeding with fresh seed.');
  }

  // Ensure platform company and SUPER_ADMIN exist
  let platformCompany = await prisma.company.findFirst({
    where: { name: 'PresençaFlow Plataforma' },
  });
  if (!platformCompany) {
    platformCompany = await prisma.company.create({
      data: {
        name: 'PresençaFlow Plataforma',
        legalName: 'PresençaFlow Serviços de Plataforma Ltda',
        cnpj: '00000000000000',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    });
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@presencaflow.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superpassword123';
  const superAdminPasswordHash = hashPassword(superAdminPassword);

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', email: superAdminEmail },
  });

  if (existingSuperAdmin) {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: {
        passwordHash: superAdminPasswordHash,
        isActive: true,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        companyId: platformCompany.id,
        name: 'Super Admin',
        email: superAdminEmail,
        passwordHash: superAdminPasswordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
  }

  console.log(`Ensured platform company and SUPER_ADMIN exist: ${superAdminEmail}`);

  // 3. Upsert global Plans (Starter, Pro, Business)
  console.log('Ensuring global SaaS plans exist...');
  const planStarter = await prisma.plan.upsert({
    where: { code: 'STARTER' },
    update: {
      maxEmployees: 5,
      maxMonthlyCheckins: 100,
      maxMonthlyUploads: 0,
      maxMonthlyExports: 0,
      enableReports: true,
      enableBatchCheckin: false,
      enableMedicalModule: false,
      enableExports: false,
    },
    create: {
      name: 'Starter',
      code: 'STARTER',
      maxEmployees: 5,
      maxMonthlyCheckins: 100,
      maxMonthlyUploads: 0,
      maxMonthlyExports: 0,
      enableReports: true,
      enableBatchCheckin: false,
      enableMedicalModule: false,
      enableExports: false,
    },
  });

  const planPro = await prisma.plan.upsert({
    where: { code: 'PRO' },
    update: {
      maxEmployees: 25,
      maxMonthlyCheckins: 1000,
      maxMonthlyUploads: 100,
      maxMonthlyExports: 10,
      enableReports: true,
      enableBatchCheckin: true,
      enableMedicalModule: true,
      enableExports: true,
    },
    create: {
      name: 'Pro',
      code: 'PRO',
      maxEmployees: 25,
      maxMonthlyCheckins: 1000,
      maxMonthlyUploads: 100,
      maxMonthlyExports: 10,
      enableReports: true,
      enableBatchCheckin: true,
      enableMedicalModule: true,
      enableExports: true,
    },
  });

  const planBusiness = await prisma.plan.upsert({
    where: { code: 'BUSINESS' },
    update: {
      maxEmployees: 150,
      maxMonthlyCheckins: 10000,
      maxMonthlyUploads: 1000,
      maxMonthlyExports: 100,
      enableReports: true,
      enableBatchCheckin: true,
      enableMedicalModule: true,
      enableExports: true,
    },
    create: {
      name: 'Business',
      code: 'BUSINESS',
      maxEmployees: 150,
      maxMonthlyCheckins: 10000,
      maxMonthlyUploads: 1000,
      maxMonthlyExports: 100,
      enableReports: true,
      enableBatchCheckin: true,
      enableMedicalModule: true,
      enableExports: true,
    },
  });

  // 4. Create Demo Company
  const company = await prisma.company.create({
    data: {
      name: 'Demo Company Ltda',
      legalName: 'Demo Company Limitada',
      cnpj: demoCnpj,
      timezone: 'America/Sao_Paulo',
      isActive: true,
    },
  });
  console.log(`Created company: ${company.name} (${company.id})`);

  // 5. Create Pro Subscription
  await prisma.companySubscription.create({
    data: {
      companyId: company.id,
      planId: planPro.id,
      status: 'ACTIVE',
      startedAt: new Date(),
    },
  });
  console.log('Subscribed Demo Company Ltda to PRO Plan.');

  // 6. Create Users
  const passwordHash = hashPassword('password123');

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Admin Demo',
      email: 'admin@presencaflow.com',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const hr = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'RH Demo',
      email: 'rh@presencaflow.com',
      passwordHash,
      role: 'HR',
      isActive: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Carlos Gestor',
      email: 'gestor@presencaflow.com',
      passwordHash,
      role: 'MANAGER',
      isActive: true,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Viewer Demo',
      email: 'viewer@presencaflow.com',
      passwordHash,
      role: 'VIEWER',
      isActive: true,
    },
  });
  console.log('Seeded users: admin@, rh@, gestor@, viewer@.');

  // 7. Work Schedules
  const schedulePresential = await prisma.workSchedule.create({
    data: {
      companyId: company.id,
      name: 'Jornada Presencial Standard',
      workDays: JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
      expectedClockIn: '08:00',
      expectedClockOut: '17:00',
      toleranceMinutes: 10,
      requireRemoteCheckin: false,
      requireRemoteCheckout: false,
      isActive: true,
    },
  });

  const scheduleRemote = await prisma.workSchedule.create({
    data: {
      companyId: company.id,
      name: 'Jornada Remota Flexível',
      workDays: JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
      expectedClockIn: '09:00',
      expectedClockOut: '18:05',
      toleranceMinutes: 15,
      requireRemoteCheckin: true,
      requireRemoteCheckout: true,
      isActive: true,
    },
  });

  // 8. Seed 20 Active Employees (80% of PRO Limit of 25)
  console.log('Seeding 20 active employees (80% cota)...');
  const employees: any[] = [];
  
  // Mix of models: 12 Remote, 5 Hybrid, 3 Presential
  for (let i = 1; i <= 20; i++) {
    let workModel = 'REMOTE';
    let scheduleId = scheduleRemote.id;
    if (i > 12 && i <= 17) {
      workModel = 'HYBRID';
    } else if (i > 17) {
      workModel = 'PRESENTIAL';
      scheduleId = schedulePresential.id;
    }

    const emp = await prisma.employee.create({
      data: {
        companyId: company.id,
        fullName: `Funcionário Demo ${i}`,
        cpf: `100000000${i < 10 ? '0' + i : i}`,
        whatsapp: `55119900000${i < 10 ? '0' + i : i}`,
        email: `emp${i}@demo.com`,
        sector: i % 2 === 0 ? 'T.I.' : 'Vendas',
        jobTitle: i % 2 === 0 ? 'Desenvolvedor' : 'Consultor',
        workModel: workModel as any,
        workScheduleId: scheduleId,
        managerUserId: manager.id, // Carlos Gestor
        status: 'ACTIVE',
      },
    });
    employees.push(emp);
  }

  // 9. Seed check-ins with varied statuses for today
  console.log('Seeding daily check-ins with varied statuses...');
  const localDate = new Date().toISOString().split('T')[0];
  const checkinStatuses = [
    'PENDING',
    'CONFIRMED',
    'LATE',
    'ABSENCE_REPORTED',
    'ISSUE_REPORTED',
    'NOT_RESPONDED',
  ];

  // We assign statuses to the first few employees
  for (let i = 0; i < checkinStatuses.length; i++) {
    const status = checkinStatuses[i];
    const emp = employees[i];
    
    await prisma.remoteCheckin.create({
      data: {
        companyId: company.id,
        employeeId: emp.id,
        workScheduleId: scheduleRemote.id,
        checkinDate: localDate,
        status: status as any,
        sentAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
        respondedAt: status !== 'PENDING' && status !== 'NOT_RESPONDED' ? new Date(Date.now() - 3600000) : null,
        responseText: status === 'CONFIRMED' ? 'Sim, iniciei' : (status === 'ISSUE_REPORTED' ? 'Estou com lentidão na internet' : null),
        source: 'AUTOMATION',
      },
    });
  }

  // 10. Seed Occurrences (open/resolved)
  console.log('Seeding occurrences...');
  
  // Open occurrence
  const openOcc = await prisma.occurrence.create({
    data: {
      companyId: company.id,
      employeeId: employees[0].id,
      type: 'REMOTE_TECHNICAL_ISSUE',
      title: 'Instabilidade de VPN',
      description: 'Colaborador reportou instabilidade técnica ao iniciar o trabalho.',
      occurrenceDate: new Date(),
      status: 'WAITING_HR',
      source: 'WHATSAPP',
      severity: 'MEDIUM',
    },
  });

  await prisma.occurrenceEvent.create({
    data: {
      companyId: company.id,
      occurrenceId: openOcc.id,
      actorType: 'SYSTEM',
      eventType: 'WHATSAPP_INBOUND_RECEIVED',
      message: 'Mensagem WhatsApp recebida: "Estou com lentidão na VPN de trabalho."',
    },
  });

  // Resolved occurrence
  const resolvedOcc = await prisma.occurrence.create({
    data: {
      companyId: company.id,
      employeeId: employees[1].id,
      type: 'LATE_ARRIVAL',
      title: 'Atraso Justificado',
      description: 'Atraso decorrente de falta de energia no bairro.',
      occurrenceDate: new Date(Date.now() - 86400000), // yesterday
      status: 'RESOLVED',
      source: 'MANUAL',
      severity: 'LOW',
      resolvedAt: new Date(),
      resolvedByUserId: admin.id,
    },
  });

  await prisma.occurrenceEvent.create({
    data: {
      companyId: company.id,
      occurrenceId: resolvedOcc.id,
      actorType: 'USER',
      actorUserId: admin.id,
      eventType: 'MEDICAL_CERTIFICATE_APPROVED',
      message: 'RH aprovou justificativa do atraso.',
    },
  });

  // 11. Seed Medical Certificates (RECEIVED, UNDER_REVIEW, APPROVED, REJECTED)
  console.log('Seeding medical certificates & active leave record...');
  
  // RECEIVED
  const certReceived = await prisma.medicalCertificate.create({
    data: {
      companyId: company.id,
      employeeId: employees[2].id,
      originalFilename: 'atestado_recebido.pdf',
      storedFilename: `${crypto.randomUUID()}.pdf`,
      mimeType: 'application/pdf',
      fileSize: 102400,
      storagePath: 'storage/medical-certificates/demo1.pdf',
      status: 'RECEIVED',
      certificateDate: new Date(),
      suggestedDays: 2,
    },
  });

  // UNDER_REVIEW
  const certReview = await prisma.medicalCertificate.create({
    data: {
      companyId: company.id,
      employeeId: employees[3].id,
      originalFilename: 'atestado_analise.png',
      storedFilename: `${crypto.randomUUID()}.png`,
      mimeType: 'image/png',
      fileSize: 204800,
      storagePath: 'storage/medical-certificates/demo2.png',
      status: 'UNDER_REVIEW',
      certificateDate: new Date(),
      suggestedDays: 5,
    },
  });

  // APPROVED (Also seeds active AbsenceRecord)
  const occurrenceApproved = await prisma.occurrence.create({
    data: {
      companyId: company.id,
      employeeId: employees[4].id,
      type: 'MEDICAL_CERTIFICATE',
      title: 'Atestado Homologado',
      description: 'Atestado entregue e aprovado pelo RH.',
      occurrenceDate: new Date(),
      status: 'RESOLVED',
      source: 'MANUAL',
      severity: 'MEDIUM',
    },
  });

  const certApproved = await prisma.medicalCertificate.create({
    data: {
      companyId: company.id,
      employeeId: employees[4].id,
      occurrenceId: occurrenceApproved.id,
      originalFilename: 'atestado_aprovado.pdf',
      storedFilename: `${crypto.randomUUID()}.pdf`,
      mimeType: 'application/pdf',
      fileSize: 312000,
      storagePath: 'storage/medical-certificates/demo3.pdf',
      status: 'APPROVED',
      certificateDate: new Date(Date.now() - 86400000), // yesterday
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000 * 2), // 3 days total
      approvedDays: 3,
      reviewedByUserId: hr.id,
      reviewedAt: new Date(),
    },
  });

  // Active AbsenceRecord
  await prisma.absenceRecord.create({
    data: {
      companyId: company.id,
      employeeId: employees[4].id,
      occurrenceId: occurrenceApproved.id,
      medicalCertificateId: certApproved.id,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000 * 2),
      days: 3,
      type: 'MEDICAL_LEAVE',
      status: 'ACTIVE',
      createdByUserId: hr.id,
    },
  });

  // REJECTED
  await prisma.medicalCertificate.create({
    data: {
      companyId: company.id,
      employeeId: employees[5].id,
      originalFilename: 'atestado_recusado.jpg',
      storedFilename: `${crypto.randomUUID()}.jpg`,
      mimeType: 'image/jpeg',
      fileSize: 450000,
      storagePath: 'storage/medical-certificates/demo4.jpg',
      status: 'REJECTED',
      certificateDate: new Date(Date.now() - 86400000 * 5),
      rejectionReason: 'Documento ilegível ou rasurado.',
      reviewedByUserId: hr.id,
      reviewedAt: new Date(),
    },
  });

  // 12. Seed Usage Counters at exactly 80% limits of PRO plan
  console.log('Seeding UsageCounters at 80% capacity...');
  const currentYearMonth = () => {
    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    };
    const formatter = new Intl.DateTimeFormat('en-US', formatOptions);
    const parts = formatter.formatToParts(new Date());
    const month = parts.find(p => p.type === 'month')?.value;
    const year = parts.find(p => p.type === 'year')?.value;
    return `${year}-${month}`;
  };

  const period = currentYearMonth();

  // remote_checkins: PRO limit is 1000 -> 80% is 800
  await prisma.usageCounter.create({
    data: {
      companyId: company.id,
      period,
      key: 'remote_checkins',
      value: 800,
    },
  });

  // medical_uploads: PRO limit is 100 -> 80% is 80
  await prisma.usageCounter.create({
    data: {
      companyId: company.id,
      period,
      key: 'medical_uploads',
      value: 80,
    },
  });

  // report_exports: PRO limit is 10 -> 80% is 8
  await prisma.usageCounter.create({
    data: {
      companyId: company.id,
      period,
      key: 'report_exports',
      value: 8,
    },
  });

  console.log('Demo seed completed successfully! 🌱');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
