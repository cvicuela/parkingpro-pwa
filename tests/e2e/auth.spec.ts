import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Authentication', () => {
  test('should show login page with ParkingPro branding', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ParkingPro' })).toBeVisible();
    await expect(page.getByText(/Sistema de Gesti.n de Parqueos/i)).toBeVisible();
    await expect(page.getByPlaceholder('correo@ejemplo.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar Sesion|Iniciar Sesión/i })).toBeVisible();
  });

  test('should login with valid credentials and see dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('correo@ejemplo.com').fill('vicuela@gmail.com');
    await page.getByPlaceholder('••••••••').fill('salinas');
    await page.getByRole('button', { name: /Iniciar Sesion|Iniciar Sesión/i }).click();

    // Should redirect away from /login
    await page.waitForURL('**/', { timeout: 15000 });

    // Dashboard content should be visible (not the login form)
    await expect(page.getByRole('button', { name: /Iniciar Sesion|Iniciar Sesión/i })).not.toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('correo@ejemplo.com').fill('wrong@email.com');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByRole('button', { name: /Iniciar Sesion|Iniciar Sesión/i }).click();

    // Should show error toast and remain on login
    await expect(page.getByText(/Error al iniciar sesi.n/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('correo@ejemplo.com')).toBeVisible();
  });

  test('should access /acceso page after login', async ({ page }) => {
    await login(page);

    await page.goto('/acceso');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Should see the Control de Acceso heading
    await expect(page.getByText('Control de Acceso')).toBeVisible({ timeout: 10000 });
    // Should NOT see an unauthorized message
    await expect(page.locator('body')).not.toContainText('No autorizado');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to visit a protected route without logging in
    await page.goto('/acceso');
    // Should end up on login
    await expect(page.getByPlaceholder('correo@ejemplo.com')).toBeVisible({ timeout: 10000 });
  });
});
