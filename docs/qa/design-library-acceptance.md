# Design Library — Acceptance Test Results

**Feature Branch:** `feat/db-baseline-v1.1.5`
**Execution Date:** 2026-08-17
**Method:** Live SQL via Supabase MCP (PostgREST-equivalent enforcement path)
**Database:** `fbiemsbykrmrbqcsobvh` (production)

---

## Gate Decision

```
DESIGN LIBRARY — ACCEPTED / FUNCTIONALLY COMPLETE / SECURITY HARDENING DEFERRED
```

- Feature implementation: ✅ PASS
- Live data verification: ✅ PASS
- UI/unit coverage: ✅ PASS (1,205 tests, 61 new)
- Regression status: ✅ PASS (no existing test broken)
- Security enforcement: ⚠️ HARDENING REQUIRED (2 findings)

---

## Test Results

| Test ID | Requirement | Result | Evidence |
|---------|-------------|--------|----------|
| DL-001 | ACTIVE template appears in Design Library | ✅ PASS | 2 ACTIVE templates returned to Consultant |
| DL-002 | DRAFT/RETIRED never appears (with status filter) | ✅ PASS | Empty array for DRAFT/RETIRED with `WHERE status='ACTIVE'` |
| DL-003 | All dependency SKUs ACTIVE → AVAILABLE | ✅ PASS | WP-OAK-600 + WP-GRY-800 both ACTIVE/READY |
| DL-004 | Any inactive SKU → BLOCKED | ✅ PASS | SKU set INACTIVE → chain reports blocked state |
| DL-005 | BLOCKED reason identifies affected SKU | ✅ PASS | Specific SKU code identified in availability chain |
| DL-006 | BLOCKED template cannot be selected | 🟡 CLIENT-ONLY | UI prevents selection. Server does NOT enforce availability. |
| DL-007 | Search filters correctly | ✅ PASS (unit) | 30+ unit tests verify client-side search |
| DL-008 | Design Family filter works | ✅ PASS (unit + data) | Data + unit tests confirm |
| DL-009 | Wall Geometry filter works | ✅ PASS (unit + data) | Data + unit tests confirm |
| DL-010 | Availability filter works | ✅ PASS (unit) | Unit tests verify filter states |
| DL-011 | Preview opens with correct data | ✅ PASS (unit) | Component tests verify data binding |
| DL-012 | Preview Select only for AVAILABLE | ✅ PASS (unit) | Component tests verify disabled state |
| DL-013 | Server-side ACTIVE filtering cannot be bypassed | ❌ FAIL / SECURITY OBSERVATION | RLS `USING(true)` allows Consultant to read DRAFT templates via direct API. Project creation still protected. |
| DL-014 | Existing project snapshot flow unchanged | ✅ PASS | Project/snapshot/finalized state intact |

---

## Security Findings

### DL-006: Server-Side Availability Not Enforced

**Current behavior:**
- UI: BLOCKED templates have disabled Select button (client protection)
- Server: `create_project` RPC checks `status = 'ACTIVE'` only
- Server does NOT check: SKU ACTIVE status, Catalogue READY status, dependency chain validity

**Impact:** A direct API caller (bypassing UI) could create a project from a template with blocked dependencies. The snapshot would contain stale SKU references. Downstream BOM calculations would still work from the snapshot data, but the template's dependency integrity guarantee is bypassed.

**Classification:** P1 hardening. Not a release blocker because:
1. Snapshot isolation means the BOM calculates from frozen data regardless
2. The actual SKU data in the snapshot was valid at publication time
3. Availability degradation happens post-publication (SKU deactivated later)

### DL-013: DRAFT Template Disclosure to Consultants

**Current behavior:**
- RLS SELECT policy on `template` table: `USING(true)` (all authenticated can read all)
- Application filters `WHERE status = 'ACTIVE'` — but this is query-level, not RLS-level
- Direct PostgREST query without status filter exposes DRAFT/RETIRED template names

**Impact:** Information disclosure only. Consultant can see template names/metadata but cannot create projects from non-ACTIVE templates (`create_project` enforces `status = 'ACTIVE'`).

**Classification:** P2 hardening. Not privilege escalation, only information disclosure.

---

## Hardening Backlog

### DL-HARDEN-001: Server-side availability enforcement
- **Priority:** P1
- **Owner:** SYSTEM
- **Rule:** `create_project` must reject templates whose dependency chain contains inactive SKUs or non-READY catalogue entries
- **Implementation:** Add availability check inside the RPC before project creation

### DL-HARDEN-002: Restrict template visibility by publication status
- **Priority:** P2
- **Owner:** ADMIN / SECURITY
- **Rule:** CONSULTANT SELECT must only expose `status = 'ACTIVE'` templates via RLS
- **Implementation:** Change RLS SELECT policy for CONSULTANT role to `USING(status = 'ACTIVE' OR current_user_role() IN ('DESIGNER','ADMIN'))`

### DL-HARDEN-003: Direct PostgREST/RPC bypass tests
- **Priority:** P1
- **Cases:**
  - Blocked template → `create_project` rejected
  - DRAFT template → `create_project` rejected ✅ (already enforced)
  - DRAFT template → Consultant SELECT denied/hidden
  - Inactive SKU → project creation rejected
  - Incomplete catalogue → project creation rejected

---

## Summary

| Metric | Value |
|--------|-------|
| Tests passed | 12/14 |
| Security observations | 2 |
| Regressions | 0 |
| New unit tests | 61 |
| Total test suite | 1,205 |
| Build | ✅ Pass |
| Production code (mvp-v1.0.1-hardened) | Unchanged |
