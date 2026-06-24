import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('PresençaFlow RH - Happy Flow E2E', () => {
  test('should login as ADMIN, navigate, trigger check-ins, handle webhooks and export CSV', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('#email', 'admin@presencaflow.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(page.locator('h1:has-text("Painel de Controle")')).toBeVisible();

    // 2. Navigation checks
    // Go to Employees
    await page.click('nav a:has-text("Funcionários")');
    await expect(page).toHaveURL(/\/app\/employees/);
    await expect(page.locator('h1:has-text("Gestão de Funcionários")')).toBeVisible();

    // Go to Presence
    await page.click('nav a:has-text("Presença")');
    await expect(page).toHaveURL(/\/app\/presence/);
    await expect(page.locator('h1:has-text("Check-in Remoto & Presença")')).toBeVisible();

    // Go to Medical Certificates
    await page.click('nav a:has-text("Atestados")');
    await expect(page).toHaveURL(/\/app\/medical-certificates/);
    await expect(page.locator('h1:has-text("Gestão de Atestados")')).toBeVisible();

    // Go to Reports
    await page.click('nav a:has-text("Relatórios")');
    await expect(page).toHaveURL(/\/app\/reports/);
    await expect(page.locator('h1:has-text("Fechamento & Relatórios")')).toBeVisible();

    // Go to Billing
    await page.click('nav a:has-text("Plano e Uso")');
    await expect(page).toHaveURL(/\/app\/billing/);
    await expect(page.locator('h1:has-text("Plano e Assinatura")')).toBeVisible();

    // Go to Company Settings
    await page.click('nav a:has-text("Config. Empresa")');
    await expect(page).toHaveURL(/\/app\/settings\/company/);
    await expect(page.locator('h2:has-text("Configurações Operacionais da Empresa")')).toBeVisible();

    // 3. Trigger Individual Check-in
    await page.click('nav a:has-text("Presença")');
    await expect(page).toHaveURL(/\/app\/presence/);

    // Accept any alert/dialog that comes up when triggering
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    await page.click('button:has-text("Disparar Individual")');
    await page.waitForSelector('#triggerEmployeeId');
    // Select first seeded employee option (usually value starts with a UUID)
    const options = await page.locator('#triggerEmployeeId option').all();
    if (options.length > 1) {
      await page.selectOption('#triggerEmployeeId', { index: 1 });
      await page.click('button:has-text("Confirmar Disparo")');
    } else {
      await page.click('button:has-text("Cancelar")');
    }

    // 4. Trigger Batch Check-in
    await page.click('button:has-text("Disparar em Lote")');
    await page.click('button:has-text("Disparar Lote")');
    await expect(page.locator('h2:has-text("Relatório de Disparo em Lote")')).toBeVisible();
    await page.click('button:has-text("Concluir")');

    // 5. Simulate Inbound WhatsApp webhook
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).not.toBeNull();
    const payload = JSON.parse(Buffer.from(token!.split('.')[1], 'base64').toString());
    const companyId = payload.companyId;

    const webhookResponse = await page.request.post('/api/webhooks/whatsapp/inbound', {
      data: {
        companyId,
        from: '5511990000001', // Funcionário Demo 1 from seed
        message: 'Sim, confirmado hoje',
        timestamp: new Date().toISOString(),
      },
    });
    expect(webhookResponse.ok()).toBeTruthy();

    // 6. CSV Export & Masking validations
    await page.click('nav a:has-text("Relatórios")');
    await expect(page).toHaveURL(/\/app\/reports/);

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Exportar CSV")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');

    const csvPath = await download.path();
    expect(csvPath).not.toBeNull();
    const csvContent = fs.readFileSync(csvPath!, 'utf8');

    // Validate CSV contains headers and masked CPFs, but no raw CPFs or 11-digit sequences
    expect(csvContent).toContain('Nome');
    expect(csvContent).toContain('CPF');
    expect(csvContent).toContain('***.***.***-**');
    expect(csvContent).not.toMatch(/\b\d{11}\b/);
    expect(csvContent).not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  });
});
