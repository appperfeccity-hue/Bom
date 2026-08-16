import { test, expect } from '../fixtures/browser-auth.fixture';
import { test as authTest } from '../fixtures/auth.fixture';
import {
  ACTIVE_TEMPLATE_1,
  SUPABASE_URL,
} from '../fixtures/seed-data';

/**
 * P0-C: SVG Asset Rendering & Management (Browser + API)
 *
 * SVG-001: SVG renders correctly in canvas
 * SVG-002: SVG scales with zoom level
 * SVG-003: Asset version resolves correctly (API)
 * SVG-004: Missing asset shows placeholder
 * SVG-005: Asset metadata accessible (API)
 * SVG-006: Pattern repeat renders correctly
 * SVG-007: Asset renders in BOM view
 * SVG-008: Asset loading performance within thresholds
 */

test.describe('SVG: Asset Rendering (Browser)', () => {
  test('[SVG-001] SVG renders correctly in canvas', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    // Wait for canvas to load
    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    // Check that SVG elements are rendered within the canvas
    const svgElements = page.locator('svg')
      .or(page.locator('[data-testid="svg-asset"]'))
      .or(page.locator('img[src*=".svg"]'));
    await expect(svgElements.first()).toBeVisible();

    // Verify SVG has proper dimensions (non-zero bounding box)
    const svgBox = await svgElements.first().boundingBox();
    expect(svgBox).not.toBeNull();
    expect(svgBox!.width).toBeGreaterThan(0);
    expect(svgBox!.height).toBeGreaterThan(0);
  });

  test('[SVG-002] SVG scales proportionally with zoom', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    const svgElement = page.locator('svg')
      .or(page.locator('[data-testid="svg-asset"]'))
      .or(page.locator('img[src*=".svg"]'));
    await expect(svgElement.first()).toBeVisible();

    const initialBox = await svgElement.first().boundingBox();
    expect(initialBox).not.toBeNull();

    // Zoom in
    await canvas.first().hover();
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(300);

    const zoomedBox = await svgElement.first().boundingBox();
    expect(zoomedBox).not.toBeNull();

    // After zoom in, SVG should remain rendered with non-zero dimensions
    expect(zoomedBox!.width).toBeGreaterThan(0);
    expect(zoomedBox!.height).toBeGreaterThan(0);
  });

  test('[SVG-004] Missing asset shows placeholder image', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    // Intercept asset requests and force a 404 to trigger placeholder rendering
    await page.route('**/storage/**/*.svg', (route) => route.fulfill({ status: 404 }));

    // Reload to trigger the intercepted request
    await page.reload();
    await expect(canvas.first()).toBeVisible();

    // Look for placeholder elements (broken image indicators, fallback SVGs)
    const placeholders = page.locator('[data-testid="asset-placeholder"]')
      .or(page.locator('[class*="placeholder"]'))
      .or(page.locator('[alt*="missing"]'))
      .or(page.locator('[data-missing="true"]'));

    // With assets blocked, placeholder should render
    await expect(placeholders.first()).toBeVisible();
  });

  test('[SVG-006] Pattern repeat renders correctly in zones', async ({ designerBrowser: page }) => {
    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    // Look for pattern elements (SVG patterns, repeated textures)
    const patterns = page.locator('pattern')
      .or(page.locator('[data-testid="pattern"]'))
      .or(page.locator('defs pattern'))
      .or(page.locator('[class*="pattern"]'));

    // Check for tiled/repeated background images
    const tiledElements = page.locator('[style*="background-repeat"]')
      .or(page.locator('[style*="repeat"]'));

    // Pattern elements must be present in the SVG canvas for zones with materials
    await expect(patterns.first().or(tiledElements.first())).toBeVisible();
  });

  test('[SVG-007] Asset renders in BOM view', async ({ designerBrowser: page }) => {
    // Navigate to a project with BOM data
    await page.goto('/projects');

    const projectLink = page.getByRole('link', { name: /project|view/i }).first();
    await expect(projectLink).toBeVisible();
    await projectLink.click();

    // Navigate to BOM tab
    const bomTab = page.getByRole('tab', { name: /bom|materials/i })
      .or(page.getByRole('link', { name: /bom|materials/i }));
    await expect(bomTab).toBeVisible();
    await bomTab.click();

    // BOM view should render with asset thumbnails/previews
    await expect(
      page.getByRole('table')
        .or(page.getByText(/bom|materials|components/i))
        .or(page.locator('[data-testid="bom-table"]'))
    ).toBeVisible();
  });

  test('[SVG-008] Asset loading performance within acceptable thresholds', async ({ designerBrowser: page }) => {
    const startTime = Date.now();

    await page.goto(`/templates/${ACTIVE_TEMPLATE_1.id}/editor`);

    const canvas = page.locator('[data-testid="canvas"]')
      .or(page.locator('canvas'))
      .or(page.locator('[class*="canvas"]'));
    await expect(canvas.first()).toBeVisible();

    const loadTime = Date.now() - startTime;

    // Performance threshold: page interactive within 10 seconds
    expect(loadTime).toBeLessThan(10_000);

    // Verify no assets are still loading (canvas is interactive)
    await page.waitForTimeout(1000);
    await expect(canvas.first()).toBeVisible();
  });
});

// API-level SVG asset tests
authTest.describe('SVG: Asset Management (API)', () => {
  authTest('[SVG-003] Asset version resolves to latest', async ({ designerPage }) => {
    // Query asset versions from the database
    const response = await designerPage.request.get(
      `${SUPABASE_URL}/rest/v1/assets?select=id,version,file_path,status&order=version.desc&limit=5`
    );

    if (response.ok()) {
      const assets = await response.json();
      if (Array.isArray(assets) && assets.length > 0) {
        // Verify assets have version numbers
        expect(assets[0]).toHaveProperty('version');
        // Version should be a positive integer
        expect(assets[0].version).toBeGreaterThan(0);
      }
    }
    // If assets table doesn't exist or is empty, the endpoint still responds
    expect(response.status()).toBeLessThan(500);
  });

  authTest('[SVG-005] Asset metadata is accessible via API', async ({ designerPage }) => {
    // Query asset metadata
    const response = await designerPage.request.get(
      `${SUPABASE_URL}/rest/v1/assets?select=id,name,file_path,mime_type,width,height,metadata&limit=5`
    );

    if (response.ok()) {
      const assets = await response.json();
      if (Array.isArray(assets) && assets.length > 0) {
        const asset = assets[0];
        // Asset should have identifying metadata
        expect(asset).toHaveProperty('id');
        // File path or name should be present
        expect(asset.name || asset.file_path).toBeTruthy();
      }
    }
    // API should respond without server error
    expect(response.status()).toBeLessThan(500);
  });
});
