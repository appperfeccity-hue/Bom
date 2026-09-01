# P0 Remaining Test Backlog - Post-Release Automation

**Release Tag:** `mvp-v1.0.1-hardened`
**Supabase Project:** `fbiemsbykrmrbqcsobvh`
**Target URL:** `bom-beryl.vercel.app`
**Branch:** `feat/db-baseline-v1.1.5`
**Document Created:** 2026-08-15
**Architecture Status:** FROZEN - no modifications to released baseline

---

## Summary

| Metric | Value |
|--------|-------|
| Total remaining P0 tests | 153 |
| P0-A (Security and Authorization) | 58 |
| P0-B (Data Integrity and Deterministic Output) | 54 |
| P0-C (User-Facing Functional Behavior) | 41 |
| Automation method: Playwright API | 72 |
| Automation method: Playwright Browser | 41 |
| Automation method: Live SQL | 28 |
| Automation method: Hybrid (API + DB assertion) | 12 |
| Execution order | P0-A then P0-B then P0-C |
| Estimated total effort | 8-12 engineering days |

---

## ALREADY VERIFIED LIVE

The following were verified against the live Supabase database (`fbiemsbykrmrbqcsobvh`) during the `mvp-v1.0.1-hardened` release:

### 22 P0 SQL Tests (Direct Database Execution)

| Test ID | Description | Evidence Type |
|---------|-------------|---------------|
| T-RLS-01 | All 34 tables have RLS enabled | SQL query + row count |
| T-RLS-02 | Authenticated role has schema USAGE | pg_has_schema_privilege assertion |
| T-RLS-03 | Every table has at least one policy | pg_policies count per table |
| T-RLS-04 | current_user_role() helper exists | Function invocation |
| T-RLS-05 | Minimum policy count threshold (151) | Aggregate count |
| T-RLS-06 | Anon role has NO access to perfecity schema | Privilege denial assertion |
| T-RLS-07 | Snapshot has no UPDATE policy | Policy absence check |
| T-RLS-08 | Master BOM DESIGNER UPDATE is ownership-scoped | Policy WHERE clause inspection |
| T-RLS-09 | DESIGNER SELECT on final_bom/final_bom_line | Policy existence check |
| T-RLS-10 | Audit event has no INSERT policy for non-service | Policy filter verification |
| T1 | One SKU assigned to zone | INSERT + SELECT |
| T2 | Second SKU same zone rejected | INSERT failure + error code |
| T3 | Duplicate same SKU same zone rejected | INSERT failure + error code |
| T4 | Alternative SKU via template_zone_alternative | INSERT + relationship check |
| T5 | Template lifecycle activation/demotion | Multi-step state transitions |
| T6 | P1-01 catalogue entry validation | INSERT valid/invalid per type |
| T7 | P1-02 measurement supersession | Trigger-driven state reset |
| TRG-SNAP | Snapshot immutability trigger | UPDATE/DELETE rejection |
| TRG-FINAL | Final BOM immutability trigger | UPDATE/DELETE rejection |
| TRG-FINAL-LINE | Final BOM line immutability | UPDATE/DELETE rejection |
| TRG-AUDIT | Audit append-only trigger | UPDATE/DELETE rejection |
| TRG-CAT | Catalogue entry status immutability | UPDATE rejection |

### 50 Vitest P0 Tests (Engine Logic Verification)

| Suite | Count | Layer Proven |
|-------|-------|-------------|
| BOM Determinism | 10 | Engine logic: same input produces same SHA-256 hash |
| Transaction Atomicity | 13 | Engine logic: error conditions produce 0 BOM lines |
| Finalization Concurrency | 20 | Store logic: double-submit guards, state machine |
| Template Validation | 7 | Store logic: ACTIVE enforcement, lifecycle rules |

### 19-Step Production Smoke Test (API-Level Lifecycle)

Verified end-to-end project lifecycle through API calls against the live environment.

### 1,144 Regression Tests (Vitest, All Engines/Stores/Components)

These cover engine logic, store behavior, and component rendering but do NOT constitute live verification of database enforcement, RLS policies, or authenticated request flows.

---

## COVERAGE DISTINCTION

### What Vitest Tests Prove

- Engine computation logic (BOM calculation, frame generation, trim, lighting)
- Store state management (Zustand state machines, action handlers)
- Component rendering (React component trees, user interactions in jsdom)
- Error catalogue compliance (correct error codes thrown)
- Validation rule enforcement (input validation, schema checks)

### What Vitest Tests Do NOT Prove

- RLS policy enforcement on live database
- Cross-tenant data isolation
- JWT-based role resolution in Supabase
- Real HTTP request/response cycles through Vercel edge functions
- Database trigger execution under concurrent load
- Browser rendering, accessibility, and visual correctness
- Real authentication flow (login, token refresh, session expiry)
- Network error handling in production conditions
- Supabase Realtime subscription behavior

### What "Live Verified" Means

A test is live-verified ONLY when ALL of the following are true:

1. A real authenticated request was sent to the production/staging URL
2. The request traversed real RLS policies on the real database
3. The response was captured and matches the expected result
4. Evidence exists (response payload, DB assertion, screenshot, trace)
5. A complete four-question evidence package (see Evidence Model below) is filed

**Critical Rule:** `PASS without evidence = not verified. Automated pass without live execution = not live verified.`


---

## P0-A: SECURITY AND AUTHORIZATION (58 tests)

### 1. RBAC Remaining Actions (SS5) - 18 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| RBAC-001 | SS5 | P0-A | DESIGNER can create template | API | Vitest templateManagementStore covers store logic | Live API call with DESIGNER JWT must succeed | Authenticated DESIGNER user, valid tenant | 1. Login as designer@perfeccity.test 2. POST /rest/v1/template with valid payload 3. Assert 201 response | HTTP 201, row visible in DB with correct tenant_id | Response payload + DB query | Auth fixture (DESIGNER JWT), seed tenant | Not started | DESIGNER workflow blocked if fails |
| RBAC-002 | SS5 | P0-A | CONSULTANT cannot create template | API | Vitest usePermissionEnforcement covers UI guard | Live API call with CONSULTANT JWT must be rejected by RLS | Authenticated CONSULTANT user | 1. Login as consultant@perfeccity.test 2. POST /rest/v1/template with valid payload 3. Assert rejection | HTTP 403 or empty result (RLS silent deny) | Response status + empty result set | Auth fixture (CONSULTANT JWT) | Not started | Data leak if CONSULTANT can create templates |
| RBAC-003 | SS5 | P0-A | ADMIN can read all templates across tenants | API | No live coverage | Live API call with ADMIN JWT returns cross-tenant data | Authenticated ADMIN user, multiple tenants with templates | 1. Login as admin@perfeccity.test 2. GET /rest/v1/template 3. Assert results include multiple tenant_ids | HTTP 200, results contain rows from multiple tenants | Response payload showing multiple tenant_ids | Auth fixture (ADMIN JWT), multi-tenant seed | Not started | Admin oversight broken if fails |
| RBAC-004 | SS5 | P0-A | DESIGNER cannot read other tenant templates | API | No live coverage | Live API call must return only own-tenant rows | Two tenants each with templates, DESIGNER in tenant A | 1. Login as designer (tenant A) 2. GET /rest/v1/template 3. Assert all rows have tenant A ID | HTTP 200, zero rows from tenant B | Response payload, row tenant_id check | Multi-tenant seed data | Not started | Cross-tenant data exposure |
| RBAC-005 | SS5 | P0-A | DESIGNER can UPDATE own template | API | Vitest templateManagementStore | Live PATCH must succeed | DESIGNER owns template | 1. Login as designer 2. PATCH /rest/v1/template?id=eq.{own_id} 3. Assert success | HTTP 200/204, row updated in DB | Response + DB before/after | Auth fixture, owned template | Not started | Template editing broken |
| RBAC-006 | SS5 | P0-A | DESIGNER cannot UPDATE other designer template | API | No live coverage | Live PATCH must fail silently (0 rows affected) | Two designers, template owned by designer B | 1. Login as designer A 2. PATCH /rest/v1/template?id=eq.{other_id} 3. Assert 0 rows affected | HTTP 200 with 0 rows modified | Response + DB unchanged | Two designer accounts, cross-ownership seed | Not started | Unauthorized modification |
| RBAC-007 | SS5 | P0-A | CONSULTANT can read assigned project | API | Vitest permissions store | Live GET must return project data | CONSULTANT assigned to project via template_consultant_permission | 1. Login as consultant 2. GET /rest/v1/project?id=eq.{assigned} 3. Assert data returned | HTTP 200, project data present | Response payload | Consultant assignment seed | Not started | Consultant workflow blocked |
| RBAC-008 | SS5 | P0-A | CONSULTANT cannot read unassigned project | API | No live coverage | Live GET must return empty | CONSULTANT not assigned to target project | 1. Login as consultant 2. GET /rest/v1/project?id=eq.{unassigned} 3. Assert empty | HTTP 200, empty array | Response payload (empty) | Two projects, one assigned | Not started | Cross-project data exposure |
| RBAC-009 | SS5 | P0-A | DESIGNER can approve Master BOM for own template | API | Vitest bomStore | Live PATCH status to APPROVED must succeed | DESIGNER owns template with Master BOM | 1. Login as designer 2. PATCH master_bom status to APPROVED 3. Assert success | HTTP 200/204, status changed | Response + DB state | Template + Master BOM seed | Not started | BOM approval workflow broken |
| RBAC-010 | SS5 | P0-A | DESIGNER cannot approve Master BOM for other template | API | No live coverage | Live PATCH must fail (RLS ownership scope) | Master BOM on template owned by another designer | 1. Login as designer A 2. PATCH master_bom owned by designer B 3. Assert failure | 0 rows affected | Response + DB unchanged | Cross-ownership seed | Not started | Unauthorized BOM approval |
| RBAC-011 | SS5 | P0-A | CONSULTANT can INSERT project_configuration | API | No live coverage | Live POST must succeed for assigned project | CONSULTANT assigned to project | 1. Login as consultant 2. POST project_configuration for assigned project 3. Assert 201 | HTTP 201, row created | Response + DB | Consultant + project assignment | Not started | Configuration workflow blocked |
| RBAC-012 | SS5 | P0-A | CONSULTANT cannot INSERT project_configuration for unassigned project | API | No live coverage | Live POST must be rejected | CONSULTANT not assigned to target project | 1. Login as consultant 2. POST project_configuration for unassigned project 3. Assert rejection | HTTP 403 or RLS deny | Response status | Two projects, mismatched assignment | Not started | Unauthorized configuration |
| RBAC-013 | SS5 | P0-A | ADMIN can DELETE any template | API | No live coverage | Live DELETE with ADMIN JWT must succeed | ADMIN user, existing template | 1. Login as admin 2. DELETE /rest/v1/template?id=eq.{any} 3. Assert success | HTTP 200/204, row removed | Response + DB absence check | Admin auth, expendable template | Not started | Admin cannot manage data |
| RBAC-014 | SS5 | P0-A | CONSULTANT cannot DELETE template | API | No live coverage | Live DELETE must fail | CONSULTANT user, existing template | 1. Login as consultant 2. DELETE /rest/v1/template?id=eq.{any} 3. Assert rejection | 0 rows affected or 403 | Response | Auth fixture | Not started | Unauthorized deletion |
| RBAC-015 | SS5 | P0-A | DESIGNER can INSERT project (create) | API | Vitest projectCreationStore | Live POST must succeed | DESIGNER with ACTIVE template | 1. Login as designer 2. POST /rest/v1/rpc/create_project 3. Assert success | HTTP 200, project + snapshot created | Response + DB state | Active template seed | Not started | Project creation broken |
| RBAC-016 | SS5 | P0-A | CONSULTANT can INSERT project_measurement | API | No live coverage | Live POST must succeed for assigned project | CONSULTANT assigned to project | 1. Login as consultant 2. POST project_measurement 3. Assert 201 | HTTP 201, measurement row created | Response + DB | Project assignment seed | Not started | Measurement workflow blocked |
| RBAC-017 | SS5 | P0-A | Service role can INSERT audit_event | DB | No live coverage | Direct DB call with service_role key must succeed | Service role key available | 1. Use service_role key 2. INSERT audit_event 3. Assert success | Row created | DB query | Service role key | Not started | Audit trail broken |
| RBAC-018 | SS5 | P0-A | Authenticated user cannot INSERT audit_event | API | No live coverage | Live POST with user JWT must be rejected | Any authenticated user | 1. Login as any user 2. POST /rest/v1/audit_event 3. Assert rejection | HTTP 403 or RLS deny | Response | Auth fixture | Not started | Audit trail pollution |


### 2. RLS/Security (SS6) - 14 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| RLS-001 | SS6 | P0-A | Anon role cannot access perfecity schema | DB | T-RLS-06 verified | Already verified, document evidence | N/A | N/A | N/A | SQL test output | N/A | Executed | Public data exposure |
| RLS-002 | SS6 | P0-A | Cross-tenant SELECT isolation for project | API | No live coverage | Authenticated user from tenant A cannot see tenant B projects | Two tenants with projects | 1. Login as tenant A user 2. GET /rest/v1/project 3. Assert only tenant A rows | Zero tenant B rows in response | Response payload analysis | Multi-tenant seed | Not started | Cross-tenant data leak |
| RLS-003 | SS6 | P0-A | Cross-tenant SELECT isolation for actual_bom | API | No live coverage | Tenant A cannot see tenant B BOMs | Two tenants with BOMs | 1. Login as tenant A 2. GET /rest/v1/actual_bom 3. Filter for tenant B project | Empty result | Response payload | Multi-tenant BOM seed | Not started | BOM data leak |
| RLS-004 | SS6 | P0-A | Cross-tenant SELECT isolation for final_bom | API | No live coverage | Tenant A cannot see tenant B final BOMs | Two tenants with final BOMs | 1. Login as tenant A 2. GET /rest/v1/final_bom 3. Assert isolation | Empty result for other tenant | Response payload | Multi-tenant finalization seed | Not started | Finalized BOM data leak |
| RLS-005 | SS6 | P0-A | RLS silent deny (no error leakage) | API | No live coverage | Unauthorized requests return empty, not error details | Unauthorized user | 1. Attempt access to forbidden resource 2. Assert HTTP 200 with empty array (not 403 with details) | HTTP 200, empty body, no schema/table names leaked | Full response inspection | Auth fixture | Not started | Information disclosure |
| RLS-006 | SS6 | P0-A | JWT role extraction via current_user_role() | DB | T-RLS-04 verified helper exists | Need to verify correct role returned for each test user | Three test users with different roles | 1. Call current_user_role() as each user 2. Assert correct role string | DESIGNER/CONSULTANT/ADMIN respectively | Function return values | Auth fixtures for all three roles | Not started | All RBAC broken if role extraction fails |
| RLS-007 | SS6 | P0-A | Expired JWT rejected | API | No live coverage | Request with expired token must fail | Expired JWT token | 1. Construct expired JWT 2. Send authenticated request 3. Assert 401 | HTTP 401 | Response status | Expired token generator | Not started | Session hijacking risk |
| RLS-008 | SS6 | P0-A | Malformed JWT rejected | API | No live coverage | Request with invalid JWT must fail | Malformed JWT string | 1. Send request with garbage Authorization header 2. Assert 401 | HTTP 401 | Response status | N/A | Not started | Authentication bypass |
| RLS-009 | SS6 | P0-A | Missing JWT treated as anon (no access) | API | No live coverage | Unauthenticated request gets no data | No auth header | 1. GET /rest/v1/template without auth 2. Assert empty/forbidden | HTTP 401 or empty result | Response | N/A | Not started | Unauthenticated data access |
| RLS-010 | SS6 | P0-A | Policy count matches expected (151) | DB | T-RLS-05 verified | Already verified, document evidence | N/A | N/A | N/A | SQL count result | N/A | Executed | Missing policies |
| RLS-011 | SS6 | P0-A | UPDATE policy absence on project_snapshot | DB | T-RLS-07 verified | Already verified, need API-level confirmation | Existing snapshot | 1. Login as any role 2. PATCH project_snapshot 3. Assert failure | 0 rows affected or rejection | Response + DB unchanged | Snapshot seed | Not started | Snapshot mutability |
| RLS-012 | SS6 | P0-A | Tenant isolation on sku_master (shared read) | API | No live coverage | All tenants can read SKU master data | Multiple tenants | 1. Login as any tenant user 2. GET /rest/v1/sku_master 3. Assert full catalogue visible | HTTP 200, all SKUs returned | Response row count | SKU seed data | Not started | Catalogue access broken |
| RLS-013 | SS6 | P0-A | Horizontal privilege escalation prevented | API | No live coverage | User cannot access resources by guessing IDs | Known resource UUID from another tenant | 1. Login as tenant A 2. GET /rest/v1/project?id=eq.{tenant_B_uuid} 3. Assert empty | Empty result | Response payload | Known cross-tenant UUID | Not started | Direct object reference vulnerability |
| RLS-014 | SS6 | P0-A | Bulk extraction prevented | API | No live coverage | Large SELECT without filter returns only own-tenant | User with valid JWT | 1. Login 2. GET /rest/v1/project (no filter) 3. Assert only own-tenant returned | Result set bounded to own tenant | Response count + tenant_id check | Multi-tenant seed | Not started | Mass data extraction |


### 3. Permission Enforcement (SS17) - 10 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| PERM-001 | SS17 | P0-A | template_consultant_permission grants access | API | Vitest usePermissionEnforcement | Live: consultant with permission can access project | Permission row exists | 1. Create permission 2. Login as consultant 3. Access project 4. Assert success | HTTP 200, data returned | Response payload | Permission seed | Not started | Consultant access broken |
| PERM-002 | SS17 | P0-A | Revoked permission immediately denies access | API | No live coverage | Removing permission row instantly blocks access | Previously granted permission | 1. Delete permission row 2. Consultant attempts access 3. Assert denied | Empty result / 0 rows | Response after revocation | Permission lifecycle seed | Not started | Stale permissions persist |
| PERM-003 | SS17 | P0-A | Permission scoped to specific template | API | No live coverage | Permission for template A does not grant access to template B | Multiple templates, permission on one | 1. Grant permission on template A 2. Consultant accesses template B project 3. Assert denied | Empty for template B, data for template A | Two response comparisons | Multi-template seed | Not started | Over-broad permission |
| PERM-004 | SS17 | P0-A | DESIGNER cannot grant permissions on non-owned template | API | No live coverage | INSERT on template_consultant_permission fails for non-owner | Template owned by another designer | 1. Login as designer A 2. INSERT permission on designer B template 3. Assert failure | RLS deny / 0 rows affected | Response | Cross-ownership seed | Not started | Unauthorized permission grant |
| PERM-005 | SS17 | P0-A | ADMIN can grant permissions on any template | API | No live coverage | ADMIN INSERT on any template_consultant_permission succeeds | ADMIN user, any template | 1. Login as admin 2. INSERT permission 3. Assert success | HTTP 201 | Response + DB | Admin auth | Not started | Admin cannot manage permissions |
| PERM-006 | SS17 | P0-A | Permission does not grant write to template itself | API | No live coverage | Consultant with permission cannot UPDATE the template | Consultant with read permission | 1. Login as consultant with permission 2. PATCH template 3. Assert failure | 0 rows affected | Response + DB unchanged | Permission + template seed | Not started | Template modification by consultant |
| PERM-007 | SS17 | P0-A | Permission allows measurement INSERT | API | No live coverage | Consultant with permission can submit measurements | Project on permitted template | 1. Login as consultant 2. POST project_measurement 3. Assert success | HTTP 201 | Response + DB | Full permission chain | Not started | Measurement submission blocked |
| PERM-008 | SS17 | P0-A | Multiple consultants can have permission on same template | API | No live coverage | Two consultants both access the same template projects | Two permission rows, different consultants | 1. Create two permissions 2. Both consultants access 3. Both succeed | Both get HTTP 200 with data | Two response payloads | Multi-consultant seed | Not started | Multi-consultant collaboration broken |
| PERM-009 | SS17 | P0-A | Permission deleted when template deleted | DB | No live coverage | CASCADE or trigger removes permissions on template deletion | Template with permissions | 1. DELETE template 2. Query template_consultant_permission 3. Assert zero rows | Zero permission rows remain | DB query | Template with permissions | Not started | Orphaned permissions |
| PERM-010 | SS17 | P0-A | Finalization permission check | API | Vitest finalizationStore | Live: only authorized role can finalize | Consultant assigned, project ready | 1. Login as consultant 2. Call finalization RPC 3. Assert success or correct denial based on role | Correct finalization behavior | Response + final_bom state | Full project lifecycle seed | Not started | Unauthorized finalization |


### 4. Snapshot Isolation (SS7) - 10 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| SNAP-001 | SS7 | P0-A | Snapshot created at project creation | API | Vitest projectCreationStore | Live: project creation produces snapshot row | ACTIVE template | 1. Create project via RPC 2. Query project_snapshot for project 3. Assert exists | Snapshot row present with correct template data | DB query result | Project creation seed | Not started | Missing snapshot = broken audit trail |
| SNAP-002 | SS7 | P0-A | Snapshot is byte-for-byte immutable (UPDATE rejected) | DB | TRG-SNAP verified at DB level | Need API-level confirmation | Existing snapshot | 1. Login as any role 2. PATCH project_snapshot 3. Assert trigger rejection | Error or 0 rows (trigger fires) | Response + error message | Snapshot seed | Not started | Snapshot corruption |
| SNAP-003 | SS7 | P0-A | Snapshot is immutable (DELETE rejected) | DB | TRG-SNAP verified at DB level | Need API-level confirmation | Existing snapshot | 1. Login as any role 2. DELETE project_snapshot 3. Assert trigger rejection | Error or 0 rows | Response | Snapshot seed | Not started | Snapshot deletion = audit loss |
| SNAP-004 | SS7 | P0-A | Snapshot contains correct template version | API | Vitest snapshotBuilder | Live: snapshot payload matches template at creation time | Template with known state | 1. Create project 2. Modify template 3. Compare snapshot to pre-modification state | Snapshot reflects pre-modification template | Snapshot data vs template data comparison | Template + project seed | Not started | Wrong template version in snapshot |
| SNAP-005 | SS7 | P0-A | Template modification after snapshot does not affect project | API | No live coverage | Post-creation template changes do not propagate | Project with snapshot | 1. Create project 2. Modify template zone 3. Re-read project snapshot 4. Assert unchanged | Snapshot unchanged after template edit | Two reads comparison | Full lifecycle seed | Not started | Snapshot isolation failure |
| SNAP-006 | SS7 | P0-A | Snapshot references frozen rule_set version | API | No live coverage | Rule set captured at creation time | Rule set exists | 1. Create project 2. Query snapshot rule_set reference 3. Assert matches current at creation | Correct rule_set_id in snapshot | DB query | Rule set + template seed | Not started | Wrong calculation rules applied |
| SNAP-007 | SS7 | P0-A | Multiple projects from same template get independent snapshots | API | No live coverage | Each project has its own snapshot row | Same template, two projects | 1. Create project A 2. Create project B 3. Query snapshots 4. Assert distinct rows | Two distinct snapshot IDs | DB query showing two rows | Template + two creations | Not started | Shared snapshot = corruption risk |
| SNAP-008 | SS7 | P0-A | Snapshot matches template_zone data exactly | API | No live coverage | Zone geometry/SKU data in snapshot matches template at creation | Template with zones | 1. Create project 2. Compare snapshot zone data to template zone data | Exact match | Data comparison | Template with zones seed | Not started | Incorrect project baseline |
| SNAP-009 | SS7 | P0-A | No RLS UPDATE policy exists on project_snapshot | DB | T-RLS-07 verified | Already verified | N/A | N/A | N/A | SQL policy query | N/A | Executed | Snapshot mutability at RLS layer |
| SNAP-010 | SS7 | P0-A | Concurrent project creation produces independent snapshots | API | Vitest finalizationConcurrency (logic) | Live concurrent requests each produce correct snapshot | ACTIVE template | 1. Send 5 concurrent create_project calls 2. Assert each produces unique snapshot | 5 distinct snapshots with idempotency | Response payloads + DB count | Concurrency test harness | Not started | Race condition in snapshot creation |

### 5. Error Contracts (SS35) - 6 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| ERR-001 | SS35 | P0-A | RLS denial returns standard error shape | API | Vitest errorCatalogue (logic) | Live: denied request returns consistent error structure | Unauthorized user | 1. Trigger RLS denial 2. Inspect response body shape | Consistent JSON error shape (no stack trace, no schema leak) | Full response body | Auth fixture | Not started | Error information disclosure |
| ERR-002 | SS35 | P0-A | Trigger rejection returns correct SQLSTATE | API | No live coverage | DB trigger errors surface as correct HTTP error | Attempt immutable mutation | 1. Attempt snapshot UPDATE via API 2. Assert error code in response | Specific error code, not generic 500 | Response body with error code | Snapshot seed | Not started | Opaque errors, bad DX |
| ERR-003 | SS35 | P0-A | Validation error returns field-level detail | API | Vitest validationEngine | Live: invalid input returns field + message | Invalid payload | 1. POST with missing required field 2. Assert error includes field name | Error response with field identifier | Response body | N/A | Not started | User cannot fix input errors |
| ERR-004 | SS35 | P0-A | Idempotency conflict returns 409 | API | Vitest finalizationConcurrency | Live: duplicate idempotency key returns 409 | Previous request with same key | 1. Submit finalization with key K 2. Resubmit with same key K 3. Assert 409 | HTTP 409 Conflict | Response status + body | Idempotency seed | Not started | Silent duplicate processing |
| ERR-005 | SS35 | P0-A | Rate-limited request returns 429 | API | No live coverage | Excessive requests return 429 | N/A | 1. Send 100 rapid requests 2. Assert eventual 429 | HTTP 429 with retry-after | Response headers | Rate limit testing harness | Not started | DoS vulnerability |
| ERR-006 | SS35 | P0-A | Internal error does not leak implementation details | API | No live coverage | 500-level errors contain no stack traces | Force internal error condition | 1. Trigger server error 2. Inspect response body 3. Assert no file paths, line numbers | Generic error message only | Response body analysis | Error trigger mechanism | Not started | Information disclosure |


---

## P0-B: DATA INTEGRITY AND DETERMINISTIC OUTPUT (54 tests)

### 6. Canonical JSON/Hash (SS30) - 8 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| HASH-001 | SS30 | P0-B | BOM output is canonical JSON (sorted keys) | API | Vitest bomDeterminism (logic) | Live: actual API response has sorted keys | Generated BOM | 1. Generate BOM via API 2. Parse response 3. Assert key ordering is alphabetical | Keys in alphabetical order | Raw JSON response | BOM generation seed | Not started | Non-deterministic hash |
| HASH-002 | SS30 | P0-B | Same input produces identical SHA-256 hash | API | Vitest bomDeterminism 10x repeat | Live: 10 API calls produce same hash | Stable input data | 1. Call BOM generation 10x with identical input 2. Compute SHA-256 of each response 3. Assert all equal | 10 identical hashes | Hash values list | Stable seed data | Not started | BOM non-determinism |
| HASH-003 | SS30 | P0-B | Different input produces different hash | API | Vitest bomDeterminism | Live: changed input changes hash | Two different configurations | 1. Generate BOM with config A 2. Generate BOM with config B 3. Assert different hashes | Two distinct hashes | Both hashes | Two config seeds | Not started | Hash collision / ignoring input |
| HASH-004 | SS30 | P0-B | Hash stored in actual_bom row | API | No live coverage | Live: hash persisted to database | Generated BOM | 1. Generate BOM 2. Query actual_bom row 3. Assert hash column populated | Non-null hash in DB | DB query result | BOM seed | Not started | Missing audit hash |
| HASH-005 | SS30 | P0-B | Hash in final_bom matches actual_bom source | API | No live coverage | Finalization preserves hash from actual | Finalized BOM | 1. Generate actual BOM 2. Record hash 3. Finalize 4. Compare final_bom hash | Hashes match | Both hash values | Full lifecycle seed | Not started | Hash mismatch = integrity failure |
| HASH-006 | SS30 | P0-B | No floating point in BOM output | API | Vitest bomDeterminism | Live: all numeric values are integer or fixed decimal | Generated BOM lines | 1. Generate BOM 2. Inspect all numeric fields 3. Assert no IEEE 754 artifacts | No values like 0.30000000000000004 | Raw BOM line inspection | BOM seed | Not started | Cross-platform hash mismatch |
| HASH-007 | SS30 | P0-B | Unicode normalization in string fields | API | No live coverage | Live: BOM strings are NFC normalized | BOM with Unicode SKU names | 1. Generate BOM with Unicode input 2. Assert NFC form in output | Consistent Unicode normalization | Byte comparison | Unicode test data | Not started | Hash mismatch across systems |
| HASH-008 | SS30 | P0-B | Null fields have consistent representation | API | Vitest bomDeterminism | Live: null fields consistently omitted or null-valued | BOM with optional fields | 1. Generate BOM 2. Check null handling consistency 3. Assert same pattern across runs | Consistent null representation | Multiple response comparison | BOM seed | Not started | Non-deterministic serialization |

### 7. Golden Fixtures (SS45) - 8 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| GOLD-001 | SS45 | P0-B | Wall panel golden fixture matches | API | Vitest bomPipeline | Live: wall panel BOM output matches frozen golden file | Golden fixture file, matching input | 1. Generate BOM with golden input 2. Compare output to golden fixture byte-for-byte | Exact match | Diff output (empty) | Golden fixture files | Not started | Engine regression |
| GOLD-002 | SS45 | P0-B | Lighting golden fixture matches | API | Vitest lightEngine | Live: lighting BOM output matches frozen golden | Golden lighting fixture | 1. Generate BOM with lighting input 2. Compare to golden | Exact match | Diff output | Golden fixtures | Not started | Lighting calculation regression |
| GOLD-003 | SS45 | P0-B | Furniture golden fixture matches | API | Vitest furnitureEngine | Live: furniture BOM matches golden | Golden furniture fixture | 1. Generate BOM with furniture 2. Compare | Exact match | Diff output | Golden fixtures | Not started | Furniture engine regression |
| GOLD-004 | SS45 | P0-B | Trim golden fixture matches | API | Vitest bomPipeline trim cases | Live: trim BOM matches golden | Golden trim fixture | 1. Generate BOM with trim 2. Compare | Exact match | Diff output | Golden fixtures | Not started | Trim engine regression |
| GOLD-005 | SS45 | P0-B | Hidden component golden fixture matches | API | Vitest hiddenComponentEngine | Live: hidden component output matches golden | Golden hidden component fixture | 1. Generate BOM with hidden components 2. Compare | Exact match | Diff output | Golden fixtures | Not started | Hidden component regression |
| GOLD-006 | SS45 | P0-B | Full template golden fixture (all components) | API | Vitest bomPipelineIntegration | Live: complete BOM matches golden | Full golden fixture | 1. Generate complete BOM 2. Compare to golden | Exact match | Diff output | Complete golden fixture | Not started | Multi-component regression |
| GOLD-007 | SS45 | P0-B | Golden fixture update detection | API | No live coverage | Changed output vs golden is detected and reported | Modified engine output | 1. Introduce known change 2. Compare to golden 3. Assert diff detected | Non-empty diff reported | Diff content | Golden fixture + change detection | Not started | Silent regression |
| GOLD-008 | SS45 | P0-B | Golden fixture versioning | API | No live coverage | Golden files tagged to release version | Golden files in repo | 1. Verify golden files have release tag 2. Assert match to mvp-v1.0.1-hardened | Files present and tagged | Git tag verification | Repository tag | Not started | Golden files drift from release |


### 8. Frame Generation (SS19) - 8 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| FRAME-001 | SS19 | P0-B | Frame count matches wall length / panel width | API | Vitest wallPanelEngine | Live: frame generation produces correct count | Known wall length + panel width | 1. Configure wall 3000mm / panel 600mm 2. Generate BOM 3. Assert 5 frames | Exactly 5 frame lines | BOM line count | Wall configuration seed | Not started | Wrong material quantity |
| FRAME-002 | SS19 | P0-B | Partial frame handling (remainder) | API | Vitest wallPanelEngine | Live: non-exact-multiple produces correct cut piece | Wall 3200mm / panel 600mm | 1. Configure wall 2. Generate BOM 3. Assert cut piece or additional frame | Correct remainder handling per spec | BOM lines | Non-exact measurement | Not started | Material waste or shortage |
| FRAME-003 | SS19 | P0-B | Zero-length wall produces zero frames | API | Vitest validation | Live: edge case handled | Invalid zero-length input | 1. Submit zero-length wall 2. Assert validation error or 0 frames | Validation error (not 0 frames silently) | Error response | Edge case input | Not started | Silent incorrect output |
| FRAME-004 | SS19 | P0-B | Maximum wall length produces correct frames | API | No live coverage | Live: large wall does not overflow | Wall at maximum allowed length | 1. Configure max-length wall 2. Generate BOM 3. Assert correct count | Correct frame count, no overflow | BOM lines | Max-length seed | Not started | Integer overflow / incorrect calc |
| FRAME-005 | SS19 | P0-B | Frame SKU references valid catalogue entry | API | Vitest bomPipeline | Live: frame BOM lines have valid sku_id | Generated frames | 1. Generate BOM 2. For each frame line, verify sku_id exists in catalogue | All sku_ids resolve | DB join verification | Catalogue seed | Not started | Broken SKU reference |
| FRAME-006 | SS19 | P0-B | Frame ordering is deterministic | API | Vitest bomDeterminism | Live: frame lines always in same order | Same input | 1. Generate BOM 5x 2. Compare frame line ordering | Identical order each time | 5 BOM outputs | Stable seed | Not started | Non-deterministic output |
| FRAME-007 | SS19 | P0-B | Frame dimensions match catalogue_asset_metadata | API | No live coverage | Frame width/height from catalogue propagated correctly | Catalogue with dimensions | 1. Generate BOM 2. Check frame dimensions against catalogue 3. Assert match | Dimensions match catalogue | Cross-reference | Catalogue asset seed | Not started | Wrong dimensions in BOM |
| FRAME-008 | SS19 | P0-B | Site-adapted frame generation | API | Vitest siteAdaptationEngine | Live: site measurements alter frame calculation | Project with measurements | 1. Add measurements 2. Generate actual BOM 3. Assert frames reflect actual dimensions | Frames based on actual, not template | BOM line comparison | Full lifecycle seed | Not started | Ignoring site measurements |

### 9. Trim Engine (SS20) - 8 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| TRIM-001 | SS20 | P0-B | Trim pieces generated for configured zones | API | Vitest bomPipeline trim | Live: trim BOM lines appear for zones with trim config | Template with trim | 1. Generate BOM 2. Filter trim lines 3. Assert present | Trim lines in BOM | BOM line filter | Trim template seed | Not started | Missing trim materials |
| TRIM-002 | SS20 | P0-B | Trim length matches zone perimeter | API | Vitest bomPipeline | Live: trim length calculation correct | Known zone dimensions | 1. Configure zone 1000x1000mm 2. Generate BOM 3. Assert trim length = 4000mm | Total trim length = 4 x side | BOM quantities | Known geometry seed | Not started | Wrong trim quantity |
| TRIM-003 | SS20 | P0-B | No trim for zones without trim configuration | API | No live coverage | Live: zones without trim produce no trim lines | Template with trim on zone A only | 1. Generate BOM 2. Assert no trim lines reference zone B | Zero trim lines for unconfigured zone | BOM line filter | Mixed trim seed | Not started | Spurious trim materials |
| TRIM-004 | SS20 | P0-B | Trim SKU matches template_trim configuration | API | No live coverage | Live: correct trim SKU used | Template_trim with specific SKU | 1. Generate BOM 2. Check trim line sku_id 3. Assert matches template_trim | SKU ID match | Cross-reference | Trim SKU seed | Not started | Wrong trim material |
| TRIM-005 | SS20 | P0-B | Trim quantity deterministic across runs | API | Vitest bomDeterminism | Live: 5 runs produce same trim quantities | Stable input | 1. Generate BOM 5x 2. Compare trim quantities | Identical trim quantities | 5 outputs | Stable seed | Not started | Non-deterministic trim |
| TRIM-006 | SS20 | P0-B | Site-adapted trim uses actual measurements | API | Vitest siteAdaptationEngine | Live: actual measurements change trim output | Project with measurements | 1. Set actual dimensions different from template 2. Generate actual BOM 3. Assert trim uses actual | Trim based on actual dimensions | BOM comparison | Full lifecycle seed | Not started | Trim ignores site adaptation |
| TRIM-007 | SS20 | P0-B | Trim accounts for door/window openings | API | No live coverage | Live: openings reduce trim length | Zone with opening configuration | 1. Configure zone with opening 2. Generate BOM 3. Assert reduced trim | Trim length reduced by opening width | Quantity check | Opening configuration seed | Not started | Over-ordering trim |
| TRIM-008 | SS20 | P0-B | Multiple trim types per zone | API | No live coverage | Live: zone with multiple trim types generates all | Template with multiple trim entries | 1. Configure two trim types on one zone 2. Generate BOM 3. Assert both present | Both trim SKUs in BOM | BOM line inspection | Multi-trim seed | Not started | Missing trim type |


### 10. Hidden Components (SS21) - 6 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| HIDDEN-001 | SS21 | P0-B | Hidden components added to BOM | API | Vitest hiddenComponentEngine | Live: hidden component lines present in BOM | Template with hidden components | 1. Generate BOM 2. Filter hidden component lines 3. Assert present | Hidden component lines in BOM | BOM filter | Hidden component seed | Not started | Missing construction materials |
| HIDDEN-002 | SS21 | P0-B | Hidden components not visible in Canvas UI | Browser | Vitest (logic only) | Live browser: hidden components not rendered | Project with hidden components | 1. Open Canvas in browser 2. Inspect rendered elements 3. Assert hidden components absent from visual | No visual representation | Screenshot + DOM inspection | Playwright browser, project seed | Not started | Confusing UI showing construction internals |
| HIDDEN-003 | SS21 | P0-B | Hidden component quantities are deterministic | API | Vitest bomDeterminism | Live: 5 runs same hidden quantities | Stable input | 1. Generate BOM 5x 2. Compare hidden component quantities | Identical quantities | 5 outputs | Stable seed | Not started | Non-deterministic hidden |
| HIDDEN-004 | SS21 | P0-B | Hidden components included in hash calculation | API | Vitest bomDeterminism | Live: removing hidden component changes hash | Two configs (with/without hidden) | 1. Generate BOM with hidden 2. Generate without 3. Assert different hashes | Different hashes | Two hash values | Two seed configs | Not started | Hidden components excluded from integrity |
| HIDDEN-005 | SS21 | P0-B | Hidden component SKU valid in catalogue | API | No live coverage | Live: hidden component sku_id resolves | Generated BOM | 1. Generate BOM 2. Check hidden component sku_ids against catalogue | All resolve | DB join | Catalogue seed | Not started | Invalid SKU reference |
| HIDDEN-006 | SS21 | P0-B | Site adaptation does not alter hidden component quantity | API | No live coverage | Live: hidden components based on template, not measurements | Project with measurements | 1. Set varied measurements 2. Generate actual BOM 3. Assert hidden unchanged from master | Same hidden quantities as master BOM | Master vs actual comparison | Full lifecycle seed | Not started | Hidden components incorrectly adapted |

### 11. Geometry Negatives (SS14) - 6 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| GEO-001 | SS14 | P0-B | Negative width rejected | API | Vitest validationEngine | Live: API rejects negative width | Invalid geometry input | 1. POST zone with width = -100 2. Assert validation error | Validation error with field name | Error response | N/A | Not started | Invalid geometry stored |
| GEO-002 | SS14 | P0-B | Negative height rejected | API | Vitest validationEngine | Live: API rejects negative height | Invalid geometry input | 1. POST zone with height = -50 2. Assert validation error | Validation error | Error response | N/A | Not started | Invalid geometry stored |
| GEO-003 | SS14 | P0-B | Zero-area zone rejected | API | Vitest validationEngine | Live: zone with 0 area rejected | Zero dimension input | 1. POST zone with width=0 or height=0 2. Assert rejection | Validation error | Error response | N/A | Not started | Division by zero in calculations |
| GEO-004 | SS14 | P0-B | Exceeding maximum dimension rejected | API | No live coverage | Live: overly large dimensions rejected | Max+1 dimension | 1. POST zone with width > maximum allowed 2. Assert rejection | Validation error with limit | Error response | N/A | Not started | Unrealistic geometry accepted |
| GEO-005 | SS14 | P0-B | Non-numeric dimension rejected | API | Vitest validationEngine | Live: string input for dimension rejected | String input | 1. POST zone with width="abc" 2. Assert 400 or validation error | Type error | Error response | N/A | Not started | Type coercion vulnerability |
| GEO-006 | SS14 | P0-B | Geometry values stored with correct precision | API | No live coverage | Live: stored values maintain mm precision | Valid geometry | 1. POST zone with width=1234.5 2. GET zone 3. Assert precision preserved | Exact value roundtrip | Request/response comparison | Zone seed | Not started | Precision loss |

### 12. Spacing/Fit Negatives (SS15) - 5 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| SPACE-001 | SS15 | P0-B | Panel wider than wall rejected | API | Vitest wallPanelEngine | Live: panel that exceeds wall width rejected | Panel wider than configured wall | 1. Configure zone narrower than panel width 2. Generate BOM 3. Assert validation error | Error: panel does not fit | Error response | Mismatched seed | Not started | Impossible installation |
| SPACE-002 | SS15 | P0-B | Overlapping zone boundaries rejected | API | Vitest zoneConstraints | Live: overlapping zones produce validation error | Two zones that overlap | 1. Configure overlapping zones 2. Assert validation error | Overlap error | Error response | Overlap seed | Not started | Physical impossibility |
| SPACE-003 | SS15 | P0-B | Negative gap between panels handled | API | No live coverage | Live: spacing calculation prevents negative gaps | Near-exact-fit configuration | 1. Configure wall where panels nearly fill 2. Assert no negative gap values | All gaps >= 0 | BOM spacing values | Near-exact seed | Not started | Negative material quantity |
| SPACE-004 | SS15 | P0-B | Total panel width matches wall width | API | Vitest wallPanelEngine | Live: sum of panels = wall length | Known dimensions | 1. Generate BOM 2. Sum panel widths 3. Assert equals wall length | Sum matches | Calculation | Known dimension seed | Not started | Material over/under |
| SPACE-005 | SS15 | P0-B | Minimum panel width enforced | API | No live coverage | Live: panel below minimum rejected | Below-minimum width | 1. Configure panel below minimum width 2. Assert validation | Minimum width error | Error response | N/A | Not started | Impractical cut piece |

### 13. Obstruction Negatives (SS16) - 5 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| OBS-001 | SS16 | P0-B | Obstruction larger than zone rejected | API | Vitest validationEngine | Live: obstruction exceeding zone boundaries rejected | Obstruction > zone | 1. Configure obstruction larger than zone 2. Assert validation error | Size validation error | Error response | Obstruction seed | Not started | Impossible layout |
| OBS-002 | SS16 | P0-B | Obstruction outside zone boundaries rejected | API | No live coverage | Live: out-of-bounds obstruction rejected | Obstruction coordinates outside zone | 1. Configure obstruction at negative/overflow position 2. Assert error | Position validation error | Error response | N/A | Not started | Invalid geometry |
| OBS-003 | SS16 | P0-B | Overlapping obstructions rejected | API | No live coverage | Live: two obstructions overlapping rejected | Two overlapping obstructions | 1. Configure two obstructions that overlap 2. Assert validation error | Overlap error | Error response | Overlap seed | Not started | Physical impossibility |
| OBS-004 | SS16 | P0-B | Obstruction correctly reduces available panel area | API | Vitest wallPanelEngine | Live: obstruction reduces BOM panel count | Zone with obstruction | 1. Configure zone with obstruction 2. Generate BOM 3. Assert reduced panel count | Fewer panels than without obstruction | BOM comparison | With/without obstruction seeds | Not started | Over-ordering materials |
| OBS-005 | SS16 | P0-B | Zero-size obstruction rejected | API | Vitest validationEngine | Live: zero-area obstruction rejected | Zero dimension | 1. Configure obstruction with width=0 2. Assert error | Validation error | Error response | N/A | Not started | Division by zero |


---

## P0-C: USER-FACING FUNCTIONAL BEHAVIOR (41 tests)

### 14. Functional Suite Remaining (SS4) - 12 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| FUNC-001 | SS4 | P0-C | Project creation end-to-end via UI | Browser | Vitest projectCreationStore | Live browser: user can create project through UI | Logged-in DESIGNER, ACTIVE template | 1. Navigate to project creation 2. Select template 3. Fill form 4. Submit 5. Assert project visible | Project appears in list, snapshot created | Screenshot + API response | Playwright browser, auth | Not started | Core workflow broken |
| FUNC-002 | SS4 | P0-C | Template creation via UI | Browser | Vitest templateManagementStore | Live browser: designer can create template | Logged-in DESIGNER | 1. Navigate to template management 2. Click create 3. Fill details 4. Save | Template appears in list | Screenshot + DB | Playwright browser, auth | Not started | Designer workflow blocked |
| FUNC-003 | SS4 | P0-C | Measurement entry via UI | Browser | No live coverage | Live browser: consultant can enter measurements | Logged-in CONSULTANT, assigned project | 1. Navigate to project 2. Enter measurements 3. Save 4. Assert saved | Measurements persisted | Screenshot + DB query | Playwright browser, consultant auth | Not started | Consultant workflow blocked |
| FUNC-004 | SS4 | P0-C | BOM generation triggered and visible | Browser | Vitest bomStore | Live browser: BOM generation produces visible results | Project with measurements | 1. Navigate to project 2. Trigger BOM generation 3. Assert BOM displayed | BOM lines visible in UI | Screenshot | Playwright browser, full project | Not started | BOM not visible to user |
| FUNC-005 | SS4 | P0-C | Finalization via UI | Browser | Vitest finalizationStore | Live browser: project can be finalized | Project in READY state | 1. Navigate to project 2. Click finalize 3. Confirm 4. Assert final state | Project shows FINALIZED status | Screenshot + DB | Playwright browser, ready project | Not started | Finalization workflow broken |
| FUNC-006 | SS4 | P0-C | SKU browser displays catalogue | Browser | Vitest skuStore | Live browser: SKU browser shows items | Catalogue with entries | 1. Navigate to SKU browser 2. Assert items displayed 3. Search/filter works | SKU items visible and filterable | Screenshot | Playwright browser | Not started | SKU selection broken |
| FUNC-007 | SS4 | P0-C | Template activation through UI | Browser | Vitest templateManagementStore | Live browser: template can be activated | Template meeting activation criteria | 1. Navigate to template 2. Click activate 3. Assert ACTIVE status | Status changes to ACTIVE | Screenshot + API | Playwright browser, valid template | Not started | Template activation UX broken |
| FUNC-008 | SS4 | P0-C | Error messages displayed to user | Browser | Vitest errorCatalogue | Live browser: validation errors visible | Invalid input scenario | 1. Submit invalid form 2. Assert error message visible in UI | Human-readable error displayed | Screenshot | Playwright browser | Not started | User sees no feedback |
| FUNC-009 | SS4 | P0-C | Navigation between sections works | Browser | No live coverage | Live browser: routing works correctly | Logged-in user | 1. Click each nav item 2. Assert correct page loads | All routes resolve | Screenshots per page | Playwright browser, auth | Not started | Navigation broken |
| FUNC-010 | SS4 | P0-C | Logout clears session | Browser | No live coverage | Live browser: logout removes auth state | Logged-in user | 1. Click logout 2. Assert redirected to login 3. Assert API calls fail | Session cleared | Screenshot + failed API call | Playwright browser | Not started | Session persistence vulnerability |
| FUNC-011 | SS4 | P0-C | Responsive layout (mobile viewport) | Browser | No live coverage | Live browser: UI usable at mobile width | Any page | 1. Set viewport to 375x812 2. Navigate to key pages 3. Assert no overflow/broken layout | No horizontal scroll, readable text | Mobile screenshots | Playwright browser | Not started | Mobile unusable |
| FUNC-012 | SS4 | P0-C | Loading states displayed during API calls | Browser | No live coverage | Live browser: loading indicators appear | Any API-triggering action | 1. Trigger slow action 2. Assert loading state visible 3. Assert completion state | Loading indicator shown then removed | Video/screenshots | Playwright browser + network throttle | Not started | User thinks app is frozen |


### 15. Canvas Suite (SS12) - 14 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| CANVAS-001 | SS12 | P0-C | Canvas renders zone rectangles | Browser | Vitest canvasStore | Live browser: zones visible on canvas | Project with zones | 1. Open canvas 2. Assert zone rectangles rendered | Zones visible with correct dimensions | Screenshot | Playwright browser, project with zones | Not started | Canvas blank |
| CANVAS-002 | SS12 | P0-C | Zone selection highlights zone | Browser | Vitest canvasStore.multiSelect | Live browser: clicking zone shows selection state | Rendered zones | 1. Click zone 2. Assert selection visual (highlight/border) | Visual selection indicator | Screenshot before/after click | Playwright browser | Not started | No selection feedback |
| CANVAS-003 | SS12 | P0-C | Multi-select with Shift+Click | Browser | Vitest multiSelect | Live browser: shift+click selects multiple | Multiple zones | 1. Click zone A 2. Shift+click zone B 3. Assert both selected | Both zones highlighted | Screenshot | Playwright browser | Not started | Multi-select broken |
| CANVAS-004 | SS12 | P0-C | Copy/paste zones | Browser | Vitest copyPaste | Live browser: Ctrl+C/Ctrl+V duplicates zone | Selected zone | 1. Select zone 2. Ctrl+C 3. Ctrl+V 4. Assert duplicate appears | New zone created | Screenshot + DOM count | Playwright browser | Not started | Copy/paste broken |
| CANVAS-005 | SS12 | P0-C | Undo/redo via keyboard | Browser | Vitest useHistory | Live browser: Ctrl+Z undoes last action | Performed action | 1. Add zone 2. Ctrl+Z 3. Assert zone removed 4. Ctrl+Y 5. Assert zone restored | Undo removes, redo restores | Screenshots per step | Playwright browser | Not started | No undo capability |
| CANVAS-006 | SS12 | P0-C | Snap-to-grid on zone placement | Browser | Vitest snapEngine | Live browser: dragged zone snaps to grid | Grid enabled | 1. Drag zone to non-grid position 2. Assert snaps to nearest grid point | Position aligns to grid | Position check | Playwright browser | Not started | Imprecise placement |
| CANVAS-007 | SS12 | P0-C | Zone validation errors shown on canvas | Browser | Vitest useZoneValidation | Live browser: invalid zone shows error indicator | Invalid zone state | 1. Create invalid zone 2. Assert error visual on canvas | Error indicator visible | Screenshot | Playwright browser | Not started | Silent validation failure |
| CANVAS-008 | SS12 | P0-C | Canvas zoom in/out | Browser | No live coverage | Live browser: zoom controls work | Canvas open | 1. Click zoom in 2. Assert scale increased 3. Click zoom out 4. Assert scale decreased | Visible zoom change | Screenshots at each zoom | Playwright browser | Not started | Zoom broken |
| CANVAS-009 | SS12 | P0-C | Canvas pan (drag viewport) | Browser | Vitest touchViewport | Live browser: viewport panning works | Canvas with content | 1. Middle-click and drag 2. Assert viewport moved | Content position changes | Screenshot | Playwright browser | Not started | Navigation broken |
| CANVAS-010 | SS12 | P0-C | SKU assignment to zone via canvas | Browser | Vitest segmentAssignment | Live browser: SKU can be assigned from canvas UI | Zone + catalogue | 1. Select zone 2. Open SKU picker 3. Assign SKU 4. Assert zone shows SKU | Zone displays assigned SKU | Screenshot + DB | Playwright browser, catalogue seed | Not started | Core assignment workflow broken |
| CANVAS-011 | SS12 | P0-C | Canvas keyboard shortcuts | Browser | Vitest useKeyboardShortcuts | Live browser: shortcuts trigger actions | Canvas open | 1. Press Delete with zone selected 2. Assert zone removed | Zone removed from canvas | Screenshot before/after | Playwright browser | Not started | Keyboard shortcuts non-functional |
| CANVAS-012 | SS12 | P0-C | Canvas BOM link indicator | Browser | Vitest bomCanvasLink | Live browser: BOM-linked zones show indicator | Project with BOM | 1. Generate BOM 2. View canvas 3. Assert linked zones show indicator | Visual BOM link indicator | Screenshot | Playwright browser, BOM seed | Not started | No BOM feedback on canvas |
| CANVAS-013 | SS12 | P0-C | Touch viewport interaction (mobile) | Browser | Vitest touchViewport | Live browser: touch gestures work | Mobile viewport | 1. Set mobile viewport 2. Pinch to zoom 3. Touch drag to pan | Zoom and pan via touch | Video | Playwright mobile emulation | Not started | Mobile canvas unusable |
| CANVAS-014 | SS12 | P0-C | Canvas permission enforcement | Browser | Vitest usePermissionEnforcement | Live browser: CONSULTANT cannot edit canvas | Logged-in CONSULTANT | 1. Login as consultant 2. Open canvas 3. Assert edit tools disabled | Edit tools disabled/hidden | Screenshot | Playwright browser, consultant auth | Not started | Unauthorized canvas editing |


### 16. Asset/SVG (SS31) - 8 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| SVG-001 | SS31 | P0-C | SVG asset renders in canvas | Browser | No live coverage | Live browser: SVG assets display correctly | Catalogue with SVG assets | 1. Open canvas with SVG-assigned zone 2. Assert SVG renders | SVG visible in zone | Screenshot | Playwright browser, SVG seed | Not started | Blank zones in canvas |
| SVG-002 | SS31 | P0-C | SVG asset scales with zone dimensions | Browser | No live coverage | Live browser: SVG scales to fill zone | Zone with SVG | 1. Resize zone 2. Assert SVG scales proportionally | SVG fills zone area | Screenshot at multiple sizes | Playwright browser | Not started | Distorted/clipped SVG |
| SVG-003 | SS31 | P0-C | Asset version resolves correctly | API | No live coverage | Live: asset request returns correct version | Versioned asset in catalogue_asset | 1. Request asset for SKU 2. Assert correct version returned | Version matches latest approved | Response metadata | Asset version seed | Not started | Stale asset displayed |
| SVG-004 | SS31 | P0-C | Missing asset shows placeholder | Browser | No live coverage | Live browser: missing asset shows fallback | SKU without asset | 1. Assign SKU without asset 2. View canvas 3. Assert placeholder visible | Placeholder/fallback image shown | Screenshot | Playwright browser, SKU without asset | Not started | Broken image / blank |
| SVG-005 | SS31 | P0-C | Asset metadata dimensions available | API | No live coverage | Live: catalogue_asset_metadata returns dimensions | Asset with metadata | 1. Query catalogue_asset_metadata 2. Assert width_mm, height_mm present | Non-null dimensions | Response payload | Metadata seed | Not started | Layout calculations fail |
| SVG-006 | SS31 | P0-C | Pattern asset repeats correctly | Browser | No live coverage | Live browser: pattern-type assets tile correctly | Pattern asset type | 1. Assign pattern asset to large zone 2. Assert pattern repeats | Visible pattern repetition | Screenshot | Playwright browser, pattern seed | Not started | Pattern distortion |
| SVG-007 | SS31 | P0-C | Render asset type displayed in BOM view | Browser | No live coverage | Live browser: render-type asset shown in BOM preview | Render asset type | 1. View BOM 2. Assert render asset thumbnail visible | Thumbnail displayed | Screenshot | Playwright browser, render seed | Not started | No visual BOM reference |
| SVG-008 | SS31 | P0-C | Asset loading performance | Browser | No live coverage | Live browser: assets load within acceptable time | Multiple assets | 1. Load canvas with 20+ assets 2. Measure load time 3. Assert < 3s | All assets visible within 3 seconds | Performance trace | Playwright browser, large project | Not started | Unacceptable load time |

### 17. Remaining Integration Scenarios - 7 tests

| Test ID | QA Section | Priority | Test Objective | Test Layer | Existing Coverage | Remaining Verification | Preconditions | Test Steps | Expected Result | Evidence | Automation Dependency | Status | Release Impact |
|---------|-----------|----------|----------------|-----------|-------------------|----------------------|---------------|------------|-----------------|----------|----------------------|--------|---------------|
| INT-001 | SS4 | P0-C | Full lifecycle: template to project to measure to BOM to finalize | API | 19-step smoke test (partial) | Complete lifecycle via API with evidence at each step | Clean tenant | 1. Create template 2. Add zones/SKUs 3. Activate 4. Create project 5. Add measurements 6. Generate BOM 7. Finalize | Each step succeeds, final_bom created | Response at each step | Full auth + seed chain | Not started | Core workflow broken |
| INT-002 | SS4 | P0-C | Bidirectional Canvas-BOM sync | API + Browser | Vitest bidirectionalSync | Live: canvas change triggers BOM regeneration | Project with BOM | 1. Modify zone on canvas 2. Assert BOM regenerates 3. Assert new hash | BOM updates reflect canvas change | Before/after hashes | Playwright + API | Not started | Canvas and BOM out of sync |
| INT-003 | SS4 | P0-C | Multi-zone template with all component types | API | Vitest bomPipelineIntegration | Live: complex template generates complete BOM | Template with walls, lighting, furniture, trim, hidden | 1. Generate BOM 2. Assert all component types present in output | Lines for each component type | BOM line type analysis | Complex template seed | Not started | Component type missing from BOM |
| INT-004 | SS4 | P0-C | Project configuration versioning | API | No live coverage | Live: multiple configurations create version history | Project with consultant | 1. Submit config v1 2. Submit config v2 3. Query configurations 4. Assert both versions exist | Two version rows, ordered | DB query | Configuration seed | Not started | Version history lost |
| INT-005 | SS4 | P0-C | Actual BOM supersession on measurement change | API | T7 verified at DB level | Need API-level verification of supersession flow | Project with existing BOM | 1. Update measurement 2. Assert previous BOM superseded 3. Assert project status reset | previous BOM marked superseded, project status = CONFIGURED | DB state + API response | Full lifecycle seed | Not started | Stale BOM persists |
| INT-006 | SS4 | P0-C | Concurrent user access (two consultants) | API | No live coverage | Live: two consultants on same project do not conflict | Two consultants assigned | 1. Both submit measurements concurrently 2. Assert no data corruption 3. Assert correct final state | Both succeed or correct conflict resolution | Two response payloads | Two consultant auth fixtures | Not started | Data corruption |
| INT-007 | SS4 | P0-C | Template demotion cascade | API | T5 verified at DB level | Need API-level verification of cascade behavior | ACTIVE template | 1. Modify template zone 2. Assert template demoted from ACTIVE 3. Assert affected projects notified | Template status changes, cascade visible | State before/after | Template with projects seed | Not started | Active template silently modified |


---

## PLAYWRIGHT FOUNDATION REQUIREMENTS

### Authentication Fixtures

| Fixture | Description | JWT Claims Required |
|---------|-------------|---------------------|
| `designerAuth` | Authenticated session for designer@perfeccity.test | `role: DESIGNER`, `tenant_id: {tenant_A}` |
| `consultantAuth` | Authenticated session for consultant@perfeccity.test | `role: CONSULTANT`, `tenant_id: {tenant_A}` |
| `adminAuth` | Authenticated session for admin@perfeccity.test | `role: ADMIN` |
| `designerBAuth` | Second designer in different tenant | `role: DESIGNER`, `tenant_id: {tenant_B}` |
| `consultantBAuth` | Consultant NOT assigned to test project | `role: CONSULTANT`, `tenant_id: {tenant_B}` |
| `expiredAuth` | JWT with past expiration | Expired `exp` claim |
| `serviceRoleAuth` | Service role key for backend operations | Supabase service_role key |

### Seed Data Requirements

| Seed Set | Contents | Used By |
|----------|----------|---------|
| `base-tenant` | Two tenants (A, B) with users | All RBAC/RLS tests |
| `active-template` | Template in ACTIVE status with zones, SKUs, trim, lighting, furniture, hidden | Frame, trim, hidden, BOM tests |
| `multi-template` | Multiple templates across tenants | Cross-tenant isolation tests |
| `full-lifecycle` | Project with snapshot, measurements, actual BOM, final BOM | Finalization, snapshot, hash tests |
| `catalogue-full` | Complete SKU catalogue with assets and metadata | Asset/SVG tests, BOM generation |
| `golden-inputs` | Frozen input data matching golden fixture files | Golden fixture tests |
| `permission-matrix` | template_consultant_permission rows for various scenarios | Permission enforcement tests |
| `obstruction-set` | Zones with various obstruction configurations | Geometry/obstruction tests |

### Screenshot and Trace Configuration

```typescript
// playwright.config.ts requirements
{
  use: {
    screenshot: 'on',           // Capture on every test
    trace: 'on-first-retry',    // Full trace on failure
    video: 'on-first-retry',    // Video on failure
    baseURL: 'https://bom-beryl.vercel.app',
  },
  outputDir: './test-results/',
  reporter: [
    ['html', { outputFolder: './playwright-report' }],
    ['json', { outputFile: './test-results/results.json' }],
  ],
}
```

### CI Requirements

| Requirement | Detail |
|-------------|--------|
| Playwright version | Latest stable (1.40+) |
| Browsers | Chromium (primary), Firefox (secondary) |
| Node.js | 18+ (match Vercel runtime) |
| Environment variables | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Test users | Pre-created in Supabase Auth with correct app_metadata |
| Parallel execution | Max 2 workers (avoid rate limiting) |
| Timeout | 30s per test (API), 60s per test (Browser) |
| Retry | 1 retry on failure |
| Artifacts | Screenshots, traces, videos stored in CI artifacts |

### API Helper Requirements

```typescript
// Required helper functions for Playwright API tests
interface APIHelpers {
  authenticateAs(role: 'designer' | 'consultant' | 'admin'): Promise<string>; // Returns JWT
  supabaseClient(jwt: string): SupabaseClient;
  seedData(seedSet: string): Promise<SeedResult>;
  cleanupData(seedResult: SeedResult): Promise<void>;
  assertRLSDeny(response: Response): void;
  computeHash(bomOutput: object): string;
  compareToGolden(actual: object, fixtureName: string): DiffResult;
}
```


---

## EVIDENCE MODEL

### Section 51: Mandatory Four-Question Model with Unique Package ID

For every executed test, the evidence package must explicitly answer the four questions and include a unique package identifier.

#### The Four Questions

**1. What requirement does this prove?**
- Frozen specification section(s) (e.g., SS5, SS6, SS17)
- Test ID and test objective
- Non-negotiable architectural rule number, if applicable

**2. What exact build was tested?**
- Build/version identifier
- Commit hash or release tag (e.g., `mvp-v1.0.1-hardened`)
- Environment: QA / Staging / Production smoke
- Database schema/migration version, if applicable
- Test execution date/time in UTC

**3. What happened?**
- Expected result quoted or summarized from the specification
- Actual observed result
- Pass / Fail / Blocked status
- If failed:
  - Exact error code from the authoritative error catalogue
  - HTTP status and request/response payload
  - Database state before and after
  - Screenshot or video evidence
- If passed:
  - Key assertions verified (e.g., hash equality, deterministic output, row counts, state transition, audit event presence)

**4. Where is the evidence?**
- Direct link to CI test execution log
- Test management system link/ID
- Attachments:
  - API request/response files
  - Screenshots / screen recordings
  - Database snapshots or query output
  - Generated BOM / hash files
- Defect ticket ID, if applicable
- Retention location and access control

### Mandatory Evidence Template

| Field | Content |
|-------|---------|
| Evidence Package ID | Unique ID, e.g., `EV-P0-AUTH-001-001` (priority-group-test-sequence) |
| Test ID | Exact P0/P1/P2/P3 test ID |
| Requirement proved | Frozen Spec section / Rule # (e.g., SS5 RBAC-001) |
| Build tested | Version + commit hash + release tag |
| Environment | QA / Staging / Production smoke + target URL |
| DB version | Migration/schema version |
| Executed by | QA name / role |
| Executed at | ISO-8601 UTC timestamp |
| Expected result | Specification-derived expectation |
| Actual result | Observed behavior |
| Result | PASS / FAIL / BLOCKED |
| Assertions | Key assertions actually verified (e.g., hash equality, row counts, state transition, audit event) |
| Evidence | CI job, screenshots, API logs, DB output, generated artifacts |
| Defect | Ticket ID if applicable |
| Retention | Evidence storage location + access control |

### Applicability

- **P0 and P1 tests:** Full evidence package is mandatory.
- **P2 tests:** Abbreviated evidence is acceptable, but the four questions and package ID must still be present.
- **P3 informational tests:** Evidence may be recorded as observation only, but build tested and result must be captured.

### Critical Rule for P0 Backlog

No P0 test may move from UNVERIFIED to VERIFIED LIVE unless the four-question evidence package is complete and satisfies:

- **PASS without evidence = not verified.**
- **Automated pass without live execution = not live verified.**
- **Blocked execution = not pass.**
- **Failed execution = remains failed until the defect is remediated and the test is re-executed.**

This ensures a clean audit trail from specification to test ID to exact release to execution to observed result to evidence.


---

## EXECUTION SEQUENCE

### Phase 1: P0-A Security and Authorization (Estimated: 3-4 days)

| Step | Tests | Method | Dependency |
|------|-------|--------|------------|
| 1.1 | RBAC-001 through RBAC-018 | Playwright API | Auth fixtures, multi-tenant seed |
| 1.2 | RLS-002 through RLS-014 | Playwright API | Multi-tenant seed, cross-tenant UUIDs |
| 1.3 | PERM-001 through PERM-010 | Playwright API | Permission matrix seed |
| 1.4 | SNAP-001 through SNAP-010 | Playwright API + DB | Full lifecycle seed |
| 1.5 | ERR-001 through ERR-006 | Playwright API | Error trigger mechanisms |

**Gate:** All P0-A tests must PASS before proceeding. Any FAIL produces a defect ticket, not a baseline modification.

### Phase 2: P0-B Data Integrity and Deterministic Output (Estimated: 3-4 days)

| Step | Tests | Method | Dependency |
|------|-------|--------|------------|
| 2.1 | HASH-001 through HASH-008 | Playwright API | BOM generation seed, hash library |
| 2.2 | GOLD-001 through GOLD-008 | Playwright API | Golden fixture files |
| 2.3 | FRAME-001 through FRAME-008 | Playwright API | Wall configuration seeds |
| 2.4 | TRIM-001 through TRIM-008 | Playwright API | Trim configuration seeds |
| 2.5 | HIDDEN-001 through HIDDEN-006 | Playwright API + Browser | Hidden component seed |
| 2.6 | GEO-001 through GEO-006 | Playwright API | Invalid geometry inputs |
| 2.7 | SPACE-001 through SPACE-005 | Playwright API | Spacing edge case seeds |
| 2.8 | OBS-001 through OBS-005 | Playwright API | Obstruction configurations |

**Gate:** All P0-B tests must PASS before proceeding. Any FAIL produces a defect ticket.

### Phase 3: P0-C User-Facing Functional Behavior (Estimated: 3-4 days)

| Step | Tests | Method | Dependency |
|------|-------|--------|------------|
| 3.1 | FUNC-001 through FUNC-012 | Playwright Browser | Full auth + seeds, all UI pages |
| 3.2 | CANVAS-001 through CANVAS-014 | Playwright Browser | Canvas interaction fixtures |
| 3.3 | SVG-001 through SVG-008 | Playwright Browser | Asset/SVG catalogue seed |
| 3.4 | INT-001 through INT-007 | Playwright API + Browser | Full lifecycle seeds |

**Gate:** All P0-C tests must PASS for release certification.

### Pre-Execution Sequence (Before Phase 1)

1. **P0 Backlog** (this document) - COMPLETE
2. **Manual Designer/Consultant smoke** - Execute core workflows manually
3. **Leaked-password protection** - Verify no credentials in codebase
4. **Playwright foundation** - Set up fixtures, helpers, configuration
5. **Seed data creation** - Build all required seed sets
6. **Auth fixture validation** - Confirm test users can authenticate

### Post-Execution

- All defects found during execution become **change requests** against a new tag
- The `mvp-v1.0.1-hardened` tag remains **frozen**
- Fixes produce `mvp-v1.0.2-hotfix` or `mvp-v1.1.0-next` depending on severity
- Re-execute failed tests after fix deployment
- Final certification requires 100% P0 PASS rate with evidence

---

## AUTOMATION METHOD DISTRIBUTION

| Method | Count | Tests |
|--------|-------|-------|
| Playwright API (authenticated HTTP) | 72 | RBAC-*, RLS-*, PERM-*, SNAP-*, ERR-*, HASH-*, GOLD-*, FRAME-*, TRIM-*, HIDDEN-(1,3-6), GEO-*, SPACE-*, OBS-*, INT-* |
| Playwright Browser (UI automation) | 41 | FUNC-*, CANVAS-*, SVG-*, HIDDEN-002 |
| Live SQL (direct database) | 28 | Already-executed T-RLS-*, T1-T7, TRG-*, plus new DB-only verifications |
| Hybrid (API + DB assertion) | 12 | SNAP-001 through SNAP-010, PERM-009, INT-005 |

---

## COVERAGE PERCENTAGE MODEL

| Category | Total Tests | Live Verified | Vitest Only | Unverified | Live % |
|----------|-------------|---------------|-------------|------------|--------|
| P0-A Security | 58 | 5 (RLS-001, RLS-009, RLS-010, RLS-011, SNAP-009) | 18 (logic layer) | 35 | 8.6% |
| P0-B Data Integrity | 54 | 0 | 41 (engine logic) | 54 | 0% |
| P0-C Functional | 41 | 0 | 28 (store/component) | 41 | 0% |
| **Total** | **153** | **5** | **87** | **130** | **3.3%** |

**Note:** The 22 previously-executed SQL tests and 50 Vitest P0 tests are counted separately as "already verified live" and "engine logic verified" respectively. They are not double-counted in the remaining 153.

The 1,144 Vitest regression tests provide **logic coverage** (engine calculations, state transitions, component rendering) but zero **live verification** (authenticated requests, RLS enforcement, real database triggers, browser rendering).

**Defensible QA coverage = live-verified tests with four-question evidence packages / total required P0 tests.**

Current live coverage: 5 / 153 = **3.3% remaining P0 live verification**

Target: **100% P0 live verification before release certification.**
