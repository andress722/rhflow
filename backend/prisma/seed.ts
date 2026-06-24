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
  console.log('Starting seed process...');

  // 1. Clear existing data
  await prisma.companySubscription.deleteMany({});
  await prisma.plan.deleteMany({});
  await prisma.usageCounter.deleteMany({});
  await prisma.medicalCertificate.deleteMany({});
  await prisma.occurrenceEvent.deleteMany({});
  await prisma.occurrence.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.workSchedule.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});
  console.log('Database cleared.');

  // Create platform company
  const platformCompany = await prisma.company.create({
    data: {
      name: 'PresençaFlow Plataforma',
      legalName: 'PresençaFlow Serviços de Plataforma Ltda',
      cnpj: '00000000000000',
      timezone: 'America/Sao_Paulo',
      isActive: true,
    },
  });

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@presencaflow.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superpassword123';
  const superAdminPasswordHash = hashPassword(superAdminPassword);

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

  console.log(`Created platform company and SUPER_ADMIN: ${superAdminEmail}`);

  // Create standard plans
  const planStarter = await prisma.plan.create({
    data: {
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

  const planPro = await prisma.plan.create({
    data: {
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

  const planBusiness = await prisma.plan.create({
    data: {
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

  console.log('Created SaaS plans: STARTER, PRO, BUSINESS');

  // 2. Create demo company
  const company = await prisma.company.create({
    data: {
      name: 'Demo Company Ltda',
      legalName: 'Demo Company Limitada',
      cnpj: '12345678000199',
      timezone: 'America/Sao_Paulo',
      isActive: true,
    },
  });

  console.log(`Created company: ${company.name}`);

  // Create subscription for Demo Company
  await prisma.companySubscription.create({
    data: {
      companyId: company.id,
      planId: planPro.id,
      status: 'ACTIVE',
      startedAt: new Date(),
    },
  });

  console.log('Assigned active PRO subscription to Demo Company.');

  // Hash standard password
  const defaultPasswordHash = hashPassword('password123');

  // 3. Create users
  const adminUser = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Admin PresençaFlow',
      email: 'admin@presencaflow.com',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  const hrUser = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Recursos Humanos Demo',
      email: 'rh@presencaflow.com',
      passwordHash: defaultPasswordHash,
      role: 'HR',
      isActive: true,
    },
  });

  const manager1 = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Gestor Vendas (Carlos)',
      email: 'gestor@presencaflow.com',
      passwordHash: defaultPasswordHash,
      role: 'MANAGER',
      isActive: true,
    },
  });

  const manager2 = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Gestor T.I. (Lucas)',
      email: 'gestor2@presencaflow.com',
      passwordHash: defaultPasswordHash,
      role: 'MANAGER',
      isActive: true,
    },
  });

  const viewerUser = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Visualizador Externo',
      email: 'viewer@presencaflow.com',
      passwordHash: defaultPasswordHash,
      role: 'VIEWER',
      isActive: true,
    },
  });

  const inactiveUser = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Usuário Demitido',
      email: 'inativo@presencaflow.com',
      passwordHash: defaultPasswordHash,
      role: 'HR',
      isActive: false, // Inactive user
    },
  });

  console.log('Created internal system users.');

  // 4. Create Work Schedules
  const scheduleStandard = await prisma.workSchedule.create({
    data: {
      companyId: company.id,
      name: 'Escala Standard 8h-17h',
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
      name: 'Escala Flexível Remota 9h-18h',
      workDays: JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
      expectedClockIn: '09:00',
      expectedClockOut: '18:00',
      toleranceMinutes: 15,
      requireRemoteCheckin: true,
      requireRemoteCheckout: true,
      isActive: true,
    },
  });

  console.log('Created work schedules.');

  // 5. Create Employees (including relationship assertions to test manager filtration)
  const employee1 = await prisma.employee.create({
    data: {
      companyId: company.id,
      fullName: 'João Silva (Vendas)',
      cpf: '11122233344',
      whatsapp: '5511999991111',
      email: 'joao.silva@demo.com',
      sector: 'Vendas',
      jobTitle: 'Analista de Vendas',
      workModel: 'PRESENTIAL',
      workScheduleId: scheduleStandard.id,
      managerUserId: manager1.id, // Supervised by Manager 1 (Carlos)
      status: 'ACTIVE',
    },
  });

  const employee2 = await prisma.employee.create({
    data: {
      companyId: company.id,
      fullName: 'Maria Santos (Vendas Remota)',
      cpf: '55566677788',
      whatsapp: '5511999992222',
      email: 'maria.santos@demo.com',
      sector: 'Vendas',
      jobTitle: 'Consultora de Relacionamento',
      workModel: 'REMOTE',
      workScheduleId: scheduleRemote.id,
      managerUserId: manager1.id, // Supervised by Manager 1 (Carlos)
      status: 'ACTIVE',
    },
  });

  const employee3 = await prisma.employee.create({
    data: {
      companyId: company.id,
      fullName: 'Pedro Oliveira (Suporte Técnico)',
      cpf: '99988877766',
      whatsapp: '5511999993333',
      email: 'pedro.oliveira@demo.com',
      sector: 'T.I.',
      jobTitle: 'Analista de Suporte',
      workModel: 'HYBRID',
      workScheduleId: scheduleStandard.id,
      managerUserId: manager2.id, // Supervised by Manager 2 (Lucas)
      status: 'ACTIVE',
    },
  });

  console.log('Created employees linked to respective managers.');
  console.log('Seed completed successfully! 🌱');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
