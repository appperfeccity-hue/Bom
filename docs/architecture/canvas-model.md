# Canvas Model — Semantics, Authority, and Invariants

Governing principle: the frozen database baseline (`baseline/v1.1.5_baseline.sql`,
tag `mvp-v1.0.1-hardened`) is authoritative and immutable. Schema changes are made
only through new versioned migrations under `migrations/`. The canvas model adds
missing semantics and engine behavior; it never re-implements a rule the database
already enforces.

---

## 1. Wall type: `L_SHAPE` canonical, `L_CORNER` legacy

`L_SHAPE` is the canonical domain and display name for all new behavior.
`L_CORNER` remains a fully accepted value: it exists in frozen snapshots and
historical rows, and those are never rewritten.

- Alias helpers live in `frontend/src/engines/wallType.ts`
  (`normalizeWallType`, `denormalizeWallType`, `isLShape`, `isAcceptedWallType`,
  `wallTypeLabel`).
- Readers and validators accept both values. Comparison against string literals
  is replaced by `isLShape()` throughout the frontend.
- `migrations/v1.2.3_wall_type_l_shape.sql` expands the wall-type CHECK sets
  additively; no data is rewritten.
- The `L_SHAPE` corner point is the canvas origin `(0,0)`
  (`L_SHAPE_CORNER_ORIGIN`).

## 2. Canonical parameter-key mapping

`template_consultant_permission.parameter_key` uses the baseline UPPERCASE
vocabulary; that vocabulary is authoritative and is not redesigned. Types are
`DIMENSION | SKU_SELECTION | OPTION | BOOLEAN`; edit modes are
`LOCKED | RESTRICTED | FREE`.

The single source of the mapping is `frontend/src/lib/measurementModel.ts`:

| permission key    | project_measurement column | wall_geometry default key |
| ----------------- | -------------------------- | ------------------------- |
| `WALL_WIDTH`      | `wall_width_mm`            | `base_width_mm`           |
| `WALL_HEIGHT`     | `wall_height_mm`           | `base_height_mm`          |
| `SEGMENT_A_WIDTH` | `segment_a_width_mm`       | `segment_a_width_mm`      |
| `SEGMENT_B_WIDTH` | `segment_b_width_mm`       | `segment_b_width_mm`      |

Permission authoring (`AddPermissionDialog`) writes the baseline columns
`parameter_key`, `parameter_type`, `edit_mode`, `min_value`, `max_value`,
`allowed_values`. Consumers (`MeasurementPanel`, `usePermissionEnforcement`)
resolve raw measurement columns to these canonical keys before any lookup.

## 3. `PermanentMeasurement` is a projection

```ts
interface PermanentMeasurement {
  default: number | null;
  actual: number;
  minimum: number | null;
  maximum: number | null;
}
```

Provenance — no field is a new source of truth:

- `default` — snapshot `wall_geometry` (frozen by `build_template_snapshot`).
- `minimum` / `maximum` — frozen `consultant_permissions` `min_value`/`max_value`,
  matched by canonical UPPERCASE key.
- `actual` — `project_measurement.*_mm`; the only value authored at the project
  layer.

No columns were added to `project_measurement`, no segment defaults were added to
`base_dimensions`, and derived quantities (segment length, area) never carry this
bundle.

**Absent-permission rule:** an adaptable field with no permission row is treated
as `LOCKED`, not as freely editable. `ProjectedMeasurement.hasPermission`
distinguishes "no permission was frozen" from "explicitly locked", and the UI
surfaces the difference.

## 4. Four distinct bound sources

They are deliberately kept separate and are not merged:

1. **Template consultant range** — `consultant_permissions` `min_value`/`max_value`.
   The authoritative adaptation range; it takes priority in validation.
2. **Generic DB-safety clamps** — `MeasurementPanel` fallback bounds and the
   `project_measurement` CHECK constraints. Secondary safety only.
3. **Zone CHECK constraints** — `template_zone` width 200–3000 mm,
   height 200–2700 mm. Authoritative for zone dimensions; not re-implemented in
   the frontend.
4. **Site adaptation defaults** — `siteAdaptationEngine.ts`
   (`DEFAULT_MIN_WIDTH` 200 / max 3000, height 200 / 2700).

## 5. Zones and installation area

- **One SKU per zone** is enforced by `uq_zone_single_sku` on
  `template_zone_sku`. The frontend surfaces and respects it; it does not
  duplicate it.
- **Zone dimensions** reuse the existing `template_zone` CHECK constraints.
- **Maximum three zones per wall** is the one genuinely new zone rule
  (`MAX_ZONES_PER_WALL` in `frontend/src/engines/installationArea.ts`, a
  `projectStore.addZone` guard, the BOM configuration cap applied in `bomStore`,
  and a constraint trigger added by
  `migrations/v1.2.4_installation_area_and_zone_cap.sql`).
- **Installation area** (`FULL | PARTIAL` + `outerEdge`) is the parent of zones.
  Zones are bounded by the installation-area outer edge, not by the full wall.
  Zones expose `zoneOuterEdge` (installation boundary), `zoneInnerEdge`
  (zone ↔ SKU relationship) and derived `zoneArea`. Persistence is additive
  (same migration); rendering is a dashed outline in `WallOutlineLayer`.

## 6. Area division is an input, never the final quantity

Pipeline order:

```
Wall Geometry -> Zone Geometry -> Zone Area -> SKU Assignment (1 SKU/zone)
  -> SKU Actual Area -> Area-Division Quantity -> wallPanelEngine (rows/cols/cuts)
  -> Validation / Reconciliation -> Final BOM Quantity
```

`frontend/src/engines/zoneCoverageEngine.ts` is a pure helper:

```
skuActualArea    = sku.width_mm * sku.height_mm
zoneArea         = zone.width_mm * zone.height_mm
rawPanelQuantity = zoneArea / skuActualArea
panelQuantity    = CEILING(zoneArea / skuActualArea)
```

`runQuantityCalculation` computes this expected coverage alongside — never
instead of — `calculateWallPanels`. `wallConfigEngine`/`generatePanelFrames`
(8 fit algorithms) remain the fit and feasibility authority, and
`procurementQuantity` remains the BOM quantity. When the two figures diverge the
pipeline emits the warning `QTY_AREA_FIT_DIVERGENCE`; it never silently
overrides either figure.

## 7. Cove vs profile lighting geometry

`MountingType` and the `lightEngine` offsets (`DIRECT` 0, `PROFILE` 5, `COVE` 10)
remain the quantity math. `frontend/src/engines/lightingGeometry.ts` adds the
physical relationship, which is genuinely different per type:

| type      | layer order                        | mounting surface | structure |
| --------- | ---------------------------------- | ---------------- | --------- |
| `DIRECT`  | wall → light                       | wall             | no        |
| `PROFILE` | wall → panel → light               | panel face       | no        |
| `COVE`    | wall → structure → light → panel   | structure        | yes       |

Only `COVE` creates Z-depth between wall and panel, and only `COVE` requires a
structure — the existing rule is unchanged. `LightingLayer` draws the two
differently: a cove light is recessed behind the panel outline with its
structure bracket; a profile light sits on the panel face.

## 8. Physical `product_type` vs semantic role

Physical `product_type` (`WALL_PANEL`, `LIGHT`, `FURNITURE`,
`HIDDEN_COMPONENT`) is a property of the SKU and is never conflated with a
semantic product role. No generic `parent_sku_id` was added; existing
relationship semantics are reused (`sku_compatibility ALTERNATIVE_TO` +
`template_zone_alternative` for alternatives, `sku_variant` for variants,
`template_trim`/`template_hidden_component` with its `parent_component_id`
self-reference for components).

`migrations/v1.2.5_product_type_persistence.sql` fixes the persistence defect:
`HIDDEN_COMPONENT` is registered in `product_master` (the FK target previously
rejected it) and a trigger rejects a BOM line whose `product_type` disagrees with
the referenced SKU's physical `product_type`, so the
`COALESCE(..., 'WALL_PANEL')` default in `save_actual_bom` can no longer silently
reclassify a `LIGHT` or `FURNITURE` line. Classification flows
`BomOutputLine.productType` → `actual_bom_line.product_type` →
`final_bom_line.product_type`.

### 8.1 SKU dependency graph (v1.2.6)

`sku_dependency` (`migrations/v1.2.6_sku_dependency_graph.sql`) is the
*generation* relationship: `parent_sku_id → child_sku_id` with
`dependency_type` (`REQUIRED` | `CONDITIONAL` | `OPTIONAL`), an optional
`condition` (`{field, operator, value}`), and a `quantity_rule`
(`PER_PARENT` | `PER_AREA` | `PER_LENGTH` | `PER_EDGE` | `FIXED`) with
`quantity_factor` and `unit_of_measure`. It is distinct from
`sku_compatibility`, which remains *validation-only*. A trigger rejects an
active edge that would close a cycle.

`build_template_snapshot` freezes the transitive closure of every SKU the
template references under `snapshot_data.sku_dependencies` (each row embeds the
frozen child `sku_master` record). `skuDependencyEngine.resolveSkuDependencies`
expands primary BOM lines recursively and deterministically after quantity
calculation; each generated `BomOutputLine` carries `dependency = {parentSkuId,
dependencyId, dependencyType, quantityRule, level}`, persisted in
`actual_bom_line.calculation_inputs`, and reconciliation never merges lines
across different parents or levels. Cycles and missing geometry context
(`DEP_CIRCULAR_DEPENDENCY`, `DEP_CONTEXT_MISSING`) block the BOM; an
unresolvable condition field (`DEP_CONDITION_UNRESOLVED`) is a warning and the
child is omitted. Snapshots without `sku_dependencies` behave as an empty graph.

## 9. SKU identity invariant

`sku_master` physical identity — width, height, thickness, depth, colour,
finish, pattern identity, and `product_type` — is admin-only and immutable to
DESIGNER and CONSULTANT roles.

- `build_template_snapshot` freezes complete SKU records via `to_jsonb(sm.*)`.
- Consultant SKU selection (`projectStore.assignSku`, validated by
  `save_actual_bom` against the snapshot SKU set) only changes **which** frozen
  SKU a zone references.
- Measurement adaptation changes **site geometry** only.

Neither operation ever mutates SKU attributes. Measurement adaptation changes
site geometry; SKU selection changes which fixed catalogue item is used.
