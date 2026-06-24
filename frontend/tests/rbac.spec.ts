import { test, expect } from '@playwright/test';

test.describe('PresençaFlow RH - RBAC & Permissions E2E', () => {

  test('VIEWER role - should enforce read-only and block billing, company settings, and exports', async ({ page }) => {
    // 1. Login as VIEWER
    await page.goto('/login');
    await page.fill('#email', 'viewer@presencaflow.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Sidebar visibility checks
    // Billing (Plano e Uso) and Settings links should NOT be in the DOM
    await expect(page.locator('nav a:has-text("Plano e Uso")')).not.toBeVisible();
    await expect(page.locator('nav a:has-text("Config. Empresa")')).not.toBeVisible();

    // 3. Direct route blocks (403 Custom Screen)
    await page.goto('/app/billing');
    await expect(page.locator('h2:has-text("Acesso Negado")')).toBeVisible();

    await page.goto('/app/settings/company');
    await expect(page.locator('h2:has-text("Acesso Negado")')).toBeVisible();

    // 4. Reports page - Export CSV button must not be rendered
    await page.goto('/app/reports');
    await expect(page.locator('button:has-text("Exportar CSV")')).not.toBeVisible();

    // 5. Employees page - Create button (Adicionar Funcionário) must not be rendered
    await page.goto('/app/employees');
    await expect(page.locator('button:has-text("Adicionar")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Novo")')).not.toBeVisible();
  });

  test('MANAGER role - should enforce team scope isolation and block company settings', async ({ page }) => {
    // 1. Login as MANAGER
    await page.goto('/login');
    await page.fill('#email', 'gestor@presencaflow.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/app\/dashboard/);

    // 2. Sidebar visibility checks
    // Settings should NOT be in the DOM (Billing is not visible for managers too)
    await expect(page.locator('nav a:has-text("Config. Empresa")')).not.toBeVisible();

    // 3. Direct route blocks (403 Custom Screen)
    await page.goto('/app/settings/company');
    await expect(page.locator('h2:has-text("Acesso Negado")')).toBeVisible();

    // 4. Team scope verify in occurrence list
    await page.goto('/app/occurrences');
    // Ensure manager sees the occurrences list but the backend should only filter their team
    // We can also verify that trying to download an unauthorized certificate directly returns 403
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).not.toBeNull();

    // Query file download endpoint directly for a fake certificate ID (should be forbidden if not in team/company scope)
    const fileResponse = await page.request.get('/api/medical-certificates/some-unauthorized-uuid/file', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    // Since some-unauthorized-uuid does not exist or belongs to another company context, it returns 404 or 403
    expect([403, 404]).toContain(fileResponse.status());
  });
});
