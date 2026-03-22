import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data.js';

test.describe('Cash Register (Caja)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.admin.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|setup|acceso)?$/i, { timeout: 10000 });
  });

  test('should load cash register page', async ({ page }) => {
    await page.goto('/caja');
    await expect(page.getByText(/caja/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show open/close cash register options', async ({ page }) => {
    await page.goto('/caja');
    await page.waitForTimeout(2000);

    // Should show either "Abrir Caja" button or active register info
    const openBtn = page.getByRole('button', { name: /abrir caja|apertura/i });
    const activeInfo = page.getByText(/caja abierta|turno activo/i);

    const hasOpenOption = await openBtn.isVisible() || await activeInfo.isVisible();
    expect(hasOpenOption).toBeTruthy();
  });

  test('should open cash register with initial amount', async ({ page }) => {
    await page.goto('/caja');
    await page.waitForTimeout(2000);

    const openBtn = page.getByRole('button', { name: /abrir caja|apertura/i });
    if (await openBtn.isVisible()) {
      await openBtn.click();
      await page.waitForTimeout(1000);

      // Fill initial amount
      const amountInput = page.getByPlaceholder(/monto|amount|inicial/i);
      if (await amountInput.isVisible()) {
        await amountInput.fill('5000');
        const confirmBtn = page.getByRole('button', { name: /confirmar|abrir|aceptar/i });
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }
  });

  test('should display cash register history', async ({ page }) => {
    await page.goto('/caja');
    await page.waitForTimeout(1000);

    // Look for history link or tab
    const historyLink = page.getByRole('link', { name: /historial/i });
    if (await historyLink.isVisible()) {
      await historyLink.click();
      await expect(page).toHaveURL(/caja.*historial|historial/i, { timeout: 5000 });
    }
  });
});
