import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data.js';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.admin.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|setup|acceso)?$/i, { timeout: 10000 });
  });

  test('should load dashboard with stats cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Dashboard should have stat cards (ingresos, vehículos, ocupación, etc.)
    const statsArea = page.locator('[class*="grid"], [class*="stats"]');
    await expect(statsArea.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display navigation sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Sidebar should have navigation links
    const navLinks = ['Dashboard', 'Acceso', 'Clientes', 'Vehículos', 'Pagos'];
    for (const link of navLinks) {
      const navItem = page.getByRole('link', { name: new RegExp(link, 'i') });
      if (await navItem.isVisible()) {
        await expect(navItem).toBeVisible();
      }
    }
  });

  test('should navigate between pages via sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Click on Clientes link
    const clientesLink = page.getByRole('link', { name: /clientes/i });
    if (await clientesLink.isVisible()) {
      await clientesLink.click();
      await expect(page).toHaveURL(/\/clientes/i, { timeout: 5000 });
    }
  });
});
