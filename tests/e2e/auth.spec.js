import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data.js';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /iniciar sesión|login/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible();
    await expect(page.getByPlaceholder(/contraseña|password/i)).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.getByPlaceholder(/email|correo/i).fill('invalid@test.com');
    await page.getByPlaceholder(/contraseña|password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();

    // Should show error toast or message
    await expect(page.locator('.Toastify__toast--error, [role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test('should login as admin successfully', async ({ page }) => {
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.admin.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();

    // Should redirect to dashboard or setup wizard
    await expect(page).toHaveURL(/\/(dashboard|setup|acceso)?$/i, { timeout: 10000 });
  });

  test('should login as operator successfully', async ({ page }) => {
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.operator.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.operator.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();

    await expect(page).toHaveURL(/\/(dashboard|acceso)?$/i, { timeout: 10000 });
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    // Clear any stored tokens
    await page.evaluate(() => {
      localStorage.removeItem('pp_token');
      localStorage.removeItem('pp_user');
    });
    await page.goto('/config');
    await expect(page).toHaveURL(/\/login/i, { timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.getByPlaceholder(/email|correo/i).fill(testUsers.admin.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /entrar|iniciar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|setup|acceso)?$/i, { timeout: 10000 });

    // Logout
    const logoutBtn = page.getByRole('button', { name: /cerrar sesión|logout|salir/i });
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/i, { timeout: 5000 });
    }
  });
});
