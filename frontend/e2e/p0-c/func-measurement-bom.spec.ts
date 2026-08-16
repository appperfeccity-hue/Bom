import { test, expect } from '../fixtures/browser-auth.fixture';

/**
 * P0-C: Functional - Measurement Entry, BOM Generation, Finalization (Browser)
 *
 * FUNC-003: Measurement entry via UI
 * FUNC-004: BOM generation triggered and visible
 * FUNC-005: Finalization via UI
 */

test.describe('FUNC: Measurement & BOM Lifecycle UI', () => {
  test('[FUNC-003] Measurement entry via UI', async ({ consultantBrowser: page }) => {
    // Navigate to projects page
    await page.goto('/projects');

    // Select the first available project
    const projectLink = page.getByRole('link', { name: /project|view/i }).first();
    await expect(projectLink).toBeVisible();
    await projectLink.click();

    // Navigate to measurements section
    const measurementsTab = page.getByRole('tab', { name: /measurement/i })
      .or(page.getByRole('link', { name: /measurement/i }));
    await expect(measurementsTab).toBeVisible();
    await measurementsTab.click();

    // Expect measurement form or zone list to be rendered
    await expect(
      page.getByText(/measurement|dimension|zone/i)
    ).toBeVisible();

    // Fill in measurement values
    const widthInput = page.getByLabel(/width/i).or(page.locator('[data-testid="width-input"]'));
    await expect(widthInput).toBeVisible();
    await widthInput.fill('3000');

    const heightInput = page.getByLabel(/height/i).or(page.locator('[data-testid="height-input"]'));
    await expect(heightInput).toBeVisible();
    await heightInput.fill('2400');

    // Save
    const saveBtn = page.getByRole('button', { name: /save|update|confirm/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await expect(page.getByText(/saved|success|updated/i)).toBeVisible();
  });

  test('[FUNC-004] BOM generation triggered and visible', async ({ designerBrowser: page }) => {
    await page.goto('/projects');

    // Navigate to a project that has measurements
    const projectLink = page.getByRole('link', { name: /project|view/i }).first();
    await expect(projectLink).toBeVisible();
    await projectLink.click();

    // Navigate to BOM section
    const bomTab = page.getByRole('tab', { name: /bom|bill of materials/i })
      .or(page.getByRole('link', { name: /bom|bill of materials/i }));
    await expect(bomTab).toBeVisible();
    await bomTab.click();

    // Trigger BOM generation
    const generateBtn = page.getByRole('button', { name: /generate|calculate|refresh/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Expect BOM table or content to become visible
    await expect(
      page.getByRole('table')
        .or(page.getByText(/bom|materials|components/i))
        .or(page.locator('[data-testid="bom-table"]'))
    ).toBeVisible();
  });

  test('[FUNC-005] Finalization via UI', async ({ designerBrowser: page }) => {
    await page.goto('/projects');

    // Navigate to a project detail page
    const projectLink = page.getByRole('link', { name: /project|view/i }).first();
    await expect(projectLink).toBeVisible();
    await projectLink.click();

    // Look for finalize button
    const finalizeBtn = page.getByRole('button', { name: /finalize|complete|lock/i });
    await expect(finalizeBtn).toBeVisible();
    await finalizeBtn.click();

    // Handle confirmation dialog if present
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|finalize/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Expect status to change to finalized/locked
    await expect(
      page.getByText(/finalized|locked|complete/i)
    ).toBeVisible();
  });
});
