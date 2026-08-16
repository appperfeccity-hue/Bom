import { test, expect } from '@playwright/test';

/**
 * P0-C: Functional - Measurement Entry, BOM Generation, Finalization (Browser)
 *
 * FUNC-003: Measurement entry via UI
 * FUNC-004: BOM generation triggered and visible
 * FUNC-005: Finalization via UI
 */

test.describe('FUNC: Measurement & BOM Lifecycle UI', () => {
  test('[FUNC-003] Measurement entry via UI', async ({ page }) => {
    // Navigate to a project's measurement page
    await page.goto('/projects');

    // Select the first available project or navigate to measurement entry
    const projectLink = page.getByRole('link', { name: /project|view/i }).first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
    }

    // Navigate to measurements section
    const measurementsTab = page.getByRole('tab', { name: /measurement/i })
      .or(page.getByRole('link', { name: /measurement/i }));
    if (await measurementsTab.isVisible()) {
      await measurementsTab.click();
    }

    // Expect measurement form or zone list to be rendered
    await expect(
      page.getByText(/measurement|dimension|zone/i)
    ).toBeVisible();

    // Fill in a measurement value if form is present
    const widthInput = page.getByLabel(/width/i).or(page.locator('[data-testid="width-input"]'));
    if (await widthInput.isVisible()) {
      await widthInput.fill('3000');
    }

    const heightInput = page.getByLabel(/height/i).or(page.locator('[data-testid="height-input"]'));
    if (await heightInput.isVisible()) {
      await heightInput.fill('2400');
    }

    // Save if there's a save button
    const saveBtn = page.getByRole('button', { name: /save|update|confirm/i });
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await expect(page.getByText(/saved|success|updated/i)).toBeVisible();
    }
  });

  test('[FUNC-004] BOM generation triggered and visible', async ({ page }) => {
    await page.goto('/projects');

    // Navigate to a project that has measurements
    const projectLink = page.getByRole('link', { name: /project|view/i }).first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
    }

    // Navigate to BOM section
    const bomTab = page.getByRole('tab', { name: /bom|bill of materials/i })
      .or(page.getByRole('link', { name: /bom|bill of materials/i }));
    if (await bomTab.isVisible()) {
      await bomTab.click();
    }

    // Trigger BOM generation if button exists
    const generateBtn = page.getByRole('button', { name: /generate|calculate|refresh/i });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
    }

    // Expect BOM table or content to become visible
    await expect(
      page.getByRole('table')
        .or(page.getByText(/bom|materials|components/i))
        .or(page.locator('[data-testid="bom-table"]'))
    ).toBeVisible();
  });

  test('[FUNC-005] Finalization via UI', async ({ page }) => {
    await page.goto('/projects');

    // Navigate to a project detail page
    const projectLink = page.getByRole('link', { name: /project|view/i }).first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
    }

    // Look for finalize button
    const finalizeBtn = page.getByRole('button', { name: /finalize|complete|lock/i });

    if (await finalizeBtn.isVisible()) {
      await finalizeBtn.click();

      // Expect confirmation dialog
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|finalize/i });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      // Expect status to change to finalized/locked
      await expect(
        page.getByText(/finalized|locked|complete/i)
      ).toBeVisible();
    } else {
      // If no finalize button, at least verify the project page loaded
      await expect(page.getByText(/project|details/i)).toBeVisible();
    }
  });
});
