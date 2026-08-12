# PERFECCITY Database – Onboarding Guide for Engineering

## Welcome

The PERFECCITY database is not a generic schema – it is a frozen, specification-aligned implementation of a wall-design and BOM platform. Every table, constraint, and trigger exists to enforce the 60 non-negotiable architectural rules from the specification.

## The Frozen Contract

- **v1.1.5 is Frozen.** No schema changes are allowed without a formal "unfreeze" process.
- Any new requirement must pass through the same rigorous specification review → patch → verification gate → re-freeze cycle.
- Do not "optimise" the schema, add columns, or relax constraints. The DDL is the source of truth.

## Authority Model (Who Can Do What)

| Role | Responsibility |
|------|---------------|
| **ADMIN** | Master data (SKU, catalogue, rule sets) |
| **DESIGNER** | Template creation, zone design, SKU assignment, Master BOM approval |
| **CONSULTANT** | Project creation, measurements, limited configuration, finalisation |
| **SYSTEM** | Calculations, validation, BOM generation (triggers + application layer) |

The database enforces these roles through triggers and constraints; the backend must mirror them.

## Key Concepts for Developers

### 1. Snapshot Immutability
Every project has one `project_snapshot` created atomically with the project. All runtime queries must use `snapshot_id`, never `template_id`. Changes to the live template do not affect existing projects.

### 2. Idempotent Operations
`create_project()` and `finalize_project()` use idempotency keys. Duplicate calls return the same result. Do not implement your own retry logic without using these functions.

### 3. Trigger-Driven State
Catalogue READY status, template demotion, and BOM supersession are managed by database triggers. Do not update status columns directly – the system will reject it.

### 4. Hard Deletion Prohibited
All entities use soft deletion (status flags). Hard DELETE is blocked by foreign keys or triggers.

### 5. Data Denormalisation is Intentional
`final_bom_line` denormalises SKU attributes at finalisation. This guarantees immutability even if the SKU later changes. Do not "normalise" this out.

## What You Can Change

- You may create new functions or views for reporting/analytics, but they must not modify data or violate constraints.
- You may add indexes after performance profiling (but never on production without review).
- You may extend the test harness with additional regression tests, but the existing tests must always pass.

## How to Add a Database Change

1. Start from the frozen specification. A new requirement must be documented and accepted.
2. Create a migration script in `migrations/` (e.g., `v1.1.5_to_v1.2.0.sql`).
3. Update the baseline script to reflect the new schema.
4. Add corresponding tests to the regression harness.
5. Run the harness on a fresh PostgreSQL instance.
6. Once verified, tag the new version and update all documentation.

**Remember:** The verification harness is the gate. No change is accepted until the harness passes.

## Supabase-Specific Notes

- The database is hosted on Supabase (project: `fbiemsbykrmrbqcsobvh`)
- All tables are in the `perfecity` schema (not `public`)
- Row Level Security (RLS) needs to be configured before client access
- Use `SET search_path TO perfecity;` when writing queries
- Supabase Edge Functions or backend services should use the `service_role` key for trigger/function operations

## Three Product Types

| Type | Role | Description |
|------|------|-------------|
| WALL_PANEL | Primary | The main wall covering product |
| LIGHT | Child | Lighting attached to wall panels |
| FURNITURE | Add-on | Furniture/shelving mounted on walls |

## Core Flow

```
SKU Master (ADMIN) → Product Catalogue (ADMIN) → Designer Canvas → Template + Master BOM
    → Design Library → Consultant Selects → Project Created → Immutable Snapshot
    → Site Measurements → Validation → Quantity Resolution → Actual BOM → Final BOM (Immutable)
```
