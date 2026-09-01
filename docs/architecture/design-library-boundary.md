# Design Library — Architectural Boundary Definition

## MVP v1 Decision (locked)

> For MVP v1, the Design Library is the consultant-facing published-design catalogue composed of ACTIVE Designer Templates, organized through `design_family_master` and filtered by SKU/catalogue availability. It is not an independent persistence entity.

A dedicated `design_library_item` table is intentionally deferred beyond MVP.

## Lifecycle Model

```
DESIGNER
  ↓
Template (DRAFT)
  ↓ publish_template()
Template (ACTIVE)
  ↓
DESIGN LIBRARY
(ACTIVE templates + design_family + availability)
  ↓
CONSULTANT selects design
  ↓
create_project(template_id)
  ↓
Immutable Project Snapshot
  ↓
Site Measurements + Obstructions
  ↓
Site Adaptation (Zones / SKU Assignment)
  ↓
Actual BOM
  ↓
Final BOM
```

## Three Lifecycle Boundaries (enforced even without a separate table)

### 1. Template
- **Owner:** Designer
- **Lifecycle:** DRAFT → ACTIVE (via `publish_template()`)
- **Purpose:** Source reusable design definition
- **Mutations:** Designer/Admin only (RLS enforced)

### 2. Design Library (application layer)
- **Owner:** System (read-only for Consultants)
- **Composition:** ACTIVE templates + `design_family_master` grouping + SKU/catalogue availability filtering
- **Visibility:** Consultant sees only `template.status = 'ACTIVE'` (RLS policy `template_select_consultant`)
- **Mutations:** None by Consultant - discovery and selection only
- **Implementation:** `designLibraryStore.ts`, `DesignLibrary.tsx`, `DesignLibraryPage.tsx`

### 3. Project Snapshot
- **Owner:** System (created server-side by `create_project()`)
- **Lifecycle:** Created once, immutable forever (`trg_snapshot_immutable`)
- **Independence:** Subsequent Designer template changes have zero effect on existing snapshots
- **Downstream:** All BOM calculations (Actual BOM, Final BOM) derive exclusively from this frozen state

## Enforcement Points

| Invariant | Mechanism |
|-----------|-----------|
| Consultant cannot see DRAFT templates | RLS: `current_user_role() = 'CONSULTANT' AND status = 'ACTIVE'` |
| Consultant cannot modify templates | RLS: write policies require `DESIGNER`/`ADMIN` role |
| Snapshot is server-built | `create_project()` SECURITY DEFINER RPC builds snapshot internally |
| Snapshot is immutable | `trg_snapshot_immutable` trigger rejects UPDATE/DELETE |
| Template changes don't affect projects | Snapshot contains frozen copy of all template data at creation time |
| BOM reads only from snapshot | `save_actual_bom()` validates against `project_snapshot.snapshot_data` |

## Future Evolution

When the product requires independent library-item versioning, per-consultant access control lists, or library items that aggregate multiple templates, a `design_library_item` table will be introduced. The existing enforcement points will remain; the new table will sit between `template` and `project_snapshot` in the data flow.
