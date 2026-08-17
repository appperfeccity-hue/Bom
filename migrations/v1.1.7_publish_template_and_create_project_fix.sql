-- ===========================================================================
-- Migration v1.1.7 — Design Library security fixes
-- ===========================================================================
-- P0: Fix Consultant selection authorization in create_project.
--     A direct RPC/API caller must not be able to select a Template whose
--     dependencies are unavailable. We revalidate eligibility server-side via
--     check_template_eligible() rather than trusting the Design Library query.
--
-- P1: Add a server-side publish_template RPC that atomically validates all
--     publication gates (auth, DESIGNER role, ownership, DRAFT status, and
--     full dependency eligibility) before flipping status to ACTIVE. All
--     validation runs inside the single function transaction, so any failure
--     rolls back and the Template cannot become ACTIVE.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- P0: create_project — add server-side eligibility revalidation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.create_project(
    p_template_id UUID,
    p_user_id UUID,
    p_idempotency_key TEXT,
    p_snapshot_data JSONB,
    p_snapshot_hash TEXT,
    p_rule_set_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'perfecity'
AS $$
DECLARE
    v_lock_key bigint;
    v_project_id UUID;
    v_snapshot_id UUID;
    existing_id UUID;
BEGIN
    -- Authorization: caller must match p_user_id
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Authorization failed: caller identity mismatch';
    END IF;
    -- Authorization: only CONSULTANT role can create projects
    IF perfecity.current_user_role() <> 'CONSULTANT' THEN
        RAISE EXCEPTION 'Authorization failed: only CONSULTANT role can create projects';
    END IF;
    -- Validate: template must be ACTIVE
    IF NOT EXISTS (
        SELECT 1 FROM perfecity.template
        WHERE template_id = p_template_id AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'Template is not active or does not exist';
    END IF;
    -- Validate: template dependencies must be available (server-side revalidation).
    -- Prevents a direct RPC/API call from selecting a blocked Template even if
    -- it is nominally ACTIVE but its SKU chains / master BOM are not ready.
    IF NOT perfecity.check_template_eligible(p_template_id) THEN
        RAISE EXCEPTION 'Template dependencies are not available';
    END IF;

    v_lock_key := hashtext(p_idempotency_key);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT project_id INTO existing_id FROM perfecity.project_idempotency WHERE idempotency_key = p_idempotency_key;
    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;

    INSERT INTO perfecity.project (template_id, created_by, status)
    VALUES (p_template_id, p_user_id, 'DRAFT')
    RETURNING project_id INTO v_project_id;

    INSERT INTO perfecity.project_snapshot (project_id, template_id, snapshot_data, snapshot_hash, rule_set_id)
    VALUES (v_project_id, p_template_id, p_snapshot_data, p_snapshot_hash, p_rule_set_id)
    RETURNING snapshot_id INTO v_snapshot_id;

    UPDATE perfecity.project SET snapshot_id = v_snapshot_id WHERE project_id = v_project_id;

    INSERT INTO perfecity.project_idempotency (idempotency_key, project_id) VALUES (p_idempotency_key, v_project_id);

    RETURN v_project_id;
END;
$$;

-- Revoke from anon/public, grant only to authenticated
REVOKE ALL ON FUNCTION perfecity.create_project(UUID, UUID, TEXT, JSONB, TEXT, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION perfecity.create_project(UUID, UUID, TEXT, JSONB, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- P1: publish_template — atomic server-side publication of a DRAFT template
-- ---------------------------------------------------------------------------
-- All validation gates run inside this single transaction. Any RAISE aborts
-- the transaction and rolls back, so an invalid Template can never become
-- ACTIVE. The eligibility check (check_template_eligible) revalidates every
-- dependency chain and requires master_bom = APPROVED.
CREATE OR REPLACE FUNCTION perfecity.publish_template(
    p_template_id UUID,
    p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'perfecity'
AS $$
DECLARE
    v_status TEXT;
    v_owner UUID;
BEGIN
    -- Authorization: caller must match p_user_id
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Authorization failed: caller identity mismatch';
    END IF;
    -- Authorization: only DESIGNER role can publish templates
    IF perfecity.current_user_role() <> 'DESIGNER' THEN
        RAISE EXCEPTION 'Authorization failed: only DESIGNER role can publish templates';
    END IF;

    -- Ownership + status gate: lock the row to revalidate before committing.
    -- Only a DRAFT template owned by the caller may be published.
    SELECT created_by, status INTO v_owner, v_status
    FROM perfecity.template
    WHERE template_id = p_template_id
    FOR UPDATE;

    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'Template does not exist';
    END IF;
    IF v_owner <> p_user_id THEN
        RAISE EXCEPTION 'Authorization failed: caller does not own this template';
    END IF;
    IF v_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Template cannot be published: status is % (only DRAFT can be published)', v_status;
    END IF;

    -- Publication gate: revalidate all dependency chains and master BOM approval.
    IF NOT perfecity.check_template_eligible(p_template_id) THEN
        RAISE EXCEPTION 'Template % cannot be published: dependencies are not available (SKU chains not ACTIVE/READY or master BOM not APPROVED)', p_template_id;
    END IF;

    -- Commit: flip to ACTIVE only after every gate passes.
    UPDATE perfecity.template
    SET status = 'ACTIVE'
    WHERE template_id = p_template_id;

    RETURN p_template_id;
END;
$$;

-- Revoke from anon/public, grant only to authenticated
REVOKE ALL ON FUNCTION perfecity.publish_template(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION perfecity.publish_template(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- P1: Tighten Consultant RLS on perfecity.template
-- ---------------------------------------------------------------------------
-- Replace the overly permissive template_select_authenticated policy
-- (USING(true) for all authenticated users) with role-specific SELECT policies.
-- CONSULTANT can only see ACTIVE templates, preventing exposure of DRAFT/RETIRED
-- metadata via direct API/RPC calls. DESIGNER and ADMIN see all templates.
-- ---------------------------------------------------------------------------

-- Drop the old permissive policy
DROP POLICY IF EXISTS template_select_authenticated ON perfecity.template;

-- CONSULTANT: can only SELECT templates with status = 'ACTIVE'
CREATE POLICY template_select_consultant
    ON perfecity.template
    FOR SELECT
    TO authenticated
    USING (perfecity.current_user_role() = 'CONSULTANT' AND status = 'ACTIVE');

-- DESIGNER: can SELECT all templates (needs visibility into DRAFT/BLOCKED)
CREATE POLICY template_select_designer
    ON perfecity.template
    FOR SELECT
    TO authenticated
    USING (perfecity.current_user_role() = 'DESIGNER');

-- ADMIN: can SELECT all templates
CREATE POLICY template_select_admin
    ON perfecity.template
    FOR SELECT
    TO authenticated
    USING (perfecity.current_user_role() = 'ADMIN');
