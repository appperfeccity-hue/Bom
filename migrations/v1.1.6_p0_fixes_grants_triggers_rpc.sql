-- ============================================================================
-- PERFECCITY v1.1.6 P0 Fixes: Grants, Function Search Path, RPC Security,
-- Public Legacy Tables
-- PostgreSQL 16.4+, schema 'perfecity'
-- ============================================================================
-- This migration resolves the 4 P0 blockers identified in the P0 test suite:
--   P0-1: Missing table grants for authenticated role
--   P0-2: Mutable function search_path on all 22 functions
--   P0-3: RPC security hardening (create_project, finalize_project)
--   P0-4: Public legacy tables secured with RLS + anon revocation
-- ============================================================================

BEGIN;

-- ============================================================================
-- P0-1: TABLE GRANTS
-- Grant INSERT/UPDATE/DELETE only to authenticated on tables whose RLS policies
-- explicitly permit those operations. Read-only tables get no write grants.
-- ============================================================================

-- Admin CRUD tables (INSERT + UPDATE + DELETE per RLS policy)
GRANT INSERT, UPDATE, DELETE ON perfecity.product_master TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.family_master TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.category_master TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.design_family_master TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.design_subfamily_master TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.sku_master TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.sku_variant TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.sku_compatibility TO authenticated;

-- Catalogue tables: Admin INSERT + UPDATE only (no DELETE policy exists)
GRANT INSERT, UPDATE ON perfecity.catalogue_entry TO authenticated;
GRANT INSERT, UPDATE ON perfecity.catalogue_asset TO authenticated;
GRANT INSERT, UPDATE ON perfecity.catalogue_asset_metadata TO authenticated;

-- Rule set: Admin INSERT + UPDATE only (no DELETE policy)
GRANT INSERT, UPDATE ON perfecity.rule_set TO authenticated;

-- Template: Designer/Admin INSERT + UPDATE + DELETE
GRANT INSERT, UPDATE, DELETE ON perfecity.template TO authenticated;

-- Template child tables: Designer/Admin full CRUD
GRANT INSERT, UPDATE, DELETE ON perfecity.template_zone TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.template_zone_sku TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.template_zone_alternative TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.template_lighting TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.template_furniture TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.template_trim TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.template_hidden_component TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.template_consultant_permission TO authenticated;

-- Master BOM: Designer UPDATE + Admin INSERT/UPDATE (no DELETE policy)
GRANT INSERT, UPDATE ON perfecity.master_bom TO authenticated;
GRANT INSERT, UPDATE ON perfecity.master_bom_line TO authenticated;

-- Project: Consultant INSERT + UPDATE
GRANT INSERT, UPDATE ON perfecity.project TO authenticated;

-- Project child tables: Consultant INSERT + UPDATE
GRANT INSERT, UPDATE ON perfecity.project_configuration TO authenticated;
GRANT INSERT, UPDATE ON perfecity.project_measurement TO authenticated;

-- Project idempotency: INSERT only (written by create_project RPC)
GRANT INSERT ON perfecity.project_idempotency TO authenticated;

-- Amendment 001 tables (ensure they have grants too)
GRANT INSERT, UPDATE, DELETE ON perfecity.template_wall_configuration TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.project_wall_configuration TO authenticated;
GRANT INSERT, UPDATE, DELETE ON perfecity.project_obstruction TO authenticated;
GRANT INSERT ON perfecity.generated_panel_frame TO authenticated;

-- READ-ONLY tables: NO write grants (audit_event, final_bom, final_bom_line,
-- finalization_idempotency, actual_bom, actual_bom_line, project_snapshot)
-- These are written only by service_role (bypasses RLS)

-- Revoke anon access to perfecity schema
REVOKE USAGE ON SCHEMA perfecity FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA perfecity FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA perfecity FROM anon;
REVOKE EXECUTE ON FUNCTION perfecity.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION perfecity.current_user_role() FROM public;


-- ============================================================================
-- P0-2: FUNCTION SEARCH PATH HARDENING
-- Recreate ALL 22 functions with SET search_path = 'perfecity'.
-- The 3 confirmed broken functions also get explicit perfecity.<table>
-- qualification in the body.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.1 set_internal_revalidation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.set_internal_revalidation()
RETURNS void
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    PERFORM set_config('perfecity.internal_revalidation', 'true', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.2 revalidate_catalogue_entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.revalidate_catalogue_entry(entry_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
DECLARE
    sku_status TEXT;
    geom_ok    boolean;
    pat_ok     boolean := true;
    render_ok  boolean;
    dim_ok     boolean := true;
    sku        record;
    current_status TEXT;
BEGIN
    SELECT s.status, s.width_mm, s.height_mm, s.pattern_identity
    INTO sku
    FROM catalogue_entry ce
    JOIN sku_master s ON s.sku_id = ce.sku_id
    WHERE ce.catalogue_entry_id = entry_id;

    IF sku.status <> 'ACTIVE' THEN
        current_status := 'INCOMPLETE';
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM catalogue_asset
            WHERE catalogue_entry_id = entry_id AND asset_type = 'GEOMETRY'
              AND is_current AND status = 'VALID' AND content_hash IS NOT NULL
        ) INTO geom_ok;
        SELECT EXISTS (
            SELECT 1 FROM catalogue_asset
            WHERE catalogue_entry_id = entry_id AND asset_type = 'RENDER'
              AND is_current AND status = 'VALID' AND content_hash IS NOT NULL
        ) INTO render_ok;
        IF sku.pattern_identity IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM catalogue_asset
                WHERE catalogue_entry_id = entry_id AND asset_type = 'PATTERN'
                  AND is_current AND status = 'VALID' AND content_hash IS NOT NULL
            ) INTO pat_ok;
        END IF;

        IF geom_ok AND render_ok AND pat_ok THEN
            IF sku.width_mm IS NOT NULL AND sku.height_mm IS NOT NULL THEN
                SELECT (m.validated_width_mm IS NOT NULL AND m.validated_height_mm IS NOT NULL
                        AND ABS(m.validated_width_mm - sku.width_mm) <= 0.5
                        AND ABS(m.validated_height_mm - sku.height_mm) <= 0.5)
                INTO dim_ok
                FROM catalogue_asset a
                JOIN catalogue_asset_metadata m ON m.asset_id = a.asset_id
                WHERE a.catalogue_entry_id = entry_id AND a.asset_type = 'GEOMETRY' AND a.is_current;
                IF dim_ok IS NULL THEN dim_ok := false; END IF;
            END IF;
        END IF;

        IF geom_ok AND render_ok AND pat_ok AND dim_ok THEN
            current_status := 'READY';
        ELSE
            current_status := 'INCOMPLETE';
        END IF;
    END IF;

    PERFORM perfecity.set_internal_revalidation();
    UPDATE catalogue_entry
    SET status = current_status, updated_at = now()
    WHERE catalogue_entry_id = entry_id AND status <> current_status;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.3 trg_asset_changed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.trg_asset_changed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
DECLARE
    v_entry_id UUID;
BEGIN
    v_entry_id := COALESCE(NEW.catalogue_entry_id, OLD.catalogue_entry_id);
    PERFORM perfecity.revalidate_catalogue_entry(v_entry_id);

    IF TG_OP = 'UPDATE' AND OLD.catalogue_entry_id IS DISTINCT FROM NEW.catalogue_entry_id THEN
        PERFORM perfecity.revalidate_catalogue_entry(OLD.catalogue_entry_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.4 trg_asset_metadata_changed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.trg_asset_metadata_changed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
DECLARE
    v_entry_id UUID;
BEGIN
    SELECT ca.catalogue_entry_id INTO v_entry_id
    FROM catalogue_asset ca WHERE ca.asset_id = COALESCE(NEW.asset_id, OLD.asset_id);
    PERFORM perfecity.revalidate_catalogue_entry(v_entry_id);
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.5 trg_sku_master_catalogue_revalidate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.trg_sku_master_catalogue_revalidate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.width_mm IS DISTINCT FROM NEW.width_mm
       OR OLD.height_mm IS DISTINCT FROM NEW.height_mm
       OR OLD.pattern_identity IS DISTINCT FROM NEW.pattern_identity
    THEN
        PERFORM perfecity.revalidate_catalogue_entry(
            (SELECT catalogue_entry_id FROM catalogue_entry WHERE sku_id = NEW.sku_id)
        );
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.6 trg_catalogue_entry_status_guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.trg_catalogue_entry_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF current_setting('perfecity.internal_revalidation', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Direct modification of catalogue_entry.status is not allowed';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.7 validate_asset_metadata
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.validate_asset_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
DECLARE
    v_asset_type TEXT;
BEGIN
    SELECT asset_type INTO v_asset_type FROM catalogue_asset WHERE asset_id = NEW.asset_id;
    IF v_asset_type = 'GEOMETRY' AND (NEW.validated_width_mm IS NULL OR NEW.validated_height_mm IS NULL) THEN
        RAISE EXCEPTION 'Geometry asset % requires validated width and height', NEW.asset_id;
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.8 demote_active_template_on_child_change (BROKEN - needs explicit qualification)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.demote_active_template_on_child_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
DECLARE
    v_old_template UUID;
    v_new_template UUID;
    v_status       TEXT;
BEGIN
    IF TG_TABLE_NAME IN ('template_zone','template_lighting','template_furniture','template_trim','template_hidden_component','template_consultant_permission') THEN
        IF TG_OP = 'DELETE' THEN
            v_old_template := OLD.template_id;
        ELSIF TG_OP = 'UPDATE' THEN
            v_old_template := OLD.template_id;
            v_new_template := NEW.template_id;
        ELSE
            v_new_template := NEW.template_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'template_zone_sku' THEN
        IF TG_OP IN ('DELETE','UPDATE') THEN
            SELECT tz.template_id INTO v_old_template FROM perfecity.template_zone tz WHERE tz.zone_id = OLD.zone_id;
        END IF;
        IF TG_OP IN ('INSERT','UPDATE') THEN
            SELECT tz.template_id INTO v_new_template FROM perfecity.template_zone tz WHERE tz.zone_id = NEW.zone_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'template_zone_alternative' THEN
        IF TG_OP IN ('DELETE','UPDATE') THEN
            SELECT tz.template_id INTO v_old_template FROM perfecity.template_zone tz WHERE tz.zone_id = OLD.template_zone_id;
        END IF;
        IF TG_OP IN ('INSERT','UPDATE') THEN
            SELECT tz.template_id INTO v_new_template FROM perfecity.template_zone tz WHERE tz.zone_id = NEW.template_zone_id;
        END IF;
    END IF;

    IF v_old_template IS NOT NULL THEN
        SELECT status INTO v_status FROM perfecity.template WHERE template_id = v_old_template FOR UPDATE;
        IF v_status = 'ACTIVE' THEN
            UPDATE perfecity.template SET status = 'DRAFT', updated_at = now() WHERE template_id = v_old_template;
        END IF;
    END IF;

    IF v_new_template IS NOT NULL AND v_new_template IS DISTINCT FROM v_old_template THEN
        SELECT status INTO v_status FROM perfecity.template WHERE template_id = v_new_template FOR UPDATE;
        IF v_status = 'ACTIVE' THEN
            UPDATE perfecity.template SET status = 'DRAFT', updated_at = now() WHERE template_id = v_new_template;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.9 trg_template_structural_change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.trg_template_structural_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    IF OLD.status = 'ACTIVE' THEN
        IF NEW.design_family_id IS DISTINCT FROM OLD.design_family_id
           OR NEW.design_subfamily_id IS DISTINCT FROM OLD.design_subfamily_id
           OR NEW.wall_application IS DISTINCT FROM OLD.wall_application
           OR NEW.wall_geometry IS DISTINCT FROM OLD.wall_geometry
           OR NEW.adaptation_strategy IS DISTINCT FROM OLD.adaptation_strategy
           OR NEW.priority_zone_id IS DISTINCT FROM OLD.priority_zone_id
           OR NEW.waste_factor IS DISTINCT FROM OLD.waste_factor
           OR NEW.metadata IS DISTINCT FROM OLD.metadata
        THEN
            NEW.status := 'DRAFT';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.10 check_template_eligible
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.check_template_eligible(tmpl_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
DECLARE
    ineligible_skus integer;
BEGIN
    SELECT count(*) INTO ineligible_skus
    FROM template_zone tz
    JOIN template_zone_sku tzs ON tzs.zone_id = tz.zone_id AND tzs.is_primary
    LEFT JOIN sku_master s ON s.sku_id = tzs.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tz.template_id = tmpl_id AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_zone tz
    JOIN template_zone_alternative tza ON tza.template_zone_id = tz.zone_id
    LEFT JOIN sku_master s ON s.sku_id = tza.alternative_sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tz.template_id = tmpl_id AND tza.status = 'ACTIVE'
      AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_lighting tl
    LEFT JOIN sku_master s ON s.sku_id = tl.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tl.template_id = tmpl_id AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_furniture tf
    LEFT JOIN sku_master s ON s.sku_id = tf.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tf.template_id = tmpl_id AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_trim tt
    LEFT JOIN sku_master s ON s.sku_id = tt.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE tt.template_id = tmpl_id AND tt.sku_id IS NOT NULL
      AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    SELECT count(*) INTO ineligible_skus
    FROM template_hidden_component thc
    LEFT JOIN sku_master s ON s.sku_id = thc.sku_id AND s.status = 'ACTIVE'
    LEFT JOIN catalogue_entry ce ON ce.sku_id = s.sku_id AND ce.status = 'READY'
    WHERE thc.template_id = tmpl_id AND thc.mandatory
      AND (s.sku_id IS NULL OR ce.sku_id IS NULL);
    IF ineligible_skus > 0 THEN RETURN false; END IF;

    IF NOT EXISTS (SELECT 1 FROM master_bom WHERE template_id = tmpl_id AND status = 'APPROVED') THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.11 trg_template_activate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.trg_template_activate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    IF NEW.status = 'ACTIVE' THEN
        IF NOT perfecity.check_template_eligible(NEW.template_id) THEN
            RAISE EXCEPTION 'Template % does not meet activation criteria', NEW.template_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.12 supersede_actual_bom
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.supersede_actual_bom()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    IF NEW.status = 'VALIDATED' THEN
        PERFORM 1 FROM project WHERE project_id = NEW.project_id FOR UPDATE;

        UPDATE actual_bom
        SET status = 'SUPERSEDED'
        WHERE project_id = NEW.project_id
          AND status = 'VALIDATED'
          AND actual_bom_id <> NEW.actual_bom_id;

        UPDATE project
        SET current_actual_bom_id = NEW.actual_bom_id,
            status = CASE WHEN status = 'CONFIGURED' THEN 'VALIDATED' ELSE status END,
            updated_at = now()
        WHERE project_id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.13 trg_actual_bom_project_consistency (BROKEN - needs explicit qualification)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.trg_actual_bom_project_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
DECLARE
    snap_project UUID;
    conf_project UUID;
BEGIN
    SELECT project_id INTO snap_project FROM perfecity.project_snapshot WHERE snapshot_id = NEW.snapshot_id;
    IF snap_project IS DISTINCT FROM NEW.project_id THEN
        RAISE EXCEPTION 'Actual BOM snapshot must belong to the same project';
    END IF;
    SELECT project_id INTO conf_project FROM perfecity.project_configuration WHERE configuration_id = NEW.configuration_id;
    IF conf_project IS DISTINCT FROM NEW.project_id THEN
        RAISE EXCEPTION 'Actual BOM configuration must belong to the same project';
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.14 trg_snapshot_template_match (BROKEN - needs explicit qualification)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.trg_snapshot_template_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
DECLARE
    proj_template UUID;
BEGIN
    SELECT template_id INTO proj_template FROM perfecity.project WHERE project_id = NEW.project_id;
    IF proj_template IS NOT NULL AND NEW.template_id <> proj_template THEN
        RAISE EXCEPTION 'Snapshot template_id must match project.template_id';
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.15 prevent_snapshot_modification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.prevent_snapshot_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    RAISE EXCEPTION 'Project snapshot is immutable';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.16 prevent_final_bom_modification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.prevent_final_bom_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    RAISE EXCEPTION 'Final BOM is immutable';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.17 prevent_final_bom_line_modification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.prevent_final_bom_line_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF current_setting('perfecity.internal_finalization', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Cannot insert into final_bom_line outside finalization transaction';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Final BOM line is immutable';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.18 prevent_actual_bom_modification_after_final
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.prevent_actual_bom_modification_after_final()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM final_bom WHERE actual_bom_id = OLD.actual_bom_id) THEN
        RAISE EXCEPTION 'Actual BOM is frozen because a Final BOM references it';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.19 prevent_audit_modification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.prevent_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are append-only';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2.20 invalidate_bom_on_measurement_change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.invalidate_bom_on_measurement_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'perfecity'
AS $$
BEGIN
  PERFORM 1 FROM project WHERE project_id = NEW.project_id FOR UPDATE;

  UPDATE actual_bom
     SET status = 'SUPERSEDED'
   WHERE project_id = NEW.project_id
     AND status = 'VALIDATED';

  UPDATE project
     SET current_actual_bom_id = NULL,
         status = 'CONFIGURED',
         updated_at = now()
   WHERE project_id = NEW.project_id
     AND status = 'VALIDATED';

  RETURN NEW;
END;
$$;


-- ============================================================================
-- P0-3: RPC SECURITY
-- create_project and finalize_project are intended to be callable by
-- authenticated clients. They use SECURITY DEFINER to bypass RLS for
-- cross-table operations, but enforce authorization inside the function body.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2.21 create_project - SECURITY DEFINER with auth + role checks
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
-- 2.22 finalize_project - SECURITY DEFINER with auth + ownership checks
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

    v_lock_key := hashtext('finalize_' || p_project_id);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT fb.final_bom_id INTO v_existing_final
    FROM perfecity.final_bom fb WHERE fb.project_id = p_project_id;
    IF v_existing_final IS NOT NULL THEN
        RETURN v_existing_final;
    END IF;

    SELECT final_bom_id INTO v_existing_final
    FROM perfecity.finalization_idempotency WHERE finalization_key = p_finalization_key;
    IF v_existing_final IS NOT NULL THEN
        RETURN v_existing_final;
    END IF;

    SELECT current_actual_bom_id INTO v_actual_bom_id
    FROM perfecity.project WHERE project_id = p_project_id AND status = 'VALIDATED'
    FOR UPDATE;
    IF v_actual_bom_id IS NULL THEN
        RAISE EXCEPTION 'Project is not in a valid state for finalization';
    END IF;

    INSERT INTO perfecity.final_bom (project_id, actual_bom_id, final_bom_hash, engine_version, rule_set_id, input_hash, finalized_by)
    SELECT p_project_id, v_actual_bom_id, p_computed_final_hash, ab.engine_version, ab.rule_set_id, ab.input_hash, p_user_id
    FROM perfecity.actual_bom ab WHERE ab.actual_bom_id = v_actual_bom_id
    RETURNING final_bom_id INTO v_final_bom_id;

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
        abl.component_id, NULL,
        abl.quantity, abl.required_quantity, abl.waste_quantity,
        abl.unit_of_measure, abl.resolved_dimensions, '{}'::jsonb
    FROM perfecity.actual_bom_line abl
    JOIN perfecity.sku_master sm ON sm.sku_id = abl.sku_id
    WHERE abl.actual_bom_id = v_actual_bom_id;
    PERFORM set_config('perfecity.internal_finalization', 'false', true);

    UPDATE perfecity.project SET status = 'FINALIZED', finalized_at = now()
    WHERE project_id = p_project_id;

    IF p_finalization_key IS NOT NULL THEN
        INSERT INTO perfecity.finalization_idempotency (finalization_key, project_id, final_bom_id)
        VALUES (p_finalization_key, p_project_id, v_final_bom_id);
    END IF;

    RETURN v_final_bom_id;
END;
$$;

-- Revoke from anon/public, grant only to authenticated
REVOKE ALL ON FUNCTION perfecity.finalize_project(UUID, UUID, TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION perfecity.finalize_project(UUID, UUID, TEXT, TEXT) TO authenticated;


-- ============================================================================
-- P0-4: PUBLIC LEGACY TABLES
-- Enable RLS on all public schema tables (excluding internal Supabase tables),
-- revoke anon and authenticated write access. These tables are legacy and
-- should not be writable via the API.
-- ============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT IN ('schema_migrations', 'supabase_migrations')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.tablename);
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', r.tablename);
    END LOOP;
END;
$$;

COMMIT;
