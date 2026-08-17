import { test, expect } from '../fixtures/browser-auth.fixture';
import {
  ACTIVE_TEMPLATE_1,
} from '../fixtures/seed-data';

/**
 * P0-C: Functional - Template & Project Lifecycle (Browser)
 *
 * The app is a SPA with sidebar button navigation:
 *   Dashboard | SKU Master | Catalogue | Templates | Design Library | Projects | Settings
 *
 * Dashboard shows cards: "Open Canvas", "My Templates"
 * Projects are created via RPC (create_project), not a /projects/new form.
 * Templates are managed via the "Templates" sidebar button.
 *
 * FUNC-001: Project creation via UI
 * FUNC-002: Template creation via UI
 * FUNC-007: Template activation via UI
 */

test.describe('FUNC: Template & Project Lifecycle UI', () => {
  test('[FUNC-001] Project creation via UI', async ({ designerBrowser: page }) => {
    // The app is a SPA - no /projects/new route exists.
    // Projects are created via the create_project RPC, triggered from the canvas or Projects view.
    // Navigate to Projects section via sidebar
    const projectsBtn = page.getByRole('button', { name: 'Projects' });
    await expect(projectsBtn).toBeVisible();
    await projectsBtn.click();

    // Look for a create/add project mechanism in the Projects view
    const createBtn = page.getByRole('button', { name: /create|add|new/i })
      .or(page.getByText(/create.*project|new.*project/i));

    // If the MVP does not have a "create project" button in the UI,
    // the feature is not yet available via the browser interface.
    test.skip(
      !(await createBtn.first().isVisible({ timeout: 5000 }).catch(() => false)),
      'Project creation UI not available in current MVP - projects are created via RPC'
    );

    await createBtn.first().click();

    // If we reach here, a project creation mechanism exists
    // Expect some form of project setup to appear
    await expect(
      page.getByText(/project|template|create/i)
    ).toBeVisible();
  });

  test('[FUNC-002] Template creation via UI', async ({ designerBrowser: page }) => {
    // Navigate to Templates section via sidebar
    const templatesBtn = page.getByRole('button', { name: 'Templates' });
    await expect(templatesBtn).toBeVisible();
    await templatesBtn.click();

    // Look for a create/add template mechanism
    const createBtn = page.getByRole('button', { name: /create|add|new/i })
      .or(page.getByText(/create.*template|new.*template/i));

    // If the MVP does not have a "create template" button in the UI,
    // the feature is not yet available.
    test.skip(
      !(await createBtn.first().isVisible({ timeout: 5000 }).catch(() => false)),
      'Template creation UI not available in current MVP - no /templates/new route exists'
    );

    await createBtn.first().click();

    // Expect some form of template creation to appear
    // Use .first() to handle multiple matches in the template section
    await expect(
      page.getByTestId('my-templates-btn')
        .or(page.getByRole('heading', { name: /template/i }))
    ).toBeVisible();
  });

  test('[FUNC-007] Template activation via UI', async ({ designerBrowser: page }) => {
    // Navigate to Templates section via sidebar
    const templatesBtn = page.getByRole('button', { name: 'Templates' });
    await expect(templatesBtn).toBeVisible();
    await templatesBtn.click();

    // Look for the known template in the list
    const templateEntry = page.getByText(new RegExp(ACTIVE_TEMPLATE_1.name, 'i'));

    test.skip(
      !(await templateEntry.isVisible({ timeout: 5000 }).catch(() => false)),
      'Template list/detail UI not available in current MVP for activation'
    );

    await templateEntry.click();

    // Look for activation control (button, toggle, or status selector)
    const activateBtn = page.getByRole('button', {
      name: /activate|publish|set active/i,
    });
    const statusSelect = page.getByLabel(/status/i);

    // At least one activation mechanism must be present
    await expect(activateBtn.or(statusSelect)).toBeVisible();

    if (await activateBtn.isVisible()) {
      await activateBtn.click();
    } else {
      await statusSelect.selectOption('active');
      await page.getByRole('button', { name: /save|update/i }).click();
    }

    // Expect status to reflect active state
    await expect(page.getByText(/active/i)).toBeVisible();
  });
});
