import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface Result {
  endpoint: string;
  statusCode: number;
  durationMs: number;
}

async function request(endpoint: string, method: 'GET' | 'POST', token?: string, body?: any): Promise<Result> {
  const start = Date.now();
  try {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const durationMs = Date.now() - start;
    return {
      endpoint,
      statusCode: res.status,
      durationMs,
    };
  } catch (err: any) {
    return {
      endpoint,
      statusCode: 0,
      durationMs: Date.now() - start,
    };
  }
}

function calculateStats(endpoint: string, results: Result[]) {
  const filtered = results.filter(r => r.endpoint === endpoint);
  if (filtered.length === 0) return null;

  const durations = filtered.map(f => f.durationMs).sort((a, b) => a - b);
  const failures = filtered.filter(f => f.statusCode < 200 || f.statusCode >= 300).length;

  const p50Idx = Math.floor(durations.length * 0.5);
  const p95Idx = Math.floor(durations.length * 0.95);

  return {
    endpoint,
    total: filtered.length,
    failures,
    p50: durations[p50Idx] || 0,
    p95: durations[p95Idx] || 0,
    max: durations[durations.length - 1] || 0,
  };
}

async function main() {
  console.log(`Starting light load test hitting API at ${API_URL}...`);

  // 1. Authenticate SUPER_ADMIN
  console.log('Logging in as SUPER_ADMIN...');
  const superAdminEmail = 'superadmin@presencaflow.com';
  const superAdminLogin = await request('/api/auth/login', 'POST', undefined, {
    email: superAdminEmail,
    password: 'superpassword123',
  });

  if (superAdminLogin.statusCode !== 200) {
    console.error('CRITICAL: Super Admin authentication failed. Make sure the backend server is running and seeded.');
    process.exit(1);
  }

  // Retrieve token from response
  // Note: Since we are using standard fetch, let's login by reading token
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: superAdminEmail, password: 'superpassword123' }),
  });
  const loginJson = await loginRes.json();
  const superAdminToken = loginJson.token;

  // 2. Authenticate synthetic ADMIN
  console.log('Logging in as synthetic Manager...');
  const managerRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager_1_1@scale-test.com', password: 'password123' }),
  }).catch(() => null);

  let managerToken: string | undefined = undefined;
  if (managerRes && managerRes.status === 200) {
    const managerJson = await managerRes.json();
    managerToken = managerJson.token;
  } else {
    console.warn('WARNING: Synthetic Manager login failed. Company level routes will bypass token-based validation.');
  }

  const results: Result[] = [];

  // Defining endpoints to hit
  const superAdminEndpoints = [
    '/api/admin/command-center/overview',
    '/api/admin/command-center/alerts',
    '/api/admin/support/customer-success',
    '/api/admin/retention/overview',
    '/api/admin/retention/accounts',
    '/api/admin/billing/accounts',
    '/api/admin/pilots',
    '/api/admin/jobs',
  ];

  const managerEndpoints = [
    '/api/customer-success/health',
    '/api/presence/summary',
    '/api/occurrences',
    '/api/medical-certificates',
    '/api/reports/operational',
  ];

  // Hit endpoints concurrently
  const runsCount = 5; // Repeat 5 times
  console.log(`Executing ${runsCount} loops of requests...`);

  for (let loop = 1; loop <= runsCount; loop++) {
    const promises: Promise<Result>[] = [];

    // Super Admin calls
    for (const ep of superAdminEndpoints) {
      promises.push(request(ep, 'GET', superAdminToken));
    }

    // Manager calls
    if (managerToken) {
      for (const ep of managerEndpoints) {
        promises.push(request(ep, 'GET', managerToken));
      }
    }

    const loopResults = await Promise.all(promises);
    results.push(...loopResults);
  }

  console.log('\n--- Load Test Results Report ---');
  console.log('| Endpoint | Total | Failures | p50 (ms) | p95 (ms) | Max (ms) |');
  console.log('|---|---|---|---|---|---|');

  const allEndpoints = [...superAdminEndpoints, ...(managerToken ? managerEndpoints : [])];
  for (const ep of allEndpoints) {
    const stats = calculateStats(ep, results);
    if (stats) {
      console.log(`| ${stats.endpoint} | ${stats.total} | ${stats.failures} | ${stats.p50}ms | ${stats.p95}ms | ${stats.max}ms |`);
    }
  }

  console.log('\nLoad test finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
