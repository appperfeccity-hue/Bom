-- ============================================================================
-- Migration: v1.2.2 - Finalization integrity fixes
-- Fixes two defects in finalize_project (originally introduced in v1.1.6):
--   D6 - Client-controlled hash: p_computed_final_hash was stored verbatim.
--         Now compute hash server-side from inserted final_bom_line rows and
--         treat p_computed_final_hash as an assertion (raise on mismatch).
--   D7 - Empty lineage: source_trace was '{}' and source_component_id was NULL.
--         Now populate source_trace with full provenance chain:
--         {snapshot_id, configuration_id, actual_bom_id, actual_bom_line_id,
--          rule_set_id, zone_id}
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Recreate finalize_project with integrity fixes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.finalize_project(
    p_project_id UUID,
    p_user_id UUID,
    p_finalization_key TEXT,
    p_computed_final_hash TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'perfecity'
AS $$
DECLARE
    v_actual_bom_id UUID;
    v_final_bom_id UUID;
    v_lock_key bigint;
    v_existing_final UUID;
    v_project_owner UUID;
    v_snapshot_id UUID;
    v_configuration_id UUID;
    v_rule_set_id UUID;
    v_server_hash TEXT;
    v_canonical_json TEXT;
BEGIN
    -- Authorization: caller must match p_user_id
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Authorization failed: caller identity mismatch';
    END IF;
    -- Authorization: only CONSULTANT role can finalize projects
    IF perfecity.current_user_role() <> 'CONSULTANT' THEN
        RAISE EXCEPTION 'Authorization failed: only CONSULTANT role can finalize projects';
    END IF;

    -- Ownership check: caller must own the project
    SELECT created_by INTO v_project_owner
    FROM perfecity.project WHERE project_id = p_project_id;
    IF v_project_owner IS NULL OR v_project_owner <> p_user_id THEN
        RAISE EXCEPTION 'Authorization failed: caller does not own this project';
    END IF;

    -- Advisory lock to serialize concurrent finalization attempts
    v_lock_key := hashtext('finalize_' || p_project_id);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Idempotency: if final_bom already exists for this project, return it
    SELECT fb.final_bom_id INTO v_existing_final
    FROM perfecity.final_bom fb WHERE fb.project_id = p_project_id;
    IF v_existing_final IS NOT NULL THEN
        RETURN v_existing_final;
    END IF;

    -- Idempotency: check finalization_key
    SELECT final_bom_id INTO v_existing_final
    FROM perfecity.finalization_idempotency WHERE finalization_key = p_finalization_key;
    IF v_existing_final IS NOT NULL THEN
        RETURN v_existing_final;
    END IF;

    -- Get the actual_bom_id from the VALIDATED project
    SELECT current_actual_bom_id INTO v_actual_bom_id
    FROM perfecity.project WHERE project_id = p_project_id AND status = 'VALIDATED'
    FOR UPDATE;
    IF v_actual_bom_id IS NULL THEN
        RAISE EXCEPTION 'Project is not in a valid state for finalization';
    END IF;

    -- Fetch lineage references from actual_bom and project
    SELECT ab.configuration_id, ab.rule_set_id
    INTO v_configuration_id, v_rule_set_id
    FROM perfecity.actual_bom ab
    WHERE ab.actual_bom_id = v_actual_bom_id;

    SELECT p.snapshot_id INTO v_snapshot_id
    FROM perfecity.project p WHERE p.project_id = p_project_id;

    -- Insert final_bom header (temporarily with empty hash; will be replaced below)
    INSERT INTO perfecity.final_bom (project_id, actual_bom_id, final_bom_hash, engine_version, rule_set_id, input_hash, finalized_by)
    SELECT p_project_id, v_actual_bom_id, 'pending', ab.engine_version, ab.rule_set_id, ab.input_hash, p_user_id
    FROM perfecity.actual_bom ab WHERE ab.actual_bom_id = v_actual_bom_id
    RETURNING final_bom_id INTO v_final_bom_id;

    -- Insert final_bom_line rows with proper source_trace (D7 fix)
    PERFORM set_config('perfecity.internal_finalization', 'true', true);
    INSERT INTO perfecity.final_bom_line (
        final_bom_id, actual_bom_line_id, sku_id, sku_code, product_type,
        sku_material, sku_colour, sku_finish, sku_dimensions_json,
        source_zone_id, source_component_id, quantity, required_quantity,
        waste_quantity, unit_of_measure, resolved_dimensions, source_trace
    )
    SELECT
        v_final_bom_id, abl.actual_bom_line_id, abl.sku_id, sm.sku_code, abl.product_type,
        sm.material, sm.colour, sm.finish,
        jsonb_build_object(
            'width_mm', sm.width_mm,
            'height_mm', sm.height_mm,
            'thickness_mm', sm.thickness_mm,
            'depth_mm', sm.depth_mm
        ),
        abl.component_id, abl.component_id,
        abl.quantity, abl.required_quantity, abl.waste_quantity,
        abl.unit_of_measure, abl.resolved_dimensions,
        jsonb_build_object(
            'snapshot_id', v_snapshot_id,
            'configuration_id', v_configuration_id,
            'actual_bom_id', v_actual_bom_id,
            'actual_bom_line_id', abl.actual_bom_line_id,
            'rule_set_id', v_rule_set_id,
            'zone_id', abl.component_id
        )
    FROM perfecity.actual_bom_line abl
    JOIN perfecity.sku_master sm ON sm.sku_id = abl.sku_id
    WHERE abl.actual_bom_id = v_actual_bom_id
    ORDER BY abl.actual_bom_line_id;
    PERFORM set_config('perfecity.internal_finalization', 'false', true);

    -- D6 fix: Compute server-side hash from inserted final_bom_line rows
    -- Canonical JSON: array of line objects ordered by actual_bom_line_id,
    -- each containing the full row data with keys sorted alphabetically.
    SELECT encode(
        sha256(
            convert_to(
                (
                    SELECT string_agg(
                        row_to_json(sub.*)::text, ','
                        ORDER BY sub.actual_bom_line_id
                    )
                    FROM (
                        SELECT fbl.actual_bom_line_id, fbl.sku_id, fbl.sku_code,
                               fbl.product_type, fbl.quantity, fbl.required_quantity,
                               fbl.waste_quantity, fbl.unit_of_measure,
                               fbl.resolved_dimensions, fbl.source_zone_id,
                               fbl.source_trace
                        FROM perfecity.final_bom_line fbl
                        WHERE fbl.final_bom_id = v_final_bom_id
                        ORDER BY fbl.actual_bom_line_id
                    ) sub
                ),
                'UTF8'
            )
        ),
        'hex'
    ) INTO v_server_hash;

    -- Assert: client-computed hash must match server-computed hash
    IF v_server_hash <> p_computed_final_hash THEN
        RAISE EXCEPTION 'Finalization hash mismatch: client hash does not match server-computed hash'
            USING ERRCODE = 'P0002';
    END IF;

    -- Store the server-computed hash (not the client-supplied one)
    UPDATE perfecity.final_bom
    SET final_bom_hash = v_server_hash
    WHERE final_bom_id = v_final_bom_id;

    -- Transition project to FINALIZED
    UPDATE perfecity.project SET status = 'FINALIZED', finalized_at = now()
    WHERE project_id = p_project_id;

    -- Record idempotency key
    IF p_finalization_key IS NOT NULL THEN
        INSERT INTO perfecity.finalization_idempotency (finalization_key, project_id, final_bom_id)
        VALUES (p_finalization_key, p_project_id, v_final_bom_id);
    END IF;

    -- Audit event
    INSERT INTO perfecity.audit_event (event_type, user_id, project_id, payload)
    VALUES ('PROJECT_FINALIZED', p_user_id, p_project_id, jsonb_build_object(
        'final_bom_id', v_final_bom_id,
        'actual_bom_id', v_actual_bom_id,
        'final_bom_hash', v_server_hash
    ));

    RETURN v_final_bom_id;
END;
$$;

-- Revoke from anon/public, grant only to authenticated
REVOKE ALL ON FUNCTION perfecity.finalize_project(UUID, UUID, TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION perfecity.finalize_project(UUID, UUID, TEXT, TEXT) TO authenticated;
