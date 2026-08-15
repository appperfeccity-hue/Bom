import { test, expect } from '../fixtures/auth.fixture';
import { SUPABASE_URL } from '../fixtures/seed-data';
import { expectRlsDeny } from '../helpers/assertions';

/**
 * P0-A: RBAC - Template Creation
 *
 * Tests that role-based access control correctly restricts template creation.
 * Pattern: Authenticate via Supabase Auth, then perform PostgREST calls with the JWT.
 */

const TEST_TEMPLATE_PAYLOAD = {
  name: `E2E Test Template ${Date.now()}`,
  description: 'Created by E2E RBAC test - should be cleaned up',
  status: 'draft',
};

test.describe('RBAC: Template Creation', () => {
  test('Designer can create a template', async ({ designerPage }) => {
    const response = await designerPage.request.post(
      `${SUPABASE_URL}/rest/v1/templates`,
      {
        data: TEST_TEMPLATE_PAYLOAD,
      }
    );

    // Designer should be allowed to create templates
    expect(response.status()).toBeLessThan(400);
    const body = await response.json();
    const template = Array.isArray(body) ? body[0] : body;
    expect(template).toHaveProperty('id');
    expect(template.name).toBe(TEST_TEMPLATE_PAYLOAD.name);

    // Cleanup: delete the test template
    if (template.id) {
      await designerPage.request.delete(
        `${SUPABASE_URL}/rest/v1/templates?id=eq.${template.id}`
      );
    }
  });

  test('Consultant cannot create a template', async ({ consultantPage }) => {
    const response = await consultantPage.request.post(
      `${SUPABASE_URL}/rest/v1/templates`,
      {
        data: TEST_TEMPLATE_PAYLOAD,
      }
    );

    // Consultant should be denied by RLS
    await expectRlsDeny(response);
  });

  test('Admin can create a template', async ({ adminPage }) => {
    const response = await adminPage.request.post(
      `${SUPABASE_URL}/rest/v1/templates`,
      {
        data: TEST_TEMPLATE_PAYLOAD,
      }
    );

    // Admin should be allowed to create templates
    expect(response.status()).toBeLessThan(400);
    const body = await response.json();
    const template = Array.isArray(body) ? body[0] : body;
    expect(template).toHaveProperty('id');
    expect(template.name).toBe(TEST_TEMPLATE_PAYLOAD.name);

    // Cleanup: delete the test template
    if (template.id) {
      await adminPage.request.delete(
        `${SUPABASE_URL}/rest/v1/templates?id=eq.${template.id}`
      );
    }
  });
});
