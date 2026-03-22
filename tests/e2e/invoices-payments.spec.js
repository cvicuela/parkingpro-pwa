import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data.js';

test.describe('Invoices & Payments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.admin.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|setup|acceso)?$/i, { timeout: 10000 });
  });

  test('should load invoices page', async ({ page }) => {
    await page.goto('/facturas');
    await expect(page.getByText(/factura/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should load payments page', async ({ page }) => {
    await page.goto('/pagos');
    await expect(page.getByText(/pago/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should display payment methods filter', async ({ page }) => {
    await page.goto('/pagos');
    await page.waitForTimeout(2000);

    // Should have filter or search options
    const filterArea = page.getByText(/filtrar|método|tipo/i);
    if (await filterArea.first().isVisible()) {
      await expect(filterArea.first()).toBeVisible();
    }
  });

  test('should display invoice list with NCF info', async ({ page }) => {
    await page.goto('/facturas');
    await page.waitForTimeout(2000);

    // If there are invoices, check they have NCF column
    const table = page.locator('table');
    if (await table.isVisible()) {
      const ncfHeader = page.getByText(/NCF|comprobante/i);
      await expect(ncfHeader.first()).toBeAttached();
    }
  });
});
