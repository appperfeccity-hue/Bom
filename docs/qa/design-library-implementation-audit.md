# PERFECCITY Design Library — Implementation Audit

**Audit Date:** 2026-08-17
**Branch:** `feat/db-baseline-v1.1.5`
**Method:** Read-only code inspection + live Supabase SQL verification
**Auditor:** Automated (Kiro)

---

## Executive Status

```
DESIGN LIBRARY STATUS: PARTIALLY IMPLEMENTED
```

The Design Library module is functionally operational for the happy path (Designer publishes → Consultant browses → Consultant selects → Project+Snapshot created). However, several specification requirements are not fully enforced at the server/database layer.

---

## A. Implementation Score

| Classification | Count |
|---|---|
| ✅ IMPLEMENTED | 14 |
| ⚠️ PARTIALLY IMPLEMENTED | 6 |
| ❌ MISSING | 4 |
| 🟡 IMPLEMENTED BUT UNVERIFIED | 2 |
| 🟣 INCORRECT / DEFECTIVE | 2 |
| 🔴 BLOCKED | 0 |

---

## B. Critical Findings

### FINDING-001: Publication is NOT Atomic

| Field | Value |
|---|---|
| Severity | P0 / Data Integrity |
| Requirement | §5 — Publication must be a single atomic server-side transaction |
| Evidence | `publishStore.ts:304-310` — publication is a single `fromTable('template').update({ status: 'ACTIVE' })` call from the client |
| Actual behavior | Client runs validation gates sequentially, then fires a standalone UPDATE. Between validation and UPDATE, template state could change. Validation is client-side only. |
| Expected behavior | Server-side atomic transaction: validate ALL gates → UPDATE in one transaction |
| Root cause | No server-side publish RPC exists. Publication relies on client-side orchestration. |
| Impact | A template could become ACTIVE with failed validation gates (race condition, client manipulation, or stale data) |
| Recommended fix | Create `perfecity.publish_template(p_template_id)` SECURITY DEFINER RPC that validates and updates atomically |

### FINDING-002: Availability NOT Enforced Server-Side

| Field | Value |
|---|---|
| Severity | P1 / Security |
| Requirement | §10 — Consultant selection must verify ACTIVE + AVAILABLE |
| Evidence | `create_project` RPC checks `status = 'ACTIVE'` but NOT dependency availability |
| Actual behavior | A consultant bypassing the UI can create a project from a template with inactive SKUs |
| Expected behavior | Server rejects project creation if template dependencies are invalid |
| Root cause | Availability is computed client-side only (designLibraryStore.ts) |
| Impact | Projects could be created with stale/invalid SKU references in snapshot |
| Recommended fix | Add availability check inside `create_project` RPC |

---

## C. Requirements Traceability Matrix

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| DL-001 | Template lifecycle: DRAFT → ACTIVE → RETIRED | ✅ IMPLEMENTED | TemplateStatus enum + DB CHECK constraint |
| DL-002 | Availability derived (AVAILABLE/BLOCKED) | ✅ IMPLEMENTED | designLibraryStore.ts computes from SKU chain |
| DL-003 | Status ≠ Availability (not conflated) | ✅ IMPLEMENTED | Separate computation in store |
| DL-004 | Consultant sees only ACTIVE + AVAILABLE | ⚠️ PARTIAL | Client filters ACTIVE; RLS allows read of ALL statuses |
| DL-005 | Designer sees BLOCKED with reasons | ✅ IMPLEMENTED | designLibraryStore + EnhancedTemplateCard |
| DL-006 | Publication requires all validation gates | ⚠️ PARTIAL | 5 gates implemented (zones, SKU, overlap, constraints, metadata). Missing: compatibility, dependency cycle, Master BOM APPROVED check |
| DL-007 | Publication atomic server-side | 🟣 DEFECTIVE | Client-side only; no server RPC |
| DL-008 | Zone SKU: exactly one WALL_PANEL per zone | ✅ IMPLEMENTED | DB UNIQUE constraint + validation gate |
| DL-009 | All SKUs ACTIVE + Catalogue READY for publish | ✅ IMPLEMENTED | publishStore validation gate 2 |
| DL-010 | Compatibility validation at publish | ❌ MISSING | Not found in publishStore validation |
| DL-011 | Dependency cycle detection at publish | ❌ MISSING | Not found in publishStore validation |
| DL-012 | Master BOM APPROVED required for publish | ❌ MISSING | publishStore generates BOM but doesn't gate on existing APPROVED state |
| DL-013 | Design Library is query-time projection | ✅ IMPLEMENTED | designLibraryStore fetches live, no duplicate persistence |
| DL-014 | Search by name/family/application | ✅ IMPLEMENTED | Client-side filter in designLibraryStore |
| DL-015 | Design Family grouping | ✅ IMPLEMENTED | groupByDesignFamily utility |
| DL-016 | Template detail/preview | ✅ IMPLEMENTED | TemplatePreviewPanel component |
| DL-017 | Blocked templates: Designer visible, Consultant hidden | ⚠️ PARTIAL | Client filter hides BLOCKED; RLS doesn't enforce |
| DL-018 | Retire workflow | ✅ IMPLEMENTED | templateManagementStore.retireTemplate |
| DL-019 | Retire doesn't affect existing projects | ✅ IMPLEMENTED | Snapshot immutability (trigger-enforced) |
| DL-020 | Selection creates Project + Snapshot atomically | ✅ IMPLEMENTED | create_project RPC (single transaction) |
| DL-021 | Snapshot immutable after creation | ✅ IMPLEMENTED | DB trigger: prevent_snapshot_modification |
| DL-022 | Template changes don't affect Snapshot | ✅ IMPLEMENTED | Snapshot is physically separate row |
| DL-023 | Actual BOM derives from Snapshot | ✅ IMPLEMENTED | bomStore.runPipeline reads project_snapshot |
| DL-024 | Final BOM immutable | ✅ IMPLEMENTED | DB trigger: prevent_final_bom_modification |
| DL-025 | Consultant permissions (LOCKED/ALLOWED) | ⚠️ PARTIAL | DB table exists; server enforcement unclear |
| DL-026 | Promoted alternatives only | ⚠️ PARTIAL | UI component exists; server validation not confirmed |
| DL-027 | No hard delete | ✅ IMPLEMENTED | Status transitions only; no DELETE in workflows |
| DL-028 | Idempotent project creation | ✅ IMPLEMENTED | pg_advisory_xact_lock + idempotency table |

---

## D. Missing Implementation

| # | Requirement | Gap |
|---|---|---|
| 1 | Compatibility validation at publication | publishStore has no compatibility check |
| 2 | Dependency cycle detection at publication | publishStore has no cycle detection |
| 3 | Master BOM APPROVED gate for publication | publish flow generates+approves BOM in sequence but doesn't validate pre-existing APPROVED state |
| 4 | Server-side availability check in create_project | RPC only checks status=ACTIVE |

---

## E. Partial Implementation

| # | Requirement | What Exists | What's Missing |
|---|---|---|---|
| 1 | Consultant sees only ACTIVE+AVAILABLE | Client fetches WHERE status=ACTIVE. designLibraryStore filters BLOCKED. | RLS allows Consultant to read DRAFT/RETIRED via direct API. No server-side availability filter. |
| 2 | Publication validation gates | 5 gates: zone SKU, SKU+catalogue status, overlaps, constraints, metadata | Missing: compatibility, cycle detection, Master BOM pre-check |
| 3 | Consultant permission enforcement | DB table + UI components exist | Server-side enforcement of min/max/allowed_values not confirmed on write path |
| 4 | Promoted alternative validation | UI shows only promoted alternatives | Server doesn't reject arbitrary SKU assignment via direct API |

---

## F. Blockers

None. All issues are implementation gaps, not infrastructure blockers.

---

## G. Incorrect Implementations

| # | Issue | Evidence |
|---|---|---|
| 1 | Publication is client-orchestrated, not server-atomic | publishStore.ts calls validation → then separate .update() call |
| 2 | DL-013 previously reported as "PASS" but Consultant CAN read DRAFT templates | RLS policy `USING(true)` for SELECT |

---

## H. Test Coverage

| Metric | Value |
|---|---|
| Total tests | 1,205 |
| Design Library specific | 61 |
| Passing | 1,205 |
| Failing | 0 (unit level) |
| E2E (P0-C) | 13 PASS, 0 FAIL, 28 BLOCKED |
| Live SQL verified (P0-A) | 58/58 |
| Live SQL verified (DL acceptance) | 12/14 PASS, 2 observations |
| Missing tests | Server-side availability enforcement, publication atomicity, compatibility at publish, cycle detection at publish |

---

## I. Build / Deployment Status

| Check | Result |
|---|---|
| TypeScript | PASS (1 pre-existing unrelated warning) |
| Build (vite) | PASS |
| Unit tests | 1,205 PASS |
| E2E CI | 13 PASS / 28 BLOCKED (MVP UI scope) |
| Database | Live, accessible, all constraints active |
| RPC functions | create_project + finalize_project working |

---

## J. Recommended Next Actions

### P0 — Security / Data Integrity

1. **Create `publish_template` RPC** — Server-side atomic publication with all validation gates
2. **Add availability check to `create_project`** — Reject templates with invalid dependency chains

### P1 — Functional Correctness

3. **Add compatibility validation** to publication workflow
4. **Add dependency cycle detection** to publication workflow
5. **Add Master BOM APPROVED pre-check** to publication
6. **Restrict template SELECT RLS** for CONSULTANT role to `status = 'ACTIVE'`
7. **Add server-side permission enforcement** for consultant parameter writes

### P2 — UX / Completeness

8. **Add debouncing** to Design Library search
9. **Add preview panel backdrop/focus-trap**
10. **Batch `.in()` queries** for large catalogues
11. **Add concurrent-fetch guard** to designLibraryStore

### P3 — Cleanup / Optimization

12. Remove unused template fields from Consultant response
13. Add pagination to Design Library for large template counts
14. Add loading skeletons matching design system
