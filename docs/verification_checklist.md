# PERFECCITY MVP v1.1.5 – Verification Checklist

## Test Results

| Test | Description | Status |
|------|-------------|--------|
| T1 | One SKU can be assigned to a zone | ✅ PASS |
| T2 | Second SKU on the same zone is rejected | ✅ PASS |
| T3 | Duplicate same SKU on the same zone is rejected | ✅ PASS |
| T4 | Alternative SKU via template_zone_alternative works | ✅ PASS |
| T5 | Template lifecycle: activation blocked without zone/Master BOM, activation succeeds, demotion on zone change | ✅ PASS |
| T6 | P1-01: valid WALL_PANEL inserted, invalid WALL_PANEL rejected, valid LIGHT (DISCRETE/LINEAR) inserted, invalid LIGHT rejected, valid FURNITURE inserted, invalid FURNITURE rejected | ✅ PASS |
| T7 | P1-02: measurement update supersedes Actual BOM, clears current_actual_bom_id, resets project to CONFIGURED, second BOM also superseded | ✅ PASS |

## Trigger Integrity

| Trigger | Verified |
|---------|----------|
| Catalogue status guard (trg_catalogue_entry_status_immutable) | ✅ |
| Template demotion on child change | ✅ |
| Template activation eligibility check | ✅ |
| Template structural change demotion | ✅ |
| Snapshot immutability (trg_snapshot_immutable) | ✅ |
| Final BOM immutability (trg_final_bom_immutable) | ✅ |
| Final BOM line immutability (trg_final_bom_line_immutable) | ✅ |
| Audit append-only (trg_audit_immutable) | ✅ |
| Actual BOM supersession (trg_actual_bom_supersede) | ✅ |
| Actual BOM ownership consistency | ✅ |
| Snapshot template match | ✅ |
| Measurement invalidation (trg_measurement_invalidate_bom) | ✅ |

## Corrections Applied During Verification

| Issue | Fix | Rationale |
|-------|-----|-----------|
| `thickness_mm CHECK (> 0)` | Changed to `CHECK (>= 0)` | FURNITURE requires `thickness_mm = 0` per spec |
| `fk_project_current_actual_bom` | Made `DEFERRABLE INITIALLY DEFERRED` | Supersede trigger updates project FK before BOM row committed |
| `prevent_actual_bom_modification_after_final()` | Returns `NEW` for UPDATE, `OLD` for DELETE | Was returning `OLD` for UPDATE which silently prevented status changes |

## Sign-off

- **Date:** 2026-08-12
- **Database Platform:** Supabase PostgreSQL 17.6
- **Project ID:** fbiemsbykrmrbqcsobvh
- **Region:** ap-northeast-2
- **Status:** Execution-Verified
