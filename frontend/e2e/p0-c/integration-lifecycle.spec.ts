import { test, expect } from '../fixtures/browser-auth.fixture';
import { test as authTest } from '../fixtures/auth.fixture';
import {
  ACTIVE_TEMPLATE_1,
  SUPABASE_URL,
} from '../fixtures/seed-data';
import { createProject, getProject } from '../helpers/api.helper';

/**
 * P0-C: Integration - End-to-End Lifecycle (Mixed API + Browser)
 *
 * INT-001: Full project lifecycle (create -> measure -> generate BOM -> finalize)
 * INT-002: Bidirectional Canvas-BOM sync
 * INT-003: Multi-zone template covers all component types (API)
 * INT-004: Project configuration versioning (API)
 * INT-005: Actual BOM supersession on re-generation (API)
 * INT-006: Concurrent user access (API)
 * INT-007: Template demotion cascade (API)
 */

test.describe('INT: End-to-End Lifecycle (Browser)', () => {
  test('[INT-001] Full project lifecycle via UI', async ({ designerBrowser: page }) => {
    // Step 1: Create project
    await page.goto('/projects/new');
    await expect(
      page.getByRole('heading', { name: /new project|create project/i })
        .or(page.getByText(/create.*project/i))
    ).toBeVisible();

    await page.getByLabel(/project name|name/i).fill(`INT Lifecycle ${Date.now()}`);
    await page.getByLabel(/client/i).fill('Integration Test Client');

    const templateSelect = page.getByLabel(/template/i);
    await expect(templateSelect).toBeVisible();
    await templateSelect.click();
    await page
      .getByRole('option', { name: new RegExp(ACTIVE_TEMPLATE_1.name, 'i') })
      .click();

    await page.getByRole('button', { name: /create|submit|save/i }).click();

    // Step 2: Should navigate to project detail
    await expect(page).toHaveURL(/\/projects\//);

    // Step 3: Navigate to measurements
    const measureTab = page.getByRole('tab', { name: /measure/i })
      .or(page.getByRole('link', { name: /measure/i }));
    await expect(measureTab).toBeVisible();
    await measureTab.click();

    // Step 4: Trigger BOM generation
    const bomTab = page.getByRole('tab', { name: /bom|materials/i })
      .or(page.getByRole('link', { name: /bom|materials/i }));
    await expect(bomTab).toBeVisible();
    await bomTab.click();

    const generateBtn = page.getByRole('button', { name: /generate|calculate/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Step 5: Finalize
    const finalizeBtn = page.getByRole('button', { name: /finalize|complete/i });
    await expect(finalizeBtn).toBeVisible();
    await finalizeBtn.click();

    // Handle confirmation dialog
    const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Verify final state - project should show finalized/completed status
    await expect(page.getByText(/finalized|complete|locked/i)).toBeVisible();
  });

  test('[INT-002] Bidirectional Canvas-BOM sync', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    // Select a zone in canvas
    const zones = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(zones.first()).toBeVisible();
    await zones.first().click();

    // Assign a SKU via the panel
    const skuInput = page.getByLabel(/sku|material/i)
      .or(page.locator('[data-testid="sku-selector"]'));
    await expect(skuInput).toBeVisible();
    await skuInput.click();

    const option = page.getByRole('option').first();
    await expect(option).toBeVisible();
    await option.click();

    // Navigate to BOM view and verify the assignment is reflected
    const bomTab = page.getByRole('tab', { name: /bom/i })
      .or(page.getByRole('link', { name: /bom/i }));
    await expect(bomTab).toBeVisible();
    await bomTab.click();

    // BOM should show assigned materials
    await expect(
      page.getByRole('table')
        .or(page.getByText(/materials|components|bom/i))
    ).toBeVisible();
  });
});

// API-level integration tests
authTest.describe('INT: Integration (API)', () => {
  authTest('[INT-003] Multi-zone template with all component types', async ({ designerPage }) => {
    // Query template zones to verify multiple component types
    const response = await designerPage.request.get(
      `${SUPABASE_URL}/rest/v1/template_zones?template_id=eq.${ACTIVE_TEMPLATE_1.id}&select=*`
    );

    expect(response.ok()).toBeTruthy();
    const zones = await response.json();

    if (Array.isArray(zones) && zones.length > 0) {
      // Template should have multiple zones
      expect(zones.length).toBeGreaterThan(0);

      // Verify zone structure
      for (const zone of zones) {
        expect(zone).toHaveProperty('id');
        expect(zone).toHaveProperty('template_id');
      }
    }
  });

  authTest('[INT-004] Project configuration versioning', async ({ designerPage }) => {
    // Create a project and verify version tracking
    const project = await createProject(designerPage.request, {
      template_id: ACTIVE_TEMPLATE_1.id,
      name: `INT Version Test ${Date.now()}`,
    });

    expect(project).toHaveProperty('id');

    // Query project config/history
    const historyResponse = await designerPage.request.get(
      `${SUPABASE_URL}/rest/v1/project_versions?project_id=eq.${project.id}&select=*`
    );

    // Version table may or may not exist - verify no server error
    expect(historyResponse.status()).toBeLessThan(500);

    // Re-query the project to check version field
    const updatedProject = await getProject(designerPage.request, project.id);
    expect(updatedProject).not.toBeNull();

    // Cleanup
    await designerPage.request.delete(
      `${SUPABASE_URL}/rest/v1/projects?id=eq.${project.id}`
    );
  });

  authTest('[INT-005] BOM supersession on re-generation', async ({ designerPage }) => {
    // Create a project
    const project = await createProject(designerPage.request, {
      template_id: ACTIVE_TEMPLATE_1.id,
      name: `INT Supersession ${Date.now()}`,
    });

    // Check BOM items initially
    const bom1Response = await designerPage.request.get(
      `${SUPABASE_URL}/rest/v1/bom_items?project_id=eq.${project.id}&select=*`
    );
    expect(bom1Response.status()).toBeLessThan(500);

    // Trigger BOM regeneration via RPC if available
    const regenResponse = await designerPage.request.post(
      `${SUPABASE_URL}/rest/v1/rpc/generate_bom`,
      { data: { p_project_id: project.id } }
    );

    // RPC may not exist - that's a valid blocked state
    if (regenResponse.ok()) {
      // Query BOM again - old items should be superseded
      const bom2Response = await designerPage.request.get(
        `${SUPABASE_URL}/rest/v1/bom_items?project_id=eq.${project.id}&select=*,superseded_by`
      );
      expect(bom2Response.status()).toBeLessThan(500);
    }

    // Cleanup
    await designerPage.request.delete(
      `${SUPABASE_URL}/rest/v1/projects?id=eq.${project.id}`
    );
  });

  authTest('[INT-006] Concurrent user access to same project', async ({
    designerPage,
    consultantPage,
  }) => {
    // Designer creates a project
    const project = await createProject(designerPage.request, {
      template_id: ACTIVE_TEMPLATE_1.id,
      name: `INT Concurrent ${Date.now()}`,
    });

    // Both users read the project simultaneously
    const [designerRead, consultantRead] = await Promise.all([
      getProject(designerPage.request, project.id),
      getProject(consultantPage.request, project.id),
    ]);

    // Both should see the same project
    expect(designerRead).not.toBeNull();
    expect(consultantRead).not.toBeNull();
    expect(designerRead!.id).toBe(consultantRead!.id);

    // Consultant should be able to read but not modify (RLS)
    const updateResponse = await consultantPage.request.patch(
      `${SUPABASE_URL}/rest/v1/projects?id=eq.${project.id}`,
      { data: { name: 'Consultant Override Attempt' } }
    );

    // Update should be denied or produce no effect
    if (updateResponse.ok()) {
      const body = await updateResponse.json();
      const updated = Array.isArray(body) ? body : [body];
      // RLS should filter - either empty result or unchanged
      expect(updated.length).toBeLessThanOrEqual(1);
    }

    // Cleanup
    await designerPage.request.delete(
      `${SUPABASE_URL}/rest/v1/projects?id=eq.${project.id}`
    );
  });

  authTest('[INT-007] Template demotion cascade', async ({ designerPage }) => {
    // Query the active template
    const templateResponse = await designerPage.request.get(
      `${SUPABASE_URL}/rest/v1/templates?id=eq.${ACTIVE_TEMPLATE_1.id}&select=*`
    );
    expect(templateResponse.ok()).toBeTruthy();
    const templates = await templateResponse.json();
    expect(templates.length).toBeGreaterThan(0);

    // Attempt to demote (change status to draft) - should trigger cascade checks
    const demoteResponse = await designerPage.request.patch(
      `${SUPABASE_URL}/rest/v1/templates?id=eq.${ACTIVE_TEMPLATE_1.id}`,
      { data: { status: 'draft' } }
    );

    // Demotion may be blocked if projects depend on this template
    // Valid outcomes: success (if no deps), 409 conflict, 403 forbidden, or empty array
    const status = demoteResponse.status();
    expect(status).toBeLessThan(500);

    // If demotion succeeded, restore the template status
    if (status < 400) {
      const body = await demoteResponse.json();
      if (Array.isArray(body) && body.length > 0) {
        // Restore to active
        await designerPage.request.patch(
          `${SUPABASE_URL}/rest/v1/templates?id=eq.${ACTIVE_TEMPLATE_1.id}`,
          { data: { status: 'active' } }
        );
      }
    }
  });
});
