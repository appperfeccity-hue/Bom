import { test, expect } from '../fixtures/auth.fixture';
import { SUPABASE_URL } from '../fixtures/seed-data';
import { expectRlsDeny } from '../helpers/assertions';

/**
 * P0-A: RBAC - Template Creation
 *
 * Tests that role-based access control correctly restricts template creation.
 * Pattern: Authenticate via Supabase Auth, then perform PostgREST calls with the JWT.
 */

/** Generates a unique test template payload per invocation to avoid name collisions. */
function makeTemplatePayload() {
  return {
    name: `E2E Test Template ${Date.now()}`,
    description: 'Created by E2E RBAC test - should be cleaned up',
    status: 'draft',
  };
}

test.describe('RBAC: Template Creation', () => {
  test('Designer can create a template', async ({ designerPage }) => {
    const payload = makeTemplatePayload();
    let templateId: string | undefined;

    try {
      const response = await designerPage.request.post(
        `${SUPABASE_URL}/rest/v1/templates`,
        {
          data: payload,
        }
      );

      // Designer should be allowed to create templates
      expect(response.status()).toBeLessThan(400);
      const body = await response.json();
      const template = Array.isArray(body) ? body[0] : body;
      templateId = template?.id;
      expect(template).toHaveProperty('id');
      expect(template.name).toBe(payload.name);
    } finally {
      // Cleanup: delete the test template even if assertions fail
      if (templateId) {
        await designerPage.request.delete(
          `${SUPABASE_URL}/rest/v1/templates?id=eq.${templateId}`
        );
      }
    }
  });

  test('Consultant cannot create a template', async ({ consultantPage }) => {
    const payload = makeTemplatePayload();

    const response = await consultantPage.request.post(
      `${SUPABASE_URL}/rest/v1/templates`,
      {
        data: payload,
      }
    );

    // Consultant should be denied by RLS
    await expectRlsDeny(response);
  });

  test('Admin can create a template', async ({ adminPage }) => {
    const payload = makeTemplatePayload();
    let templateId: string | undefined;

    try {
      const response = await adminPage.request.post(
        `${SUPABASE_URL}/rest/v1/templates`,
        {
          data: payload,
        }
      );

      // Admin should be allowed to create templates
      expect(response.status()).toBeLessThan(400);
      const body = await response.json();
      const template = Array.isArray(body) ? body[0] : body;
      templateId = template?.id;
      expect(template).toHaveProperty('id');
      expect(template.name).toBe(payload.name);
    } finally {
      // Cleanup: delete the test template even if assertions fail
      if (templateId) {
        await adminPage.request.delete(
          `${SUPABASE_URL}/rest/v1/templates?id=eq.${templateId}`
        );
      }
    }
  });
});
