import { test, expect } from '@playwright/test';
import { testUsers, testSettings } from '../fixtures/test-data.js';

test.describe('Configuration Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.admin.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|setup|acceso)?$/i, { timeout: 10000 });
  });

  test('should load configuration page without errors', async ({ page }) => {
    await page.goto('/config');

    // Should NOT show error toast
    const errorToast = page.locator('.Toastify__toast--error');
    // Wait a bit for potential errors
    await page.waitForTimeout(3000);
    await expect(errorToast).not.toBeVisible();

    // Should show configuration categories
    await expect(page.getByText(/general|configuración/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should display setting categories', async ({ page }) => {
    await page.goto('/config');
    await page.waitForTimeout(2000);

    // Check for at least some expected category labels
    const categories = ['General', 'Caja', 'Facturación', 'Antifraude', 'Notificaciones'];
    for (const cat of categories) {
      const catElement = page.getByText(cat, { exact: false });
      // Categories might be collapsed, just check they exist in DOM
      await expect(catElement.first()).toBeAttached({ timeout: 5000 });
    }
  });

  test('should update business name setting', async ({ page }) => {
    await page.goto('/config');
    await page.waitForTimeout(2000);

    // Expand General category if collapsed
    const generalSection = page.getByText('General').first();
    await generalSection.click();

    // Find business name field and update
    const businessNameInput = page.locator('input[placeholder*="ParkingPro"], input').filter({ has: page.locator('[data-key="business_name"]') });
    if (await businessNameInput.isVisible()) {
      await businessNameInput.fill(testSettings.business_name);

      // Click save button for this field
      const saveBtn = page.getByRole('button', { name: /guardar|save/i }).first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        // Should show success toast
        await expect(page.locator('.Toastify__toast--success')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should cache settings in localStorage', async ({ page }) => {
    await page.goto('/config');
    await page.waitForTimeout(3000);

    const cachedSettings = await page.evaluate(() => {
      return localStorage.getItem('pp_settings');
    });

    expect(cachedSettings).not.toBeNull();
    const parsed = JSON.parse(cachedSettings);
    expect(typeof parsed).toBe('object');
  });

  test('operator should not access config page', async ({ page }) => {
    // Logout and login as operator
    await page.evaluate(() => {
      localStorage.removeItem('pp_token');
      localStorage.removeItem('pp_user');
    });
    await page.goto('/login');
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.operator.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.operator.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|acceso)?$/i, { timeout: 10000 });

    // Try to access config - should redirect or show 403
    await page.goto('/config');
    // Should either redirect away from config or show access denied
    await page.waitForTimeout(2000);
    const url = page.url();
    // Operator shouldn't be on /config
    expect(url).not.toMatch(/\/config$/);
  });
});
