import { APIRequestContext } from '@playwright/test';
import { SUPABASE_URL, SUPABASE_ANON_KEY, RULE_SET_ID } from '../fixtures/seed-data';

/** Generate a unique UUID using the global crypto API (Node 19+). */
function uuid(): string {
  return crypto.randomUUID();
}

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
 * Creates a project via the create_project RPC endpoint.
 *
 * The project table schema uses: project_id, customer_reference, site_reference,
 * template_id, snapshot_id, current_configuration_id, current_actual_bom_id,
 * created_by, status, created_at, updated_at, finalized_at.
 *
 * There is NO name, client_name, or notes column.
 */
export async function createProject(
  request: APIRequestContext,
  data: {
    template_id: string;
    user_id: string;
    idempotency_key?: string;
    snapshot_data?: Record<string, unknown>;
    snapshot_hash?: string;
    rule_set_id?: string;
  }
): Promise<{ project_id: string; status: string; [key: string]: unknown }> {
  const response = await request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_project`,
    {
      headers: {
        'Content-Profile': 'perfecity',
      },
      data: {
        p_template_id: data.template_id,
        p_user_id: data.user_id,
        p_idempotency_key: data.idempotency_key || uuid(),
        p_snapshot_data: data.snapshot_data || { zones: [], version: 1 },
        p_snapshot_hash: data.snapshot_hash || uuid().replace(/-/g, ''),
        p_rule_set_id: data.rule_set_id || RULE_SET_ID,
      },
    }
  );

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`createProject failed: ${response.status()} ${body}`);
  }

  const result = await response.json();
  // RPC returns raw UUID string, wrap it in object for consistent interface
  if (typeof result === 'string') {
    return { project_id: result, status: 'DRAFT' };
  }
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Retrieves a project by ID via PostgREST.
 */
export async function getProject(
  request: APIRequestContext,
  id: string
): Promise<{ project_id: string; status: string; [key: string]: unknown } | null> {
  const response = await request.get(
    `${SUPABASE_URL}/rest/v1/project?project_id=eq.${id}&select=*`
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
      headers: {
        'Content-Profile': 'perfecity',
      },
      data: { p_project_id: projectId },
    }
  );

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`finalize failed: ${response.status()} ${body}`);
  }

  return response.json();
}
