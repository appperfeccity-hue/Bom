import { APIResponse, APIRequestContext, expect } from '@playwright/test';
import { SUPABASE_URL } from '../fixtures/seed-data';

/**
 * Asserts that a response indicates RLS denial.
 * PostgREST returns an empty array when RLS blocks access,
 * or a 403 status for explicit denials.
 */
export async function expectRlsDeny(response: APIResponse): Promise<void> {
  const status = response.status();

  if (status === 403) {
    // Explicit denial
    return;
  }

  if (status === 200 || status === 201) {
    // PostgREST may return 200 with empty array when RLS filters out results
    const body = await response.json();
    expect(Array.isArray(body) ? body : [body]).toHaveLength(0);
    return;
  }

  // Any 4xx status is also acceptable as a denial
  expect(status).toBeGreaterThanOrEqual(400);
}

/**
 * Asserts that a mutation function fails (the resource is immutable).
 * Accepts an async function that attempts the mutation and expects it to
 * either throw or return a response indicating failure.
 */
export async function expectImmutable(
  updateFn: () => Promise<APIResponse>
): Promise<void> {
  const response = await updateFn();
  const status = response.status();

  // Mutation should be denied: 403, 409, or empty result (RLS block)
  if (status === 200 || status === 204) {
    // If we got a success status, check that no rows were actually modified
    const body = await response.text();
    const parsed = body ? JSON.parse(body) : [];
    expect(Array.isArray(parsed) ? parsed : [parsed]).toHaveLength(0);
  } else {
    expect(status).toBeGreaterThanOrEqual(400);
  }
}

/**
 * Checks that an audit event exists for the given project and event type.
 */
export async function expectAuditEvent(
  request: APIRequestContext,
  projectId: string,
  eventType: string
): Promise<void> {
  const response = await request.get(
    `${SUPABASE_URL}/rest/v1/audit_events?project_id=eq.${projectId}&event_type=eq.${eventType}&select=*`
  );

  expect(response.ok()).toBeTruthy();
  const events = await response.json();
  expect(events.length).toBeGreaterThan(0);
}
