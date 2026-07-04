import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const INTERNAL_JOB_SECRET = process.env.INTERNAL_JOB_SECRET || 'my-prod-secret-token';

let exitCode = 0;

async function logStage(name: string, fn: () => Promise<boolean>) {
  console.log(`[SMOKE_TEST] Stage: ${name}...`);
  try {
    const success = await fn();
    if (success) {
      console.log(`[PASS] ${name}\n`);
    } else {
      console.log(`[FAIL] ${name}\n`);
      exitCode = 1;
    }
  } catch (err: any) {
    console.log(`[FAIL] ${name} (Error: ${err.message})\n`);
    exitCode = 1;
  }
}

async function main() {
  console.log(`Starting staging full smoke test against: ${API_URL}`);

  // Retrieve an admin user credentials or token
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
  });

  const pilotCompany = await prisma.company.findFirst({
    where: { name: { startsWith: 'SCALE_TEST_' }, isActive: true },
  });

  const pilotAdmin = pilotCompany
    ? await prisma.user.findFirst({ where: { companyId: pilotCompany.id, role: 'MANAGER' } })
    : null;

  let superAdminToken = '';
  let pilotAdminToken = '';

  // 1. Health checks
  await logStage('Health Check Ready', async () => {
    const res = await fetch(`${API_URL}/api/health/ready`).catch(() => null);
    if (!res) return false;
    const json = await res.json();
    return res.status === 200 && json.status === 'OK';
  });

  // 2. Login Super Admin
  await logStage('Super Admin Authentication', async () => {
    if (!superAdmin) {
      console.log('Skipping: No Super Admin user found in database.');
      return true;
    }
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: superAdmin.email, password: 'superpassword123' }),
    }).catch(() => null);

    if (!res || res.status !== 200) return false;
    const json = await res.json();
    superAdminToken = json.token;
    return !!superAdminToken;
  });

  // 3. Command Center Overview
  await logStage('Command Center Overview API', async () => {
    if (!superAdminToken) return false;
    const res = await fetch(`${API_URL}/api/admin/command-center/overview`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` },
    }).catch(() => null);
    return res?.status === 200;
  });

  // 4. Support Overview
  await logStage('Support Dashboard & Customer Success APIs', async () => {
    if (!superAdminToken) return false;
    const res = await fetch(`${API_URL}/api/admin/support/customer-success`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` },
    }).catch(() => null);
    return res?.status === 200;
  });

  // 5. Jobs status list
  await logStage('Jobs Operations Overview API', async () => {
    if (!superAdminToken) return false;
    const res = await fetch(`${API_URL}/api/admin/jobs`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` },
    }).catch(() => null);
    return res?.status === 200;
  });

  // 6. Retention KPIs
  await logStage('Retention Overview KPIs API', async () => {
    if (!superAdminToken) return false;
    const res = await fetch(`${API_URL}/api/admin/retention/overview`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` },
    }).catch(() => null);
    return res?.status === 200;
  });

  // 7. Lead creation check (CRM funnel)
  let createdLeadId = '';
  await logStage('Create Smoke Test CRM Lead', async () => {
    if (!superAdminToken) return false;
    const res = await fetch(`${API_URL}/api/admin/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'SMOKE_TEST_Lead',
        companyName: 'SMOKE_TEST Company Inc',
        email: 'smoke_lead@smoketest.com',
        whatsapp: '5511999990000',
        mainPain: 'Gestão de presença descentralizada',
      }),
    }).catch(() => null);

    if (!res || res.status !== 201) return false;
    const json = await res.json();
    createdLeadId = json.data?.id;
    return !!createdLeadId;
  });

  // Clean up created lead
  if (createdLeadId) {
    await prisma.pilotLead.delete({ where: { id: createdLeadId } }).catch(() => null);
  }

  // 8. Pilot Admin Authentication
  await logStage('Pilot Corporate User Authentication', async () => {
    if (!pilotAdmin) {
      console.log('Skipping: No Pilot Admin user found in database.');
      return true;
    }
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pilotAdmin.email, password: 'password123' }),
    }).catch(() => null);

    if (!res || res.status !== 200) return false;
    const json = await res.json();
    pilotAdminToken = json.token;
    return !!pilotAdminToken;
  });

  // 9. Onboarding checklist
  await logStage('Onboarding Checklist API', async () => {
    if (!pilotAdminToken) {
      console.log('Skipping: No corporate admin token.');
      return true;
    }
    const res = await fetch(`${API_URL}/api/onboarding`, {
      headers: { 'Authorization': `Bearer ${pilotAdminToken}` },
    }).catch(() => null);
    return res?.status === 200;
  });

  // 10. Presence summary
  await logStage('Presence Dashboard Summary API', async () => {
    if (!pilotAdminToken) {
      console.log('Skipping: No corporate admin token.');
      return true;
    }
    const res = await fetch(`${API_URL}/api/presence/summary`, {
      headers: { 'Authorization': `Bearer ${pilotAdminToken}` },
    }).catch(() => null);
    return res?.status === 200;
  });

  // 11. Internal Jobs Ping with CORRECT secret
  await logStage('Internal Job Ping with CORRECT secret', async () => {
    const res = await fetch(`${API_URL}/api/internal/jobs/ping`, {
      method: 'POST',
      headers: {
        'x-internal-job-secret': INTERNAL_JOB_SECRET,
      },
    }).catch(() => null);
    return res?.status === 200;
  });

  // 12. Internal Jobs Ping with INCORRECT secret
  await logStage('Internal Job Ping with INCORRECT secret', async () => {
    const res = await fetch(`${API_URL}/api/internal/jobs/ping`, {
      method: 'POST',
      headers: {
        'x-internal-job-secret': 'wrong-secret-token-invalid',
      },
    }).catch(() => null);
    return res?.status === 401; // Unauthorized blocked
  });

  console.log(`Smoke test finished. Exit Code: ${exitCode}`);
  process.exit(exitCode);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
