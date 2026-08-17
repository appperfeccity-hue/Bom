-- ===========================================================================
-- Migration v1.1.8 — Server-side project snapshot (Phase 1)
-- ===========================================================================
-- The Project Snapshot is the immutable execution boundary of the whole
-- architecture, but until now its contents were built in the browser and
-- passed into create_project() as p_snapshot_data / p_snapshot_hash, with the
-- rule set supplied by the client as well. That made the boundary advisory:
-- a client could freeze any payload it liked (or, as the shipped frontend
-- does, one that omits alternatives, hidden components, consultant
-- permissions, compatibility and the rule set entirely).
--
-- This migration moves snapshot construction, canonicalisation and hashing
-- into the database:
--
--   canonical_jsonb(snapshot) -> canonical JSON text -> SHA-256 -> snapshot_hash
--
--   * perfecity.canonical_jsonb(JSONB)              - deterministic key order
--   * perfecity.build_template_snapshot(UUID, UUID) - snapshot_version 2
--   * perfecity.create_project(...)                 - new 5-argument form
--
-- Legacy projects are untouched: snapshots written by the old client have no
-- snapshot_version key and are read as version 1 by the frontend's legacy
-- mapper. No historical snapshot_data is rewritten.
--
-- Note on hashing: pgcrypto's digest() lives in the "extensions" schema on
-- Supabase and is therefore unreachable under SET search_path='perfecity',
-- so the core pg_catalog.sha256(bytea) function is used instead.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. canonical_jsonb — deterministic key ordering at every nesting level
-- ---------------------------------------------------------------------------
-- jsonb already normalises key order internally, but the hash contract must be
-- explicit and reproducible outside Postgres, so the canonical form is defined
-- here: object keys ascending by name, array order preserved, scalars as-is.
-- This mirrors sortKeysDeep() in frontend/src/lib/snapshotBuilder.ts.
CREATE OR REPLACE FUNCTION perfecity.canonical_jsonb(p_value JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = 'perfecity'
AS $$
    SELECT CASE jsonb_typeof(p_value)
        WHEN 'object' THEN COALESCE(
            (SELECT jsonb_object_agg(key, perfecity.canonical_jsonb(value) ORDER BY key)
             FROM jsonb_each(p_value)),
            '{}'::jsonb)
        WHEN 'array' THEN COALESCE(
            (SELECT jsonb_agg(perfecity.canonical_jsonb(value) ORDER BY ordinality)
             FROM jsonb_array_elements(p_value) WITH ORDINALITY),
            '[]'::jsonb)
        ELSE p_value
    END;
$$;

COMMENT ON FUNCTION perfecity.canonical_jsonb(JSONB) IS
    'Canonical JSONB form used as the input to snapshot/BOM hashing: object keys sorted ascending, array order preserved.';

-- ---------------------------------------------------------------------------
-- 2. snapshot_hash — single definition of the hash contract
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.snapshot_hash(p_snapshot JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = 'perfecity'
AS $$
    SELECT encode(
        pg_catalog.sha256(convert_to(perfecity.canonical_jsonb(p_snapshot)::text, 'UTF8')),
        'hex');
$$;

-- ---------------------------------------------------------------------------
-- 3. snapshot_sku — one frozen SKU representation, used everywhere above
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.snapshot_sku(p_sku_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'perfecity'
AS $$
    SELECT jsonb_build_object(
        'sku_id',         sm.sku_id,
        'sku_code',       sm.sku_code,
        'product_type',   sm.product_type,
        'family_id',      sm.family_id,
        'category_id',    sm.category_id,
        'width_mm',       sm.width_mm,
        'height_mm',      sm.height_mm,
        'thickness_mm',   sm.thickness_mm,
        'depth_mm',       sm.depth_mm,
        'unit_length_mm', sm.unit_length_mm,
        'material',       sm.material,
        'colour',         sm.colour,
        'finish',         sm.finish,
        'pattern_identity', sm.pattern_identity,
        'gh_mm',          sm.gh_mm,
        'gv_mm',          sm.gv_mm,
        'quantity_mode',  sm.quantity_mode,
        'commercial_attributes', sm.commercial_attributes,
        'status',         sm.status,
        'created_by',     sm.created_by,
        'created_at',     sm.created_at,
        'updated_at',     sm.updated_at)
    FROM perfecity.sku_master sm WHERE sm.sku_id = p_sku_id;
$$;

-- ---------------------------------------------------------------------------
-- 4. build_template_snapshot — the frozen execution baseline (version 2)
-- ---------------------------------------------------------------------------
-- Everything the BOM pipeline is allowed to read about the design must be in
-- here, because after create_project() returns, no calculation may touch a
-- live template_* row: template geometry, zones with their primary SKU and
-- the alternatives a consultant may substitute, lighting, furniture, trims,
-- hidden components, consultant permissions, the template wall configuration,
-- the SKU compatibility rules restricted to this template's SKU set, and the
-- resolved rule set with its constants.
--
-- Project-scoped data (project wall configuration, obstructions, generated
-- panel frames) is deliberately NOT part of the snapshot: it is site reality,
-- lives in project_* tables, and panel frames are always recomputed from
-- inputs by the engine.
CREATE OR REPLACE FUNCTION perfecity.build_template_snapshot(
    p_template_id UUID,
    p_rule_set_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'perfecity'
AS $$
DECLARE
    v_template     perfecity.template%ROWTYPE;
    v_rule_set     perfecity.rule_set%ROWTYPE;
    v_sku_ids      UUID[];
    v_snapshot     JSONB;
BEGIN
    SELECT * INTO v_template FROM perfecity.template WHERE template_id = p_template_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % does not exist', p_template_id;
    END IF;

    SELECT * INTO v_rule_set FROM perfecity.rule_set WHERE rule_set_id = p_rule_set_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rule set % does not exist', p_rule_set_id;
    END IF;

    -- Every SKU this template can ever reference, primary and alternative
    -- alike; used to freeze the relevant slice of sku_compatibility.
    SELECT array_agg(DISTINCT sku_id) INTO v_sku_ids FROM (
        SELECT tzs.sku_id
          FROM perfecity.template_zone tz
          JOIN perfecity.template_zone_sku tzs ON tzs.zone_id = tz.zone_id
         WHERE tz.template_id = p_template_id
        UNION
        SELECT tza.alternative_sku_id
          FROM perfecity.template_zone tz
          JOIN perfecity.template_zone_alternative tza ON tza.template_zone_id = tz.zone_id
         WHERE tz.template_id = p_template_id AND tza.status = 'ACTIVE'
        UNION SELECT tl.sku_id FROM perfecity.template_lighting tl WHERE tl.template_id = p_template_id
        UNION SELECT tf.sku_id FROM perfecity.template_furniture tf WHERE tf.template_id = p_template_id
        UNION SELECT tt.sku_id FROM perfecity.template_trim tt WHERE tt.template_id = p_template_id AND tt.sku_id IS NOT NULL
        UNION SELECT thc.sku_id FROM perfecity.template_hidden_component thc WHERE thc.template_id = p_template_id
    ) s;
    v_sku_ids := COALESCE(v_sku_ids, ARRAY[]::UUID[]);

    SELECT jsonb_build_object(
        'snapshot_version', 2,
        'template', jsonb_build_object(
            'template_id',         v_template.template_id,
            'name',                v_template.name,
            'description',         v_template.description,
            'design_family_id',    v_template.design_family_id,
            'design_subfamily_id', v_template.design_subfamily_id,
            'wall_application',    v_template.wall_application,
            'adaptation_strategy', v_template.adaptation_strategy,
            'priority_zone_id',    v_template.priority_zone_id,
            'waste_factor',        v_template.waste_factor,
            'metadata',            v_template.metadata,
            'status',              v_template.status,
            'wall_geometry',       v_template.wall_geometry,
            'created_by',          v_template.created_by,
            'created_at',          v_template.created_at,
            'updated_at',          v_template.updated_at
        ),
        'wall_geometry', v_template.wall_geometry,
        'base_dimensions', jsonb_build_object(
            'width_mm',  (v_template.wall_geometry ->> 'base_width_mm')::numeric,
            'height_mm', (v_template.wall_geometry ->> 'base_height_mm')::numeric
        ),
        'zones', (
            SELECT COALESCE(jsonb_agg(z ORDER BY z -> 'x_mm', z -> 'y_mm', z ->> 'zone_id'), '[]'::jsonb)
            FROM (
                SELECT jsonb_build_object(
                    'zone_id',           tz.zone_id,
                    'template_id',       tz.template_id,
                    'created_at',        tz.created_at,
                    'segment',           tz.segment,
                    'x_mm',              tz.x_mm,
                    'y_mm',              tz.y_mm,
                    'width_mm',          tz.width_mm,
                    'height_mm',         tz.height_mm,
                    'width_strategy',    tz.width_strategy,
                    'height_strategy',   tz.height_strategy,
                    'position_strategy', tz.position_strategy,
                    'primary_sku',       perfecity.snapshot_sku(primary_sku.sku_id),
                    'alternatives', (
                        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                   'alternative_id', tza.alternative_id,
                                   'display_order',  tza.display_order,
                                   'reason',         tza.reason,
                                   'sku',            perfecity.snapshot_sku(tza.alternative_sku_id))
                               ORDER BY tza.display_order, tza.alternative_id), '[]'::jsonb)
                        FROM perfecity.template_zone_alternative tza
                        WHERE tza.template_zone_id = tz.zone_id AND tza.status = 'ACTIVE'
                    )
                ) AS z
                FROM perfecity.template_zone tz
                LEFT JOIN perfecity.template_zone_sku primary_sku
                       ON primary_sku.zone_id = tz.zone_id AND primary_sku.is_primary
                WHERE tz.template_id = p_template_id
            ) zones
        ),
        'lighting', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'lighting_id',    tl.lighting_id,
                       'sku_id',         tl.sku_id,
                       'edge_selection', tl.edge_selection,
                       'mounting_type',  tl.mounting_type,
                       'quantity_rule',  tl.quantity_rule,
                       'sku',            perfecity.snapshot_sku(tl.sku_id))
                   ORDER BY tl.lighting_id), '[]'::jsonb)
            FROM perfecity.template_lighting tl WHERE tl.template_id = p_template_id
        ),
        'furniture', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'furniture_id',  tf.furniture_id,
                       'sku_id',        tf.sku_id,
                       'position_x_mm', tf.position_x_mm,
                       'position_y_mm', tf.position_y_mm,
                       'orientation',   tf.orientation,
                       'sku',           perfecity.snapshot_sku(tf.sku_id))
                   ORDER BY tf.furniture_id), '[]'::jsonb)
            FROM perfecity.template_furniture tf WHERE tf.template_id = p_template_id
        ),
        'trims', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'trim_id',        tt.trim_id,
                       'sku_id',         tt.sku_id,
                       'trim_type',      tt.trim_type,
                       'quantity_rule',  tt.quantity_rule,
                       'fixed_quantity', tt.fixed_quantity,
                       'sku',            perfecity.snapshot_sku(tt.sku_id))
                   ORDER BY tt.trim_id), '[]'::jsonb)
            FROM perfecity.template_trim tt WHERE tt.template_id = p_template_id
        ),
        'hidden_components', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'hidden_component_id', thc.hidden_component_id,
                       'sku_id',              thc.sku_id,
                       'classification',      thc.classification,
                       'trigger_type',        thc.trigger_type,
                       'trigger_condition',   thc.trigger_condition,
                       'quantity_rule',       thc.quantity_rule,
                       'quantity_parameters', thc.quantity_parameters,
                       'parent_component_id', thc.parent_component_id,
                       'mandatory',           thc.mandatory,
                       'sku',                 perfecity.snapshot_sku(thc.sku_id))
                   ORDER BY thc.hidden_component_id), '[]'::jsonb)
            FROM perfecity.template_hidden_component thc WHERE thc.template_id = p_template_id
        ),
        'consultant_permissions', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'permission_id',       tcp.permission_id,
                       'parameter_key',       tcp.parameter_key,
                       'parameter_type',      tcp.parameter_type,
                       'edit_mode',           tcp.edit_mode,
                       'min_value',           tcp.min_value,
                       'max_value',           tcp.max_value,
                       'allowed_values',      tcp.allowed_values,
                       'source_component_id', tcp.source_component_id)
                   ORDER BY tcp.parameter_key, tcp.permission_id), '[]'::jsonb)
            FROM perfecity.template_consultant_permission tcp WHERE tcp.template_id = p_template_id
        ),
        'template_wall_configuration', (
            SELECT to_jsonb(twc) - 'created_at' - 'updated_at'
            FROM perfecity.template_wall_configuration twc
            WHERE twc.template_id = p_template_id
        ),
        'sku_compatibility', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                       'compatibility_id',  sc.compatibility_id,
                       'source_sku_id',     sc.source_sku_id,
                       'target_sku_id',     sc.target_sku_id,
                       'relationship_type', sc.relationship_type,
                       'directionality',    sc.directionality,
                       'is_mandatory',      sc.is_mandatory)
                   ORDER BY sc.compatibility_id), '[]'::jsonb)
            FROM perfecity.sku_compatibility sc
            WHERE sc.status = 'ACTIVE'
              AND (sc.source_sku_id = ANY(v_sku_ids) OR sc.target_sku_id = ANY(v_sku_ids))
        ),
        'rule_set', jsonb_build_object(
            'rule_set_id',   v_rule_set.rule_set_id,
            'rule_set_code', v_rule_set.rule_set_code,
            'version',       v_rule_set.version,
            'constants',     v_rule_set.constants
        ),
        'calculation_parameters', jsonb_build_object(
            'waste_factor', v_template.waste_factor
        )
    ) INTO v_snapshot;

    RETURN perfecity.canonical_jsonb(v_snapshot);
END;
$$;

COMMENT ON FUNCTION perfecity.build_template_snapshot(UUID, UUID) IS
    'Builds the immutable snapshot_version=2 execution baseline for a template. Called only by create_project().';

-- ---------------------------------------------------------------------------
-- 5. create_project — server-built snapshot, server-resolved rule set
-- ---------------------------------------------------------------------------
-- Ordering matters and is deliberate:
--   authorization gates first, so an unauthenticated or non-consultant caller
--   never reaches any work; then the advisory lock and idempotency lookup, so
--   a repeated request returns before the snapshot is built; then the template
--   lock (FOR SHARE), which is what keeps the template from being demoted
--   while its state is being frozen.
CREATE OR REPLACE FUNCTION perfecity.create_project(
    p_template_id UUID,
    p_user_id UUID,
    p_idempotency_key TEXT,
    p_customer_reference TEXT DEFAULT NULL,
    p_site_reference TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'perfecity'
AS $$
DECLARE
    v_lock_key      bigint;
    v_project_id    UUID;
    v_snapshot_id   UUID;
    v_rule_set_id   UUID;
    v_snapshot      JSONB;
    v_hash          TEXT;
    v_existing_id   UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Authorization failed: caller identity mismatch';
    END IF;
    IF perfecity.current_user_role() <> 'CONSULTANT' THEN
        RAISE EXCEPTION 'Authorization failed: only CONSULTANT role can create projects';
    END IF;
    IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
        RAISE EXCEPTION 'Idempotency key is required';
    END IF;

    v_lock_key := hashtext(p_idempotency_key);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT project_id INTO v_existing_id
    FROM perfecity.project_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF v_existing_id IS NOT NULL THEN
        RETURN v_existing_id;
    END IF;

    PERFORM 1 FROM perfecity.template
     WHERE template_id = p_template_id AND status = 'ACTIVE'
     FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template is not active or does not exist';
    END IF;

    IF NOT perfecity.check_template_eligible(p_template_id) THEN
        RAISE EXCEPTION 'Template dependencies are not available';
    END IF;

    SELECT rule_set_id INTO v_rule_set_id
    FROM perfecity.rule_set WHERE status = 'ACTIVE';
    IF v_rule_set_id IS NULL THEN
        RAISE EXCEPTION 'No ACTIVE rule set is available';
    END IF;

    v_snapshot := perfecity.build_template_snapshot(p_template_id, v_rule_set_id);
    v_hash := perfecity.snapshot_hash(v_snapshot);

    INSERT INTO perfecity.project (customer_reference, site_reference, template_id, created_by, status)
    VALUES (p_customer_reference, p_site_reference, p_template_id, p_user_id, 'DRAFT')
    RETURNING project_id INTO v_project_id;

    INSERT INTO perfecity.project_snapshot (project_id, template_id, snapshot_data, snapshot_hash, rule_set_id)
    VALUES (v_project_id, p_template_id, v_snapshot, v_hash, v_rule_set_id)
    RETURNING snapshot_id INTO v_snapshot_id;

    UPDATE perfecity.project SET snapshot_id = v_snapshot_id WHERE project_id = v_project_id;

    INSERT INTO perfecity.project_idempotency (idempotency_key, project_id)
    VALUES (p_idempotency_key, v_project_id);

    INSERT INTO perfecity.audit_event (
        actor_id, actor_role, event_type, entity_type, entity_id,
        project_id, snapshot_id, after_state, reason)
    VALUES (
        p_user_id, 'CONSULTANT', 'PROJECT_CREATED', 'PROJECT', v_project_id,
        v_project_id, v_snapshot_id,
        jsonb_build_object('template_id', p_template_id,
                           'rule_set_id', v_rule_set_id,
                           'snapshot_hash', v_hash),
        'Project created from ACTIVE template with server-built snapshot');

    RETURN v_project_id;
END;
$$;

-- The 6-argument client-snapshot form is withdrawn: leaving it callable would
-- leave the snapshot boundary bypassable by any authenticated consultant.
DROP FUNCTION IF EXISTS perfecity.create_project(UUID, UUID, TEXT, JSONB, TEXT, UUID);

REVOKE ALL ON FUNCTION perfecity.create_project(UUID, UUID, TEXT, TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION perfecity.create_project(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION perfecity.build_template_snapshot(UUID, UUID) FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION perfecity.snapshot_sku(UUID) FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION perfecity.canonical_jsonb(JSONB) FROM anon;
REVOKE ALL ON FUNCTION perfecity.snapshot_hash(JSONB) FROM anon;

COMMIT;
