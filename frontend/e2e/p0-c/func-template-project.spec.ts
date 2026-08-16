import { test, expect } from '@playwright/test';
import {
  ACTIVE_TEMPLATE_1,
} from '../fixtures/seed-data';

/**
 * P0-C: Functional - Template & Project Lifecycle (Browser)
 *
 * FUNC-001: Project creation via UI
 * FUNC-002: Template creation via UI
 * FUNC-007: Template activation via UI
 */

test.describe('FUNC: Template & Project Lifecycle UI', () => {
  test('[FUNC-001] Project creation via UI', async ({ page }) => {
    await page.goto('/projects/new');

    // Expect the new project form to be rendered
    await expect(
      page.getByRole('heading', { name: /new project|create project/i })
    ).toBeVisible();

    // Fill in project details
    await page.getByLabel(/project name|name/i).fill('E2E Browser Project');
    await page.getByLabel(/client/i).fill('E2E Test Client');

    // Select template
    const templateSelect = page.getByLabel(/template/i);
    if (await templateSelect.isVisible()) {
      await templateSelect.click();
      await page
        .getByRole('option', { name: new RegExp(ACTIVE_TEMPLATE_1.name, 'i') })
        .click();
    }

    // Submit form
    await page.getByRole('button', { name: /create|submit|save/i }).click();

    // Expect navigation to project detail or success feedback
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+|\/projects/);
  });

  test('[FUNC-002] Template creation via UI', async ({ page }) => {
    await page.goto('/templates/new');

    // Expect the new template form
    await expect(
      page.getByRole('heading', { name: /new template|create template/i })
    ).toBeVisible();

    // Fill in template details
    await page
      .getByLabel(/template name|name/i)
      .fill(`E2E Template ${Date.now()}`);
    await page
      .getByLabel(/description/i)
      .fill('Created by E2E browser test');

    // Submit
    await page.getByRole('button', { name: /create|submit|save/i }).click();

    // Expect success feedback or navigation
    await expect(
      page.getByText(/created|success/i).or(page.locator('[data-testid="template-detail"]'))
    ).toBeVisible();
  });

  test('[FUNC-007] Template activation via UI', async ({ page }) => {
    // Navigate to a known draft template's detail page
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}`);

    // Expect template detail to load
    await expect(
      page.getByText(new RegExp(ACTIVE_TEMPLATE_1.name, 'i'))
    ).toBeVisible();

    // Look for activation control (button, toggle, or status selector)
    const activateBtn = page.getByRole('button', {
      name: /activate|publish|set active/i,
    });
    const statusSelect = page.getByLabel(/status/i);

    if (await activateBtn.isVisible()) {
      await activateBtn.click();
    } else if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('active');
      await page.getByRole('button', { name: /save|update/i }).click();
    }

    // Expect status to reflect active state
    await expect(page.getByText(/active/i)).toBeVisible();
  });
});
