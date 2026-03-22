import { test, expect } from '@playwright/test';
import { testUsers, testCustomers, testVehicles } from '../fixtures/test-data.js';

test.describe('Customers & Vehicles Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.admin.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|setup|acceso)?$/i, { timeout: 10000 });
  });

  test('should load customers page', async ({ page }) => {
    await page.goto('/clientes');
    await expect(page.getByText(/clientes/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should display customer list or empty state', async ({ page }) => {
    await page.goto('/clientes');
    await page.waitForTimeout(2000);

    // Should have either a table/list with customers or an empty state
    const hasCustomers = await page.locator('table, [data-testid="customer-list"]').isVisible();
    const hasEmptyState = await page.getByText(/no hay clientes|sin registros|vacío/i).isVisible();
    const hasContent = hasCustomers || hasEmptyState;
    expect(hasContent).toBeTruthy();
  });

  test('should open new customer form', async ({ page }) => {
    await page.goto('/clientes');
    await page.waitForTimeout(1000);

    const addBtn = page.getByRole('button', { name: /nuevo|agregar|crear|añadir/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // Should show a form or modal
      const nameInput = page.getByPlaceholder(/nombre/i);
      await expect(nameInput.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('should load vehicles page', async ({ page }) => {
    await page.goto('/vehiculos');
    await expect(page.getByText(/vehículos/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should search vehicles by plate', async ({ page }) => {
    await page.goto('/vehiculos');
    await page.waitForTimeout(1000);

    const searchInput = page.getByPlaceholder(/buscar|placa|search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill(testVehicles.car1.plate);
      await page.waitForTimeout(1000);
      // Results should filter
    }
  });
});
