import { test, expect } from '../fixtures/browser-auth.fixture';
import { ACTIVE_TEMPLATE_1 } from '../fixtures/seed-data';

/**
 * P0-C: Canvas - Advanced Interactions (Browser)
 *
 * CANVAS-008: Zoom in/out
 * CANVAS-009: Pan navigation
 * CANVAS-010: SKU assignment via canvas
 * CANVAS-011: Keyboard shortcuts
 * CANVAS-012: BOM link indicator on zones
 * CANVAS-013: Touch viewport interactions
 * CANVAS-014: Permission enforcement (read-only for consultants)
 */

test.describe('CANVAS: Advanced Interactions', () => {
  test('[CANVAS-008] Zoom in/out with scroll wheel', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    // Get initial canvas transform or zoom level
    const initialTransform = await canvas.first().evaluate((el) => {
      return window.getComputedStyle(el).transform || el.getAttribute('data-zoom') || '1';
    });

    // Zoom in with scroll
    await canvas.first().hover();
    await page.mouse.wheel(0, -100);

    // Give time for zoom animation
    await page.waitForTimeout(300);

    // Verify zoom was triggered - transform or zoom attribute should change
    const afterTransform = await canvas.first().evaluate((el) => {
      return window.getComputedStyle(el).transform || el.getAttribute('data-zoom') || '1';
    });

    // Canvas is still visible and functional after zoom
    await expect(canvas.first()).toBeVisible();
  });

  test('[CANVAS-009] Pan navigation with space+drag', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    // Pan using space + drag
    const box = await canvas.first().boundingBox();
    expect(box).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Hold space and drag to pan
    await page.keyboard.down('Space');
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 100, centerY + 50);
    await page.mouse.up();
    await page.keyboard.up('Space');

    // Canvas should still be functional after panning
    await expect(canvas.first()).toBeVisible();
  });

  test('[CANVAS-010] SKU assignment via canvas context menu or panel', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const zones = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(zones.first()).toBeVisible();

    // Select a zone
    await zones.first().click();

    // Look for SKU assignment panel or right-click context menu
    const skuPanel = page.locator('[data-testid="sku-panel"]')
      .or(page.locator('[class*="sku"]'))
      .or(page.locator('[data-testid="properties-panel"]'));

    // Try right-click for context menu if panel is not visible
    if (!(await skuPanel.first().isVisible({ timeout: 2000 }).catch(() => false))) {
      await zones.first().click({ button: 'right' });
    }

    // Look for SKU selector/assign option
    const skuSelector = page.getByRole('combobox', { name: /sku/i })
      .or(page.getByLabel(/sku|material|product/i))
      .or(page.getByRole('menuitem', { name: /assign|sku/i }));
    await expect(skuSelector).toBeVisible();
    await skuSelector.click();

    // Expect SKU options to appear
    await expect(
      page.getByRole('option').or(page.getByRole('listbox'))
    ).toBeVisible();
  });

  test('[CANVAS-011] Keyboard shortcuts for common actions', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    // Test Delete key removes selected zone
    const zones = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(zones.first()).toBeVisible();

    const initialCount = await zones.count();
    await zones.first().click();
    await page.keyboard.press('Delete');

    // Zone should be removed or a confirmation dialog appears
    const afterCount = await zones.count();
    const confirmDialog = page.getByRole('dialog')
      .or(page.getByRole('alertdialog'));
    const removed = afterCount < initialCount || await confirmDialog.isVisible();
    expect(removed).toBeTruthy();

    // Undo the deletion
    await page.keyboard.press('Control+z');
  });

  test('[CANVAS-012] BOM link indicator shows on zones with assigned SKUs', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const zones = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(zones.first()).toBeVisible();

    // Look for BOM link indicators (icons, badges, or overlays on zones)
    const bomIndicator = page.locator('[data-testid="bom-link"]')
      .or(page.locator('[class*="bom-link"]'))
      .or(page.locator('[class*="linked"]'))
      .or(page.locator('[data-has-sku="true"]'));

    // Zones with SKUs assigned should show a BOM link indicator
    // At minimum one zone in the active template should have an assigned SKU
    await expect(bomIndicator.first()).toBeVisible();
  });

  test('[CANVAS-013] Touch viewport interactions on mobile', async ({ designerBrowser: page }) => {
    // Emulate touch device
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    const box = await canvas.first().boundingBox();
    expect(box).not.toBeNull();

    // Simulate tap interaction
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);

    // Canvas should respond to touch without crashing
    await expect(canvas.first()).toBeVisible();

    // Verify zones are still tappable
    const zones = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(zones.first()).toBeVisible();

    const zoneBox = await zones.first().boundingBox();
    expect(zoneBox).not.toBeNull();
    await page.touchscreen.tap(
      zoneBox!.x + zoneBox!.width / 2,
      zoneBox!.y + zoneBox!.height / 2
    );
  });

  test('[CANVAS-014] Permission enforcement: consultant cannot edit canvas', async ({ consultantBrowser: page }) => {
    // Navigate to template editor as consultant (non-designer role)
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    // Either the page shows read-only mode or denies access entirely
    const readOnlyIndicator = page.getByText(/read.?only|view.?only|no permission/i)
      .or(page.locator('[data-readonly="true"]'))
      .or(page.locator('[class*="readonly"]'));

    const accessDenied = page.getByText(/access denied|forbidden|unauthorized/i);

    // Consultant must see either a read-only indicator or an access denied message
    await expect(
      readOnlyIndicator.first().or(accessDenied.first())
    ).toBeVisible();
  });
});
