import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data.js';

/**
 * Visual regression tests for ParkingPro PWA
 * These tests capture screenshots of key pages and compare against baselines.
 * Run `npx playwright test --update-snapshots` to update baselines.
 */

test.describe('Visual Regression', () => {
  test('login page visual', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });

  test.describe('Authenticated pages', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.getByPlaceholder(/email|correo/i).fill(testUsers.admin.email);
      await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.admin.password);
      await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
      await expect(page).toHaveURL(/\/(dashboard|setup|acceso)?$/i, { timeout: 10000 });
    });

    test('dashboard visual', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Wait for charts/animations
      await expect(page).toHaveScreenshot('dashboard.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1, // More tolerance for dynamic data
      });
    });

    test('access control visual', async ({ page }) => {
      await page.goto('/acceso');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('access-control.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
    });

    test('customers page visual', async ({ page }) => {
      await page.goto('/clientes');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('customers.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
    });

    test('config page visual', async ({ page }) => {
      await page.goto('/config');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await expect(page).toHaveScreenshot('config.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.1,
      });
    });
  });
});
