# PERFECCITY — End-to-End Workflow: Designer Template to Final BOM

**Investigation Date:** 2026-08-17
**Method:** Read-only code inspection + live database verification
**Source:** Actual implementation (not specification)

---

## 1. Workflow Map (Actual Implementation)

```
DESIGNER
  |
Template Creation (DRAFT)
  |-- Wall Geometry (STRAIGHT / L_CORNER)
  |-- Wall Configuration (dimensions, rows, columns, fit algorithm)
  |-- Zone Generation (from wallConfigEngine)
  |-- SKU Assignment (one WALL_PANEL per zone)
  |-- Lighting Configuration
  |-- Furniture Configuration
  |-- Trim Configuration
  |-- Hidden Components
  |-- Consultant Permissions
  +-- Master BOM Generation + Approval
  |
publish_template() RPC [ATOMIC, SECURITY DEFINER]
  |-- Validates: DESIGNER role + ownership
  |-- Validates: status = DRAFT
  |-- Validates: check_template_eligible()
  |     |-- All zone SKUs ACTIVE + Catalogue READY
  |     |-- All alternative SKUs ACTIVE + Catalogue READY
  |     |-- All lighting SKUs ACTIVE + Catalogue READY
  |     |-- All furniture SKUs ACTIVE + Catalogue READY
  |     |-- All trim SKUs ACTIVE + Catalogue READY
  |     |-- All hidden component SKUs ACTIVE + Catalogue READY
  |     +-- Master BOM = APPROVED
  +-- UPDATE template SET status = 'ACTIVE'
  |
DESIGN LIBRARY (query-time projection)
  |-- Server: RLS restricts CONSULTANT to status='ACTIVE' only
  |-- Client: designLibraryStore computes availability (AVAILABLE/BLOCKED)
  +-- UI: Premium gallery with categories, swatches, filters
  |
CONSULTANT SELECTION
  |
create_project() RPC [ATOMIC, SECURITY DEFINER]
  |-- Validates: CONSULTANT role + identity
  |-- Validates: status = 'ACTIVE'
  |-- Validates: check_template_eligible() [server-side revalidation]
  |-- Idempotency lock (pg_advisory_xact_lock)
  |-- INSERT project
  |-- INSERT project_snapshot (IMMUTABLE from this point)
  +-- RETURN project_id
  |
IMMUTABLE PROJECT SNAPSHOT
  (Contains: wall_geometry, zones, SKUs, lighting, furniture,
   trims, hidden_components, wall_configuration, permissions,
   panel_frames, obstructions -- ALL frozen at selection time)
  |
CONSULTANT SITE MEASUREMENT
  |-- Actual wall width/height
  |-- Site obstructions (doors, windows, etc.)
  +-- Permitted parameter adjustments
  |
BOM PIPELINE (runBomPipeline)
  |-- INPUT: Snapshot data + measurements + permissions + rules
  |         (reads project_snapshot, NOT live template)
  |-- Step 1: Permission Validation
  |-- Step 2: Site Adaptation Engine (PROPORTIONAL/PRIORITY/EQUAL/FIXED)
  |-- Step 3: SKU Compatibility Check
  |-- Step 4: Geometry Validation
  |-- Step 5: Construction Validation
  |-- Step 6: Quantity Resolution
  |     |-- Wall Panel Engine (13 golden fixtures)
  |     |-- Light Engine (LINEAR/DISCRETE)
  |     |-- Furniture Engine
  |     +-- Hidden Components Engine
  |-- Step 7: BOM Reconciliation
  +-- Step 8: Final BOM Validation
  |
ACTUAL BOM (actual_bom + actual_bom_line)
  |
finalize_project() RPC [ATOMIC, SECURITY DEFINER]
  |-- Validates: CONSULTANT role + ownership
  |-- Validates: project status = VALIDATED
  |-- Advisory lock (concurrency protection)
  |-- Idempotent (returns existing on repeat)
  |-- INSERT final_bom
  |-- INSERT final_bom_line (with internal_finalization flag)
  |-- UPDATE project SET status = 'FINALIZED'
  +-- INSERT finalization_idempotency
  |
IMMUTABLE FINAL BOM
  (Triggers prevent UPDATE/DELETE forever)
```

---

## 2. Stage-by-Stage Table

| # | Stage | Role | Input | System Action | Output | DB Tables | Immutable? |
|---|-------|------|-------|---------------|--------|-----------|:---:|
| 1 | Create Template | DESIGNER | Name, geometry, family | INSERT template | template_id | template | No (DRAFT) |
| 2 | Configure Wall | DESIGNER | Width, height, rows, cols, fit | INSERT/UPDATE wall config | wall_config_id | template_wall_configuration | No |
| 3 | Generate Panel Frames | SYSTEM | Wall config | wallConfigEngine.generatePanelFrames() | PanelFrame[] | generated_panel_frame | No (regenerable) |
| 4 | Create Zones | SYSTEM | Panel frames | Zone generation from frames | zone_id[] | template_zone | No |
| 5 | Assign SKUs | DESIGNER | Zone + SKU selection | INSERT template_zone_sku | assignment | template_zone_sku | No |
| 6 | Configure Lighting | DESIGNER | Edge, mounting type | INSERT template_lighting | lighting_id | template_lighting | No |
| 7 | Configure Furniture | DESIGNER | Position, orientation | INSERT template_furniture | furniture_id | template_furniture | No |
| 8 | Define Permissions | DESIGNER | Parameter keys, limits | INSERT consultant_permission | permission_id | template_consultant_permission | No |
| 9 | Generate Master BOM | SYSTEM | Template data | BOM pipeline execution | master_bom_id | master_bom, master_bom_line | No |
| 10 | Approve Master BOM | DESIGNER | Review + approve | UPDATE status=APPROVED | APPROVED | master_bom | No |
| 11 | Publish Template | DESIGNER | publish_template() | Atomic validation + status change | ACTIVE | template | No (can retire) |
| 12 | Browse Design Library | CONSULTANT | Filters, search | Query ACTIVE+AVAILABLE | Template list | template (read) | N/A |
| 13 | Select Template | CONSULTANT | create_project() | Atomic project+snapshot | project_id, snapshot_id | project, project_snapshot | **YES (Snapshot)** |
| 14 | Enter Measurements | CONSULTANT | Wall dims, obstructions | INSERT/UPDATE measurements | measurement_id | project_measurement, project_obstruction | No |
| 15 | Generate Actual BOM | SYSTEM | Snapshot + measurements | runBomPipeline() | BOM lines | actual_bom, actual_bom_line | No |
| 16 | Finalize Project | CONSULTANT | finalize_project() | Atomic final BOM creation | final_bom_id | final_bom, final_bom_line | **YES (Final BOM)** |

---

## 3. Data Lineage

```
SKU Master (sku_master)
   | status, dimensions, product_type
   v
Product Catalogue (catalogue_entry, catalogue_asset)
   | READY status, validated geometry
   v
Designer Template (template + child tables)
   | wall_geometry, zones, SKU assignments, lighting, furniture, trims
   v
Master BOM (master_bom + master_bom_line)
   | APPROVED baseline quantities
   v
Published Template (template.status = 'ACTIVE')
   | All dependencies validated by check_template_eligible()
   v
Project Snapshot (project_snapshot.snapshot_data JSONB)
   | FROZEN: wall_geometry, zones+SKUs, lighting, furniture, trims,
   |         hidden_components, wall_configuration, permissions, panel_frames
   v
Site Adaptation (project_measurement + project_obstruction)
   | actual_wall_width, actual_wall_height, obstructions
   v
BOM Pipeline (bomPipeline.ts -> runBomPipeline())
   | Reads: snapshot_data + measurements (NOT live template)
   v
Actual BOM (actual_bom + actual_bom_line)
   | Derived quantities, dimensions, calculation rules
   v
Final BOM (final_bom + final_bom_line)
   | IMMUTABLE: triggers prevent UPDATE/DELETE
   +-- finalization_idempotency (concurrency protection)
```

---

## 4. Source-of-Truth Matrix

| Data | Authoritative Source | Mutable? |
|------|---------------------|:---:|
| SKU dimensions | sku_master.width_mm/height_mm/thickness_mm/depth_mm | No (admin-only) |
| Product attributes | sku_master + catalogue_entry | No (admin-only) |
| Template geometry | template.wall_geometry + template_wall_configuration | No after publish |
| Project geometry | project_snapshot.snapshot_data.wall_geometry | **FROZEN** |
| Site measurements | project_measurement.wall_width_mm/wall_height_mm | Yes (consultant) |
| Zone dimensions | Snapshot frozen; adapted by site adaptation engine | Computed |
| Lighting rules | template_lighting -> frozen in snapshot | **FROZEN** |
| Compatibility rules | sku_compatibility table | No (admin-only) |
| Construction rules | rule_set table -> frozen in snapshot | **FROZEN** |
| BOM quantities | runBomPipeline() output | Computed deterministically |
| Final BOM | final_bom + final_bom_line | **IMMUTABLE** |

---

## 5. Permission Matrix

| Action | ADMIN | DESIGNER | CONSULTANT | SYSTEM |
|--------|:---:|:---:|:---:|:---:|
| Manage SKU Master | YES | No | No | -- |
| Create Template | No | YES | No | -- |
| Edit Template (own) | No | YES | No | -- |
| Publish Template | No | YES (RPC) | No | -- |
| Retire Template | No | YES | No | -- |
| Browse Design Library | YES | YES | YES (ACTIVE only) | -- |
| Create Project | No | No | YES (RPC) | -- |
| Enter Measurements | No | No | YES | -- |
| Generate BOM | No | No | -- | YES (pipeline) |
| Finalize Project | No | No | YES (RPC) | -- |
| Modify Final BOM | No | No | No | No (trigger) |
| Read Audit Events | YES | YES | YES | -- |
| Write Audit Events | No | No | No | YES (service_role) |

---

## 6. Immutability Boundaries

| Boundary | Enforcement Mechanism | When |
|----------|----------------------|------|
| **Project Snapshot** | DB trigger: prevent_snapshot_modification() | After create_project() INSERT |
| **Final BOM** | DB trigger: prevent_final_bom_modification() | After finalize_project() INSERT |
| **Final BOM Lines** | DB trigger: prevent_final_bom_line_modification() | After finalization (requires internal_finalization flag) |
| **Audit Events** | DB trigger: prevent_audit_modification() | Always (append-only) |
| **Published Template** | publish_template() validates before ACTIVE; trg_template_activate prevents invalid activation | On status change to ACTIVE |

---

## 7. Security Boundaries (Server-Side Enforcement)

| Boundary | Mechanism | Verified? |
|----------|-----------|:---:|
| Template visibility (Consultant) | RLS: template_select_consultant USING(status='ACTIVE') | YES (live tested) |
| Template publication | publish_template() SECURITY DEFINER + FOR UPDATE lock | YES (live tested) |
| Template activation gate | trg_template_activate trigger + check_template_eligible() | YES (live tested) |
| Project creation auth | create_project() checks CONSULTANT role + ownership + eligibility | YES (live tested) |
| Snapshot immutability | prevent_snapshot_modification() trigger | YES (live tested) |
| Final BOM immutability | prevent_final_bom_modification() trigger | YES (live tested) |
| Finalization concurrency | pg_advisory_xact_lock + finalization_idempotency UNIQUE | YES (live tested) |
| Audit append-only | prevent_audit_modification() trigger | YES (live tested) |
| Anon access blocked | REVOKE USAGE ON SCHEMA perfecity FROM anon | YES (live tested) |

---

## 8. Test/Evidence Coverage

| Stage | Unit Tests | DB/RLS Live | E2E Browser |
|-------|:---:|:---:|:---:|
| Template creation | YES (25 tests) | -- | Partial |
| Wall config | YES (28 tests) | -- | Partial |
| Panel frame gen | YES (27 tests) | -- | -- |
| Zone/SKU assignment | YES | YES (P0-A) | Partial |
| Publication | YES (18 tests) | YES (live RPC) | -- |
| Design Library | YES (30+ tests) | YES (DL acceptance) | Partial |
| Project creation | YES (16 tests) | YES (live RPC) | Partial |
| Snapshot creation | YES (11 tests) | YES (immutability) | -- |
| Site adaptation | YES (41 tests) | -- | -- |
| BOM pipeline | YES (17+24 tests) | -- | -- |
| BOM determinism | YES (10 repeat) | -- | -- |
| Finalization | YES (20 tests) | YES (live RPC) | -- |
| Final BOM immutability | -- | YES (trigger) | -- |
| RBAC/RLS | -- | YES (58 tests) | -- |

**Total: 1,256 unit tests, 80+ live SQL tests, 13 E2E browser tests**

---

## Critical BOM Pipeline Data Source Verification

**Question:** Does the BOM pipeline read from the live template or the immutable snapshot?

**Answer (from bomStore.ts lines 465-504):**

The BOM pipeline fetches data exclusively from `project_snapshot`:

```
fromTable('project_snapshot')
  .select('*')
  .eq('snapshot_id', snapshotId)
  .eq('project_id', projectId)
```

Then builds pipeline input FROM the snapshot:

```
snapshotData: snapshot?.snapshot_data    <-- FROM SNAPSHOT
configuration: snapshot?.configuration  <-- FROM SNAPSHOT
ruleSet: snapshot?.rule_set             <-- FROM SNAPSHOT
```

**The BOM pipeline reads exclusively from project_snapshot, never from the live template.**

This is the critical architectural guarantee that ensures:
- Template changes cannot affect existing projects
- Template retirement cannot corrupt existing BOMs
- SKU deactivation cannot mutate existing snapshots
- The same snapshot + measurements always produces the same BOM

---

## Final Answer

PERFECCITY transforms a Designer's reusable template and a Consultant's real-world site measurements into a deterministic, traceable, immutable Final BOM by: (1) freezing the Designer's published template into an immutable Project Snapshot at the moment of Consultant selection, (2) combining that frozen snapshot with the Consultant's actual site measurements through a deterministic 8-step BOM pipeline that reads exclusively from the snapshot (never the live template), and (3) locking the resulting Final BOM with database triggers that permanently prevent any modification -- ensuring that the same inputs always produce the same outputs, and that the output can never be altered after finalization.
