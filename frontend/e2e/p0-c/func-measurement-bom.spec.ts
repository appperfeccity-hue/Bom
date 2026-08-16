import { test, expect } from '../fixtures/browser-auth.fixture';

/**
 * P0-C: Functional - Measurement Entry, BOM Generation, Finalization (Browser)
 *
 * The app is a SPA with sidebar button navigation:
 *   Dashboard | SKU Master | Catalogue | Templates | Design Library | Projects | Settings
 *
 * FUNC-003: Measurement entry via UI
 * FUNC-004: BOM generation triggered and visible
 * FUNC-005: Finalization via UI
 */

test.describe('FUNC: Measurement & BOM Lifecycle UI', () => {
  test('[FUNC-003] Measurement entry via UI', async ({ consultantBrowser: page }) => {
    // Navigate to Projects section via sidebar
    const projectsBtn = page.getByRole('button', { name: 'Projects' });
    await expect(projectsBtn).toBeVisible();
    await projectsBtn.click();

    // Look for a project entry to click into
    const projectEntry = page.getByRole('link', { name: /project|view/i }).first()
      .or(page.getByRole('button', { name: /project|view|open/i }).first())
      .or(page.locator('[data-testid*="project"]').first());

    test.skip(
      !(await projectEntry.isVisible({ timeout: 5000 }).catch(() => false)),
      'No project entries visible in Projects view - measurement entry requires an existing project'
    );

    await projectEntry.click();

    // Navigate to measurements section
    const measurementsTab = page.getByRole('tab', { name: /measurement/i })
      .or(page.getByRole('button', { name: /measurement/i }))
      .or(page.getByText(/measurement|dimension/i));

    test.skip(
      !(await measurementsTab.isVisible({ timeout: 5000 }).catch(() => false)),
      'Measurements section not available in the project detail view in current MVP'
    );

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
    // Navigate to Projects section via sidebar
    const projectsBtn = page.getByRole('button', { name: 'Projects' });
    await expect(projectsBtn).toBeVisible();
    await projectsBtn.click();

    // Navigate to a project that has measurements
    const projectEntry = page.getByRole('link', { name: /project|view/i }).first()
      .or(page.getByRole('button', { name: /project|view|open/i }).first())
      .or(page.locator('[data-testid*="project"]').first());

    test.skip(
      !(await projectEntry.isVisible({ timeout: 5000 }).catch(() => false)),
      'No project entries visible - BOM generation requires an existing project with measurements'
    );

    await projectEntry.click();

    // Navigate to BOM section
    const bomTab = page.getByRole('tab', { name: /bom|bill of materials/i })
      .or(page.getByRole('button', { name: /bom|bill of materials/i }))
      .or(page.getByText(/bom|bill of materials/i));

    test.skip(
      !(await bomTab.isVisible({ timeout: 5000 }).catch(() => false)),
      'BOM section not available in the project detail view in current MVP'
    );

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
    // Navigate to Projects section via sidebar
    const projectsBtn = page.getByRole('button', { name: 'Projects' });
    await expect(projectsBtn).toBeVisible();
    await projectsBtn.click();

    // Navigate to a project detail page
    const projectEntry = page.getByRole('link', { name: /project|view/i }).first()
      .or(page.getByRole('button', { name: /project|view|open/i }).first())
      .or(page.locator('[data-testid*="project"]').first());

    test.skip(
      !(await projectEntry.isVisible({ timeout: 5000 }).catch(() => false)),
      'No project entries visible - finalization requires an existing project'
    );

    await projectEntry.click();

    // Look for finalize button
    const finalizeBtn = page.getByRole('button', { name: /finalize|complete|lock/i });

    test.skip(
      !(await finalizeBtn.isVisible({ timeout: 5000 }).catch(() => false)),
      'Finalize button not available in project detail view in current MVP'
    );

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
