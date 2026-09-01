-- ============================================================================
-- Migration v1.2.5 — product_type persistence integrity
--
-- Additive only. baseline/v1.1.5_baseline.sql is IMMUTABLE (tag
-- mvp-v1.0.1-hardened) and is never edited; this migration alters the live
-- schema forward.
--
-- Problem 1: bomPipeline emits BomOutputLine.productType values including
-- 'HIDDEN_COMPONENT', but actual_bom_line.product_type references
-- product_master, whose CHECK only allowed WALL_PANEL/LIGHT/FURNITURE. Hidden
-- component lines therefore could not be persisted at all.
--
-- Problem 2: save_actual_bom (v1.2.0) writes
-- COALESCE(line ->> 'product_type', 'WALL_PANEL'), which would silently
-- reclassify any line whose product_type is missing as a wall panel.
--
-- Fix: register HIDDEN_COMPONENT as a first-class physical product type and
-- add a guard trigger so a line's product_type can never silently disagree with
-- the physical product_type of the SKU it references. Physical product_type is
-- NOT conflated with any semantic product role (no role column is added here).
-- ============================================================================

SET search_path = perfecity, public;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Allow HIDDEN_COMPONENT as a physical product type
-- ---------------------------------------------------------------------------
ALTER TABLE perfecity.product_master
  DROP CONSTRAINT IF EXISTS product_master_product_type_check;

ALTER TABLE perfecity.product_master
  ADD CONSTRAINT product_master_product_type_check
  CHECK (product_type IN ('WALL_PANEL', 'LIGHT', 'FURNITURE', 'HIDDEN_COMPONENT'));

INSERT INTO perfecity.product_master (product_type)
VALUES ('HIDDEN_COMPONENT')
ON CONFLICT (product_type) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Guard against silently defaulted / mismatched classification
--
-- A BOM line either carries the physical product_type of its SKU, or is a
-- HIDDEN_COMPONENT line (a structural/installation item whose SKU keeps its own
-- physical type). Anything else means classification was lost on the way in.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perfecity.enforce_bom_line_product_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = perfecity, pg_temp
AS $$
DECLARE
  v_sku_product_type TEXT;
BEGIN
  SELECT sm.product_type INTO v_sku_product_type
    FROM perfecity.sku_master sm
   WHERE sm.sku_id = NEW.sku_id;

  IF v_sku_product_type IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.product_type <> v_sku_product_type
     AND NEW.product_type <> 'HIDDEN_COMPONENT' THEN
    RAISE EXCEPTION
      'actual_bom_line.product_type % does not match SKU % physical product_type %',
      NEW.product_type, NEW.sku_id, v_sku_product_type
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actual_bom_line_product_type ON perfecity.actual_bom_line;

CREATE TRIGGER trg_actual_bom_line_product_type
  BEFORE INSERT OR UPDATE OF product_type, sku_id ON perfecity.actual_bom_line
  FOR EACH ROW
  EXECUTE FUNCTION perfecity.enforce_bom_line_product_type();

COMMIT;
