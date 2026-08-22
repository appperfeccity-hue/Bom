-- Migration v1.1.9: Project Isolation
-- Purpose: Tighten project_update_consultant policy and add status-guard trigger
-- to prevent Consultant from escalating project status or modifying protected fields.

SET search_path = 'perfecity';

-- =============================================================================
-- 1. ALTER POLICY: Add WITH CHECK to project_update_consultant
--    Previously the policy had only USING (role=CONSULTANT AND created_by=uid()),
--    allowing any column to be written. Adding WITH CHECK ensures the consultant
--    cannot reassign the project to another user.
-- =============================================================================

ALTER POLICY project_update_consultant ON perfecity.project
  WITH CHECK (created_by = auth.uid());

-- =============================================================================
-- 2. TRIGGER FUNCTION: trg_project_status_guard_fn
--    Rejects UPDATE to protected columns on the project table unless:
--      a) The write comes from a nested trigger (pg_trigger_depth() > 1)
--         e.g. supersede_actual_bom, invalidate_bom_on_measurement_change
--      b) The internal_bom_write session variable is set
--         e.g. save_actual_bom RPC sets perfecity.internal_bom_write = 'true'
--      c) The transition is VALIDATED -> FINALIZED and a final_bom row exists
--         (finalize_project resets internal_finalization before updating project)
-- =============================================================================

CREATE OR REPLACE FUNCTION perfecity.trg_project_status_guard_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'perfecity'
AS $$
BEGIN
  -- Allow nested trigger calls (e.g. from supersede_actual_bom)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Allow internal BOM write operations
  IF current_setting('perfecity.internal_bom_write', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Check if any protected column is being changed
  IF (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.snapshot_id IS DISTINCT FROM NEW.snapshot_id OR
    OLD.template_id IS DISTINCT FROM NEW.template_id OR
    OLD.current_actual_bom_id IS DISTINCT FROM NEW.current_actual_bom_id OR
    OLD.current_configuration_id IS DISTINCT FROM NEW.current_configuration_id OR
    OLD.finalized_at IS DISTINCT FROM NEW.finalized_at
  ) THEN
    -- Allow VALIDATED -> FINALIZED if a final_bom exists for this project
    IF OLD.status = 'VALIDATED' AND NEW.status = 'FINALIZED' THEN
      IF EXISTS (
        SELECT 1 FROM perfecity.final_bom fb
        WHERE fb.project_id = OLD.project_id
      ) THEN
        RETURN NEW;
      END IF;
    END IF;

    -- Reject the change
    RAISE EXCEPTION 'Direct modification of protected project fields is not allowed. '
      'Use the appropriate RPC (save_actual_bom, finalize_project) instead.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 3. CREATE TRIGGER on project table
-- =============================================================================

DROP TRIGGER IF EXISTS trg_project_status_guard ON perfecity.project;

CREATE TRIGGER trg_project_status_guard
  BEFORE UPDATE ON perfecity.project
  FOR EACH ROW
  EXECUTE FUNCTION perfecity.trg_project_status_guard_fn();
