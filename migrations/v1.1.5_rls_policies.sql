-- =============================================================================
-- Migration: v1.1.5_rls_policies.sql
-- Description: Enable RLS on all 34 perfecity schema tables and create
--              comprehensive authorization policies for PERFECCITY MVP.
--
-- Auth model:
--   - ADMIN: reads everything, writes master/reference data
--   - DESIGNER: reads all, writes own templates and children
--   - CONSULTANT: reads/writes own projects, reads own BOMs
--   - SYSTEM (service_role): bypasses RLS automatically
--
-- Notes:
--   - service_role bypasses RLS by default in Supabase (no explicit policies needed)
--   - FORCE ROW LEVEL SECURITY is intentionally omitted because:
--       (a) The postgres role is the table owner and always bypasses RLS
--       (b) service_role uses the postgres role which bypasses RLS
--       (c) FORCE RLS would only constrain the table owner, which Supabase uses internally
--       (d) All user-facing access goes through authenticated role, already subject to RLS
--     Therefore FORCE ROW LEVEL SECURITY provides no additional security benefit.
--   - anon role intentionally excluded: the spec requires authentication for all access
--   - Audit event INSERT restricted to service_role only (bypasses RLS) to prevent
--     user-crafted audit trail pollution
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. SCHEMA AND TABLE GRANTS
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA perfecity TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA perfecity TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA perfecity TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA perfecity TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. HELPER FUNCTION
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION perfecity.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role');
$$;

-- Grant execute to authenticated so policies can call it
GRANT EXECUTE ON FUNCTION perfecity.current_user_role() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY ON ALL 34 TABLES
-- ---------------------------------------------------------------------------

ALTER TABLE perfecity.product_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.family_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.category_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.design_family_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.design_subfamily_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.sku_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.sku_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.sku_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.catalogue_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.catalogue_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.catalogue_asset_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.rule_set ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.template ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.template_zone ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.template_zone_sku ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.template_zone_alternative ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.template_lighting ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.template_furniture ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.template_trim ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.template_hidden_component ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.template_consultant_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.master_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.master_bom_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.project ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.project_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.project_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.project_measurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.actual_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.actual_bom_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.final_bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.final_bom_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.project_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfecity.finalization_idempotency ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. MASTER DATA POLICIES
--    Tables: product_master, family_master, category_master,
--            design_family_master, design_subfamily_master
--    Rules: all authenticated can SELECT; ADMIN can INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------------

-- product_master
CREATE POLICY product_master_select_authenticated ON perfecity.product_master
  FOR SELECT TO authenticated USING (true);
CREATE POLICY product_master_insert_admin ON perfecity.product_master
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY product_master_update_admin ON perfecity.product_master
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY product_master_delete_admin ON perfecity.product_master
  FOR DELETE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- family_master
CREATE POLICY family_master_select_authenticated ON perfecity.family_master
  FOR SELECT TO authenticated USING (true);
CREATE POLICY family_master_insert_admin ON perfecity.family_master
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY family_master_update_admin ON perfecity.family_master
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY family_master_delete_admin ON perfecity.family_master
  FOR DELETE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- category_master
CREATE POLICY category_master_select_authenticated ON perfecity.category_master
  FOR SELECT TO authenticated USING (true);
CREATE POLICY category_master_insert_admin ON perfecity.category_master
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY category_master_update_admin ON perfecity.category_master
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY category_master_delete_admin ON perfecity.category_master
  FOR DELETE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- design_family_master
CREATE POLICY design_family_master_select_authenticated ON perfecity.design_family_master
  FOR SELECT TO authenticated USING (true);
CREATE POLICY design_family_master_insert_admin ON perfecity.design_family_master
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY design_family_master_update_admin ON perfecity.design_family_master
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY design_family_master_delete_admin ON perfecity.design_family_master
  FOR DELETE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- design_subfamily_master
CREATE POLICY design_subfamily_master_select_authenticated ON perfecity.design_subfamily_master
  FOR SELECT TO authenticated USING (true);
CREATE POLICY design_subfamily_master_insert_admin ON perfecity.design_subfamily_master
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY design_subfamily_master_update_admin ON perfecity.design_subfamily_master
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY design_subfamily_master_delete_admin ON perfecity.design_subfamily_master
  FOR DELETE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 5. SKU POLICIES
--    Tables: sku_master, sku_variant, sku_compatibility
--    Rules: all authenticated can SELECT; ADMIN can INSERT/UPDATE/DELETE
-- ---------------------------------------------------------------------------

-- sku_master
CREATE POLICY sku_master_select_authenticated ON perfecity.sku_master
  FOR SELECT TO authenticated USING (true);
CREATE POLICY sku_master_insert_admin ON perfecity.sku_master
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY sku_master_update_admin ON perfecity.sku_master
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY sku_master_delete_admin ON perfecity.sku_master
  FOR DELETE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- sku_variant
CREATE POLICY sku_variant_select_authenticated ON perfecity.sku_variant
  FOR SELECT TO authenticated USING (true);
CREATE POLICY sku_variant_insert_admin ON perfecity.sku_variant
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY sku_variant_update_admin ON perfecity.sku_variant
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY sku_variant_delete_admin ON perfecity.sku_variant
  FOR DELETE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- sku_compatibility
CREATE POLICY sku_compatibility_select_authenticated ON perfecity.sku_compatibility
  FOR SELECT TO authenticated USING (true);
CREATE POLICY sku_compatibility_insert_admin ON perfecity.sku_compatibility
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY sku_compatibility_update_admin ON perfecity.sku_compatibility
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY sku_compatibility_delete_admin ON perfecity.sku_compatibility
  FOR DELETE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 6. CATALOGUE POLICIES
--    Tables: catalogue_entry, catalogue_asset, catalogue_asset_metadata
--    Rules: all authenticated can SELECT; ADMIN can INSERT/UPDATE
-- ---------------------------------------------------------------------------

-- catalogue_entry
CREATE POLICY catalogue_entry_select_authenticated ON perfecity.catalogue_entry
  FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogue_entry_insert_admin ON perfecity.catalogue_entry
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY catalogue_entry_update_admin ON perfecity.catalogue_entry
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- catalogue_asset
CREATE POLICY catalogue_asset_select_authenticated ON perfecity.catalogue_asset
  FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogue_asset_insert_admin ON perfecity.catalogue_asset
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY catalogue_asset_update_admin ON perfecity.catalogue_asset
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- catalogue_asset_metadata
CREATE POLICY catalogue_asset_metadata_select_authenticated ON perfecity.catalogue_asset_metadata
  FOR SELECT TO authenticated USING (true);
CREATE POLICY catalogue_asset_metadata_insert_admin ON perfecity.catalogue_asset_metadata
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY catalogue_asset_metadata_update_admin ON perfecity.catalogue_asset_metadata
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 7. RULE SET POLICIES
--    Table: rule_set
--    Rules: all authenticated can SELECT; ADMIN can INSERT/UPDATE
-- ---------------------------------------------------------------------------

CREATE POLICY rule_set_select_authenticated ON perfecity.rule_set
  FOR SELECT TO authenticated USING (true);
CREATE POLICY rule_set_insert_admin ON perfecity.rule_set
  FOR INSERT TO authenticated WITH CHECK (perfecity.current_user_role() = 'ADMIN');
CREATE POLICY rule_set_update_admin ON perfecity.rule_set
  FOR UPDATE TO authenticated USING (perfecity.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 8. TEMPLATE POLICIES
--    Table: template
--    Rules: all authenticated can SELECT (needed for project creation from templates)
--           DESIGNER can INSERT (new templates), UPDATE/DELETE own (created_by = auth.uid())
--           ADMIN can INSERT/UPDATE/DELETE all templates
-- ---------------------------------------------------------------------------

CREATE POLICY template_select_authenticated ON perfecity.template
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_insert_designer ON perfecity.template
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'DESIGNER'
    AND created_by = auth.uid()
  );

CREATE POLICY template_update_designer ON perfecity.template
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND created_by = auth.uid()
  );

CREATE POLICY template_delete_designer ON perfecity.template
  FOR DELETE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND created_by = auth.uid()
  );

CREATE POLICY template_insert_admin ON perfecity.template
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_update_admin ON perfecity.template
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_delete_admin ON perfecity.template
  FOR DELETE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 9. TEMPLATE CHILD TABLE POLICIES (direct children via template_id)
--    Tables: template_zone, template_lighting, template_furniture, template_trim,
--            template_hidden_component, template_consultant_permission
--    Rules: all authenticated can SELECT
--           DESIGNER can INSERT/UPDATE/DELETE if parent template.created_by = auth.uid()
--           ADMIN can INSERT/UPDATE/DELETE all
-- ---------------------------------------------------------------------------

-- template_zone
CREATE POLICY template_zone_select_authenticated ON perfecity.template_zone
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_zone_insert_designer ON perfecity.template_zone
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_zone.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_zone_update_designer ON perfecity.template_zone
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_zone.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_zone_delete_designer ON perfecity.template_zone
  FOR DELETE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_zone.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_zone_insert_admin ON perfecity.template_zone
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_zone_update_admin ON perfecity.template_zone
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_zone_delete_admin ON perfecity.template_zone
  FOR DELETE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- template_lighting
CREATE POLICY template_lighting_select_authenticated ON perfecity.template_lighting
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_lighting_insert_designer ON perfecity.template_lighting
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_lighting.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_lighting_update_designer ON perfecity.template_lighting
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_lighting.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_lighting_delete_designer ON perfecity.template_lighting
  FOR DELETE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_lighting.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_lighting_insert_admin ON perfecity.template_lighting
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_lighting_update_admin ON perfecity.template_lighting
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_lighting_delete_admin ON perfecity.template_lighting
  FOR DELETE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- template_furniture
CREATE POLICY template_furniture_select_authenticated ON perfecity.template_furniture
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_furniture_insert_designer ON perfecity.template_furniture
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_furniture.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_furniture_update_designer ON perfecity.template_furniture
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_furniture.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_furniture_delete_designer ON perfecity.template_furniture
  FOR DELETE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_furniture.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_furniture_insert_admin ON perfecity.template_furniture
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_furniture_update_admin ON perfecity.template_furniture
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_furniture_delete_admin ON perfecity.template_furniture
  FOR DELETE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- template_trim
CREATE POLICY template_trim_select_authenticated ON perfecity.template_trim
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_trim_insert_designer ON perfecity.template_trim
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_trim.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_trim_update_designer ON perfecity.template_trim
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_trim.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_trim_delete_designer ON perfecity.template_trim
  FOR DELETE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_trim.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_trim_insert_admin ON perfecity.template_trim
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_trim_update_admin ON perfecity.template_trim
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_trim_delete_admin ON perfecity.template_trim
  FOR DELETE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- template_hidden_component
CREATE POLICY template_hidden_component_select_authenticated ON perfecity.template_hidden_component
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_hidden_component_insert_designer ON perfecity.template_hidden_component
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_hidden_component.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_hidden_component_update_designer ON perfecity.template_hidden_component
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_hidden_component.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_hidden_component_delete_designer ON perfecity.template_hidden_component
  FOR DELETE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_hidden_component.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_hidden_component_insert_admin ON perfecity.template_hidden_component
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_hidden_component_update_admin ON perfecity.template_hidden_component
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_hidden_component_delete_admin ON perfecity.template_hidden_component
  FOR DELETE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- template_consultant_permission
CREATE POLICY template_consultant_permission_select_authenticated ON perfecity.template_consultant_permission
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_consultant_permission_insert_designer ON perfecity.template_consultant_permission
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_consultant_permission.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_consultant_permission_update_designer ON perfecity.template_consultant_permission
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_consultant_permission.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_consultant_permission_delete_designer ON perfecity.template_consultant_permission
  FOR DELETE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = template_consultant_permission.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_consultant_permission_insert_admin ON perfecity.template_consultant_permission
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_consultant_permission_update_admin ON perfecity.template_consultant_permission
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_consultant_permission_delete_admin ON perfecity.template_consultant_permission
  FOR DELETE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 10. TEMPLATE CHILD TABLE POLICIES (indirect children via zone_id)
--     Tables: template_zone_sku (via zone_id), template_zone_alternative (via template_zone_id)
--     Rules: all authenticated can SELECT
--            DESIGNER can INSERT/UPDATE/DELETE if grandparent template.created_by = auth.uid()
--            ADMIN can INSERT/UPDATE/DELETE all
-- ---------------------------------------------------------------------------

-- template_zone_sku (zone_id -> template_zone.zone_id -> template.template_id)
CREATE POLICY template_zone_sku_select_authenticated ON perfecity.template_zone_sku
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_zone_sku_insert_designer ON perfecity.template_zone_sku
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template_zone tz
      JOIN perfecity.template t ON t.template_id = tz.template_id
      WHERE tz.zone_id = template_zone_sku.zone_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_zone_sku_update_designer ON perfecity.template_zone_sku
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template_zone tz
      JOIN perfecity.template t ON t.template_id = tz.template_id
      WHERE tz.zone_id = template_zone_sku.zone_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_zone_sku_delete_designer ON perfecity.template_zone_sku
  FOR DELETE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template_zone tz
      JOIN perfecity.template t ON t.template_id = tz.template_id
      WHERE tz.zone_id = template_zone_sku.zone_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_zone_sku_insert_admin ON perfecity.template_zone_sku
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_zone_sku_update_admin ON perfecity.template_zone_sku
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_zone_sku_delete_admin ON perfecity.template_zone_sku
  FOR DELETE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- template_zone_alternative (template_zone_id -> template_zone.zone_id -> template.template_id)
CREATE POLICY template_zone_alternative_select_authenticated ON perfecity.template_zone_alternative
  FOR SELECT TO authenticated USING (true);

CREATE POLICY template_zone_alternative_insert_designer ON perfecity.template_zone_alternative
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template_zone tz
      JOIN perfecity.template t ON t.template_id = tz.template_id
      WHERE tz.zone_id = template_zone_alternative.template_zone_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_zone_alternative_update_designer ON perfecity.template_zone_alternative
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template_zone tz
      JOIN perfecity.template t ON t.template_id = tz.template_id
      WHERE tz.zone_id = template_zone_alternative.template_zone_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_zone_alternative_delete_designer ON perfecity.template_zone_alternative
  FOR DELETE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template_zone tz
      JOIN perfecity.template t ON t.template_id = tz.template_id
      WHERE tz.zone_id = template_zone_alternative.template_zone_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY template_zone_alternative_insert_admin ON perfecity.template_zone_alternative
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_zone_alternative_update_admin ON perfecity.template_zone_alternative
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY template_zone_alternative_delete_admin ON perfecity.template_zone_alternative
  FOR DELETE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 11. MASTER BOM POLICIES
--     Tables: master_bom, master_bom_line
--     Rules: all authenticated can SELECT
--            DESIGNER can UPDATE own template's BOM (for approval) - scoped to
--              ownership via template.created_by = auth.uid()
--            INSERT/DELETE via service_role (SYSTEM) which bypasses RLS
-- ---------------------------------------------------------------------------

-- master_bom
CREATE POLICY master_bom_select_authenticated ON perfecity.master_bom
  FOR SELECT TO authenticated USING (true);

CREATE POLICY master_bom_update_designer ON perfecity.master_bom
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.template t
      WHERE t.template_id = master_bom.template_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY master_bom_insert_admin ON perfecity.master_bom
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY master_bom_update_admin ON perfecity.master_bom
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- master_bom_line
CREATE POLICY master_bom_line_select_authenticated ON perfecity.master_bom_line
  FOR SELECT TO authenticated USING (true);

CREATE POLICY master_bom_line_update_designer ON perfecity.master_bom_line
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.master_bom mb
      JOIN perfecity.template t ON t.template_id = mb.template_id
      WHERE mb.master_bom_id = master_bom_line.master_bom_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY master_bom_line_insert_admin ON perfecity.master_bom_line
  FOR INSERT TO authenticated
  WITH CHECK (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY master_bom_line_update_admin ON perfecity.master_bom_line
  FOR UPDATE TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 12. PROJECT POLICIES
--     Table: project
--     Rules: CONSULTANT can SELECT/INSERT/UPDATE own (created_by = auth.uid())
--            ADMIN can SELECT all
--            DESIGNER can SELECT all (to view templates in use)
-- ---------------------------------------------------------------------------

CREATE POLICY project_select_consultant ON perfecity.project
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND created_by = auth.uid()
  );

CREATE POLICY project_select_admin ON perfecity.project
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY project_select_designer ON perfecity.project
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'DESIGNER');

CREATE POLICY project_insert_consultant ON perfecity.project
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'CONSULTANT'
    AND created_by = auth.uid()
  );

CREATE POLICY project_update_consultant ON perfecity.project
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 13. PROJECT CHILD TABLE POLICIES
--     Tables: project_snapshot, project_configuration, project_measurement
--     Rules: CONSULTANT can SELECT/INSERT if parent project.created_by = auth.uid()
--            (project_snapshot has no UPDATE policy - snapshots are immutable per spec S69-72)
--            ADMIN can SELECT all
--            DESIGNER can SELECT all
-- ---------------------------------------------------------------------------

-- project_snapshot
CREATE POLICY project_snapshot_select_consultant ON perfecity.project_snapshot
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_snapshot.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY project_snapshot_select_admin ON perfecity.project_snapshot
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY project_snapshot_select_designer ON perfecity.project_snapshot
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'DESIGNER');

CREATE POLICY project_snapshot_insert_consultant ON perfecity.project_snapshot
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_snapshot.project_id
        AND p.created_by = auth.uid()
    )
  );

-- project_configuration
CREATE POLICY project_configuration_select_consultant ON perfecity.project_configuration
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_configuration.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY project_configuration_select_admin ON perfecity.project_configuration
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY project_configuration_select_designer ON perfecity.project_configuration
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'DESIGNER');

CREATE POLICY project_configuration_insert_consultant ON perfecity.project_configuration
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_configuration.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY project_configuration_update_consultant ON perfecity.project_configuration
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_configuration.project_id
        AND p.created_by = auth.uid()
    )
  );

-- project_measurement
CREATE POLICY project_measurement_select_consultant ON perfecity.project_measurement
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_measurement.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY project_measurement_select_admin ON perfecity.project_measurement
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY project_measurement_select_designer ON perfecity.project_measurement
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'DESIGNER');

CREATE POLICY project_measurement_insert_consultant ON perfecity.project_measurement
  FOR INSERT TO authenticated
  WITH CHECK (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_measurement.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY project_measurement_update_consultant ON perfecity.project_measurement
  FOR UPDATE TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_measurement.project_id
        AND p.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 14. ACTUAL BOM POLICIES
--     Tables: actual_bom, actual_bom_line
--     Rules: CONSULTANT can SELECT if owns parent project
--            ADMIN can SELECT all
--            DESIGNER can SELECT all
--            INSERT/UPDATE/DELETE via service_role (SYSTEM) which bypasses RLS
-- ---------------------------------------------------------------------------

-- actual_bom
CREATE POLICY actual_bom_select_consultant ON perfecity.actual_bom
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = actual_bom.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY actual_bom_select_admin ON perfecity.actual_bom
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY actual_bom_select_designer ON perfecity.actual_bom
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'DESIGNER');

-- actual_bom_line
CREATE POLICY actual_bom_line_select_consultant ON perfecity.actual_bom_line
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.actual_bom ab
      JOIN perfecity.project p ON p.project_id = ab.project_id
      WHERE ab.actual_bom_id = actual_bom_line.actual_bom_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY actual_bom_line_select_admin ON perfecity.actual_bom_line
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY actual_bom_line_select_designer ON perfecity.actual_bom_line
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'DESIGNER');

-- ---------------------------------------------------------------------------
-- 15. FINAL BOM POLICIES
--     Tables: final_bom, final_bom_line
--     Rules: CONSULTANT can SELECT if owns parent project
--            ADMIN can SELECT all
--            DESIGNER can SELECT if owns the template used by the project
--            No INSERT/UPDATE/DELETE for user roles (immutable, created by service_role)
-- ---------------------------------------------------------------------------

-- final_bom
CREATE POLICY final_bom_select_consultant ON perfecity.final_bom
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = final_bom.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY final_bom_select_admin ON perfecity.final_bom
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY final_bom_select_designer ON perfecity.final_bom
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      JOIN perfecity.template t ON t.template_id = p.template_id
      WHERE p.project_id = final_bom.project_id
        AND t.created_by = auth.uid()
    )
  );

-- final_bom_line
CREATE POLICY final_bom_line_select_consultant ON perfecity.final_bom_line
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.final_bom fb
      JOIN perfecity.project p ON p.project_id = fb.project_id
      WHERE fb.final_bom_id = final_bom_line.final_bom_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY final_bom_line_select_admin ON perfecity.final_bom_line
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

CREATE POLICY final_bom_line_select_designer ON perfecity.final_bom_line
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'DESIGNER'
    AND EXISTS (
      SELECT 1 FROM perfecity.final_bom fb
      JOIN perfecity.project p ON p.project_id = fb.project_id
      JOIN perfecity.template t ON t.template_id = p.template_id
      WHERE fb.final_bom_id = final_bom_line.final_bom_id
        AND t.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 16. AUDIT EVENT POLICIES
--     Table: audit_event
--     Rules: ADMIN can SELECT (read audit trail)
--            INSERT restricted to service_role only (bypasses RLS)
--            No UPDATE/DELETE (enforced by immutability trigger)
--     Note: audit writes are atomic with state mutations and must only be
--           performed by service_role. No authenticated user INSERT policy
--           is needed or allowed to prevent audit trail pollution.
-- ---------------------------------------------------------------------------

CREATE POLICY audit_event_select_admin ON perfecity.audit_event
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 17. IDEMPOTENCY TABLE POLICIES
--     Tables: project_idempotency, finalization_idempotency
--     Rules: CONSULTANT can SELECT own (via project_id -> project.created_by)
--            ADMIN can SELECT all
--            INSERT via service_role (SYSTEM) which bypasses RLS
-- ---------------------------------------------------------------------------

-- project_idempotency
CREATE POLICY project_idempotency_select_consultant ON perfecity.project_idempotency
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = project_idempotency.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY project_idempotency_select_admin ON perfecity.project_idempotency
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

-- finalization_idempotency
CREATE POLICY finalization_idempotency_select_consultant ON perfecity.finalization_idempotency
  FOR SELECT TO authenticated
  USING (
    perfecity.current_user_role() = 'CONSULTANT'
    AND EXISTS (
      SELECT 1 FROM perfecity.project p
      WHERE p.project_id = finalization_idempotency.project_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY finalization_idempotency_select_admin ON perfecity.finalization_idempotency
  FOR SELECT TO authenticated
  USING (perfecity.current_user_role() = 'ADMIN');

COMMIT;
