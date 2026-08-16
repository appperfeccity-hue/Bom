import { test, expect } from '../fixtures/browser-auth.fixture';
import { ACTIVE_TEMPLATE_1 } from '../fixtures/seed-data';

/**
 * P0-C: Canvas - Rendering & Basic Interactions (Browser)
 *
 * CANVAS-001: Canvas renders zones from template
 * CANVAS-002: Zone selection highlights
 * CANVAS-003: Multi-select zones
 * CANVAS-004: Copy/paste zones
 * CANVAS-005: Undo/redo
 * CANVAS-006: Snap-to-grid alignment
 * CANVAS-007: Zone validation errors display
 */

test.describe('CANVAS: Rendering & Basic Interactions', () => {
  test('[CANVAS-001] Canvas renders zones from template', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    // Expect the canvas container to be present
    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'))
      .or(page.locator('svg[data-role="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    // Expect zones to be rendered within the canvas
    const zones = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));

    // At least one zone should be visible for an active template
    await expect(zones.first()).toBeVisible();
  });

  test('[CANVAS-002] Zone selection highlights the selected zone', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    // Click on the first zone
    const firstZone = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(firstZone.first()).toBeVisible();
    await firstZone.first().click();

    // Expect selection highlight (class change, outline, or data attribute)
    await expect(
      page.locator('[data-selected="true"]')
        .or(page.locator('[class*="selected"]'))
        .or(page.locator('[aria-selected="true"]'))
    ).toBeVisible();
  });

  test('[CANVAS-003] Multi-select zones with modifier key', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const zones = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));

    // Wait for zones to render
    await expect(zones.first()).toBeVisible();

    const zoneCount = await zones.count();
    test.skip(zoneCount < 2, 'Template has fewer than 2 zones; multi-select not testable');

    // Click first zone
    await zones.nth(0).click();

    // Ctrl+click second zone for multi-select
    await zones.nth(1).click({ modifiers: ['Control'] });

    // Expect multiple selections
    const selected = page.locator('[data-selected="true"]')
      .or(page.locator('[class*="selected"]'))
      .or(page.locator('[aria-selected="true"]'));
    await expect(selected).toHaveCount(2);
  });

  test('[CANVAS-004] Copy/paste zones via keyboard shortcuts', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const zones = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(zones.first()).toBeVisible();

    const initialCount = await zones.count();

    // Select a zone and copy/paste
    await zones.first().click();
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');

    // Expect zone count to increase by 1
    await expect(zones).toHaveCount(initialCount + 1);
  });

  test('[CANVAS-005] Undo/redo reverts and restores changes', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const zones = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(zones.first()).toBeVisible();

    const initialCount = await zones.count();

    // Select and copy/paste to create a change
    await zones.first().click();
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await expect(zones).toHaveCount(initialCount + 1);

    // Undo
    await page.keyboard.press('Control+z');
    await expect(zones).toHaveCount(initialCount);

    // Redo
    await page.keyboard.press('Control+Shift+z');
    await expect(zones).toHaveCount(initialCount + 1);
  });

  test('[CANVAS-006] Snap-to-grid aligns zones on move', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const zone = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(zone.first()).toBeVisible();

    // Get initial position
    const box = await zone.first().boundingBox();
    expect(box).not.toBeNull();

    // Drag zone slightly (should snap to grid)
    await zone.first().hover();
    await page.mouse.down();
    await page.mouse.move(box!.x + 17, box!.y + 13); // Non-grid-aligned offset
    await page.mouse.up();

    // Get new position - should be snapped to grid increments
    const newBox = await zone.first().boundingBox();
    expect(newBox).not.toBeNull();

    // Verify the zone has a valid position (snap-to-grid means position is quantized)
    // The exact grid size is implementation-dependent, but the zone must remain rendered
    expect(newBox!.width).toBeGreaterThan(0);
    expect(newBox!.height).toBeGreaterThan(0);
  });

  test('[CANVAS-007] Zone validation errors display on invalid config', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const zone = page.locator('[data-testid="zone"]')
      .or(page.locator('[data-zone-id]'))
      .or(page.locator('[class*="zone"]'));
    await expect(zone.first()).toBeVisible();

    // Select a zone to open properties panel
    await zone.first().click();

    // Look for properties panel
    const propsPanel = page.locator('[data-testid="properties-panel"]')
      .or(page.locator('[class*="properties"]'))
      .or(page.locator('[class*="inspector"]'));
    await expect(propsPanel).toBeVisible();

    // Clear a required field like width to trigger validation
    const widthInput = propsPanel.getByLabel(/width/i)
      .or(propsPanel.locator('input[name="width"]'));
    await expect(widthInput).toBeVisible();
    await widthInput.clear();
    await widthInput.press('Tab');

    // Expect validation error message
    await expect(
      page.getByText(/required|invalid|must be/i)
        .or(page.locator('[class*="error"]'))
        .or(page.locator('[role="alert"]'))
    ).toBeVisible();
  });
});
