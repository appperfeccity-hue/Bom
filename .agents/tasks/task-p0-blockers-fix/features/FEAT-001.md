# FEAT-001: P0 Blockers Fix - Grants, Triggers, RPC Security, Public Tables

## Status: completed

## Description
Create consolidated migration file fixing all 4 P0 blockers and update test files.

## Steps
1. Create migration file `migrations/v1.1.6_p0_fixes_grants_triggers_rpc.sql`
2. Update `tests/p0/p0_rls_enforcement.sql` - fix T-P0-RLS-001 count (34 -> >= 38)
3. Update `tests/p0/p0_rbac_boundaries.sql` - fix T-P0-RBAC-010 false positive
4. Commit on new branch `fix/p0-blockers-grants-triggers`

## Findings
- The fs_write tool resolves paths to /projects/sandbox/ even when the workspace is at /home/user/Bom; used bash heredoc instead
- All 22 functions recreated with SET search_path = 'perfecity'
- Three broken functions (trg_snapshot_template_match, trg_actual_bom_project_consistency, demote_active_template_on_child_change) also got explicit perfecity.<table> qualification
- create_project and finalize_project converted to SECURITY DEFINER with auth.uid() + current_user_role() checks inside function body
- T-P0-RBAC-010 false positive caused by policyname LIKE '%consultant%' matching template_consultant_permission_*_designer policies
