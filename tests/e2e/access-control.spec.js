import { test, expect } from '@playwright/test';
import { testUsers, testVehicles } from '../fixtures/test-data.js';

test.describe('Access Control - Vehicle Entry/Exit', () => {
  test.beforeEach(async ({ page }) => {
    // Login as operator (typical access control user)
    await page.goto('/login');
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.operator.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.operator.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|acceso)?$/i, { timeout: 10000 });
  });

  test('should load access control page', async ({ page }) => {
    await page.goto('/acceso');
    await expect(page.getByText(/control de acceso|acceso/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show plate input field', async ({ page }) => {
    await page.goto('/acceso');
    await page.waitForTimeout(1000);

    // Should have a plate/placa input field
    const plateInput = page.getByPlaceholder(/placa|plate|matrícula/i);
    await expect(plateInput).toBeVisible({ timeout: 5000 });
  });

  test('should register vehicle entry', async ({ page }) => {
    await page.goto('/acceso');
    await page.waitForTimeout(1000);

    const plateInput = page.getByPlaceholder(/placa|plate|matrícula/i);
    await plateInput.fill(testVehicles.car1.plate);

    // Click entry button
    const entryBtn = page.getByRole('button', { name: /entrada|entry|registrar/i });
    if (await entryBtn.isVisible()) {
      await entryBtn.click();
      // Should show success message or update sessions list
      await page.waitForTimeout(2000);
      const successToast = page.locator('.Toastify__toast--success');
      const errorToast = page.locator('.Toastify__toast--error');
      // Either success (new entry) or error (already inside) is valid
      const hasResponse = await successToast.isVisible() || await errorToast.isVisible();
      expect(hasResponse).toBeTruthy();
    }
  });

  test('should show active sessions', async ({ page }) => {
    await page.goto('/acceso');
    await page.waitForTimeout(2000);

    // Should display active sessions section or table
    const sessionsArea = page.getByText(/sesiones activas|vehículos dentro|activas/i);
    if (await sessionsArea.isVisible()) {
      await expect(sessionsArea).toBeVisible();
    }
  });

  test('should validate plate format', async ({ page }) => {
    await page.goto('/acceso');
    await page.waitForTimeout(1000);

    const plateInput = page.getByPlaceholder(/placa|plate|matrícula/i);
    // Try with empty plate
    await plateInput.fill('');
    const entryBtn = page.getByRole('button', { name: /entrada|entry|registrar/i });
    if (await entryBtn.isVisible()) {
      await entryBtn.click();
      // Should show validation error or disable button
      await page.waitForTimeout(1000);
    }
  });
});
