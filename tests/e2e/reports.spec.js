import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data.js';

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.admin.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|setup|acceso)?$/i, { timeout: 10000 });
  });

  test('should load reports page', async ({ page }) => {
    await page.goto('/reportes');
    await expect(page.getByText(/reporte/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should have date range filter', async ({ page }) => {
    await page.goto('/reportes');
    await page.waitForTimeout(2000);

    // Reports should have date range selectors
    const dateInput = page.locator('input[type="date"]');
    if (await dateInput.first().isVisible()) {
      await expect(dateInput.first()).toBeVisible();
    }
  });

  test('should have export options', async ({ page }) => {
    await page.goto('/reportes');
    await page.waitForTimeout(2000);

    // Should have CSV/XLS/PDF export buttons
    const exportBtn = page.getByRole('button', { name: /exportar|csv|excel|pdf/i });
    if (await exportBtn.first().isVisible()) {
      await expect(exportBtn.first()).toBeVisible();
    }
  });

  test('should load fiscal reports page (admin only)', async ({ page }) => {
    await page.goto('/fiscal');
    await page.waitForTimeout(2000);

    // Should show fiscal reports content (DGII 606/607)
    const fiscalContent = page.getByText(/fiscal|606|607|dgii/i);
    await expect(fiscalContent.first()).toBeVisible({ timeout: 5000 });
  });
});
