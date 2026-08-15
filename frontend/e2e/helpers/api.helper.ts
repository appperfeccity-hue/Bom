import { APIRequestContext } from '@playwright/test';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../fixtures/seed-data';

/**
 * Authenticates a user via Supabase Auth REST API and returns the session.
 */
export async function signIn(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<{
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
}> {
  const response = await request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      data: { email, password },
    }
  );

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`signIn failed for ${email}: ${response.status()} ${body}`);
  }

  return response.json();
}

/**
 * Creates a project via PostgREST using the authenticated user's token.
 */
export async function createProject(
  request: APIRequestContext,
  data: {
    template_id: string;
    name: string;
    client_name?: string;
    notes?: string;
  }
): Promise<{ id: string; status: string; [key: string]: unknown }> {
  const response = await request.post(`${SUPABASE_URL}/rest/v1/projects`, {
    data: {
      template_id: data.template_id,
      name: data.name,
      client_name: data.client_name || 'E2E Test Client',
      notes: data.notes || 'Created by E2E test',
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`createProject failed: ${response.status()} ${body}`);
  }

  const result = await response.json();
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Retrieves a project by ID via PostgREST.
 */
export async function getProject(
  request: APIRequestContext,
  id: string
): Promise<{ id: string; status: string; [key: string]: unknown } | null> {
  const response = await request.get(
    `${SUPABASE_URL}/rest/v1/projects?id=eq.${id}&select=*`
  );

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`getProject failed: ${response.status()} ${body}`);
  }

  const result = await response.json();
  return result.length > 0 ? result[0] : null;
}

/**
 * Finalizes a project via the RPC endpoint.
 */
export async function finalize(
  request: APIRequestContext,
  projectId: string
): Promise<{ success: boolean; [key: string]: unknown }> {
  const response = await request.post(
    `${SUPABASE_URL}/rest/v1/rpc/finalize_project`,
    {
      data: { p_project_id: projectId },
    }
  );

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`finalize failed: ${response.status()} ${body}`);
  }

  return response.json();
}
