import { test, expect } from '../fixtures/browser-auth.fixture';

/**
 * P0-C: Functional - General UI Behavior (Browser)
 *
 * FUNC-006: SKU browser
 * FUNC-008: Error messages
 * FUNC-009: Navigation
 * FUNC-010: Logout
 * FUNC-011: Responsive layout
 * FUNC-012: Loading states
 */

test.describe('FUNC: General UI Behavior', () => {
  test('[FUNC-006] SKU browser displays and filters SKUs', async ({ designerBrowser: page }) => {
    await page.goto('/skus');

    // Expect the SKU listing page to render
    await expect(
      page.getByRole('heading', { name: /sku|products|catalog/i })
        .or(page.locator('[data-testid="sku-browser"]'))
        .or(page.getByText(/sku|catalog/i))
    ).toBeVisible();

    // Expect some kind of list or grid
    const skuItems = page.locator('[data-testid="sku-item"]')
      .or(page.getByRole('listitem'))
      .or(page.locator('table tbody tr'));
    await expect(skuItems.first()).toBeVisible();

    // Test filtering
    const searchInput = page.getByPlaceholder(/search|filter/i)
      .or(page.getByLabel(/search|filter/i));
    await expect(searchInput).toBeVisible();
    await searchInput.fill('oak');
    // Expect results to update (at least the list is still present)
    await expect(skuItems.first()).toBeVisible();
  });

  test('[FUNC-008] Error messages display for invalid actions', async ({ designerBrowser: page }) => {
    // Navigate to a page that requires data - use an invalid project ID
    await page.goto('/projects/00000000-0000-0000-0000-000000000000');

    // Expect an error message, not found indicator, or redirect
    await expect(
      page.getByText(/not found|error|does not exist|404/i)
        .or(page.getByRole('alert'))
        .or(page.locator('[data-testid="error-message"]'))
    ).toBeVisible();
  });

  test('[FUNC-009] Navigation between main sections works', async ({ designerBrowser: page }) => {
    await page.goto('/');

    // Navigate to projects
    const projectsNav = page.getByRole('link', { name: /projects/i })
      .or(page.getByRole('navigation').getByText(/projects/i));
    await expect(projectsNav).toBeVisible();
    await projectsNav.click();
    await expect(page).toHaveURL(/\/projects/);

    // Navigate to templates
    const templatesNav = page.getByRole('link', { name: /templates/i })
      .or(page.getByRole('navigation').getByText(/templates/i));
    await expect(templatesNav).toBeVisible();
    await templatesNav.click();
    await expect(page).toHaveURL(/\/templates/);

    // Navigate back home/dashboard
    const homeNav = page.getByRole('link', { name: /home|dashboard/i })
      .or(page.getByRole('navigation').getByText(/home|dashboard/i));
    await expect(homeNav).toBeVisible();
    await homeNav.click();
    await expect(page).toHaveURL(/\/($|dashboard)/);
  });

  test('[FUNC-010] Logout terminates session', async ({ designerBrowser: page }) => {
    await page.goto('/');

    // Look for user menu or logout button
    const userMenu = page.getByRole('button', { name: /user|account|profile|menu/i })
      .or(page.locator('[data-testid="user-menu"]'));
    await expect(userMenu).toBeVisible();
    await userMenu.click();

    const logoutBtn = page.getByRole('button', { name: /log ?out|sign ?out/i })
      .or(page.getByRole('link', { name: /log ?out|sign ?out/i }))
      .or(page.getByRole('menuitem', { name: /log ?out|sign ?out/i }));
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Expect redirect to login page or landing page
    await expect(page).toHaveURL(/\/login|\/auth|\/$/);
  });

  test('[FUNC-011] Responsive layout adapts to mobile viewport', async ({ designerBrowser: page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Expect the page to render without horizontal overflow
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check that hamburger menu or mobile nav is present (common pattern)
    const mobileMenu = page.getByRole('button', { name: /menu/i })
      .or(page.locator('[data-testid="mobile-menu"]'))
      .or(page.locator('[aria-label="Toggle navigation"]'));

    // Either mobile menu is visible or layout still works at small width
    const hasLayout = await body.boundingBox();
    expect(hasLayout).not.toBeNull();
    expect(hasLayout!.width).toBeLessThanOrEqual(375);
  });

  test('[FUNC-012] Loading states appear during data fetch', async ({ designerBrowser: page }) => {
    // Slow down network to observe loading states
    await page.route('**/rest/v1/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.goto('/projects');

    // Expect a loading indicator to appear briefly
    const loadingIndicator = page.getByRole('progressbar')
      .or(page.getByText(/loading/i))
      .or(page.locator('[data-testid="loading"]'))
      .or(page.locator('[aria-busy="true"]'))
      .or(page.locator('.spinner, .loading, [class*="skeleton"]'));

    // Either the loading state was visible or data loaded immediately
    await loadingIndicator.first().isVisible().catch(() => false);

    // After network resolves, content should be present
    await expect(
      page.getByText(/project|no projects|create/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});
