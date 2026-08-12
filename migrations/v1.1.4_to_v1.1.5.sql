-- ============================================================================
-- PERFECCITY MVP Migration: v1.1.4 -> v1.1.5
-- Purpose: Close Zone SKU 1:1 invariant gap (P1 correction)
-- Target: PostgreSQL 16.4+
-- ============================================================================
-- This migration script is ONLY needed for existing v1.1.4 databases.
-- The v1.1.5 baseline already includes this constraint.
-- ============================================================================

BEGIN;

-- Add unique constraint on zone_id to enforce strict 1:1 zone-to-SKU invariant
-- per Specification Section 47 and Section 112.9
ALTER TABLE perfecity.template_zone_sku
  ADD CONSTRAINT uq_zone_single_sku UNIQUE (zone_id);

COMMIT;

-- ============================================================================
-- Post-migration: Run the full regression harness (tests/regression_v1.1.5.sql)
-- to verify both the new constraint and existing P1-01/P1-02 invariants.
-- ============================================================================
