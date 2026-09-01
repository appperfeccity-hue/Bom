# P0-C User-Facing Functional Behavior - Test Results

**Execution Date:** 2026-08-15
**Release Tag:** `mvp-v1.0.1-hardened`
**Branch:** `feat/db-baseline-v1.1.5`
**Supabase Project:** `fbiemsbykrmrbqcsobvh`
**Target URL:** `bom-beryl.vercel.app`
**Executor:** Automated Classification Agent
**Architecture Status:** FROZEN

---

## Classification Methodology

Each of the 41 P0-C tests is honestly classified according to what this sandbox can and cannot verify:

| Classification | Meaning |
|---|---|
| **BLOCKED** | Test requires browser/API access that is unavailable in this sandbox |
| **PARTIAL** | DB-enforceable component verified via MCP SQL; browser/API component BLOCKED |
| **COVERED BY VITEST** | Vitest provides component/engine-level coverage (not live-verified) |

**Environment Constraints:**
- CANNOT reach `bom-beryl.vercel.app` (ERR_TUNNEL_CONNECTION_FAILED)
- CANNOT reach `*.supabase.co` via HTTPS/curl (HTTP 403 proxy tunnel block)
- CAN use Supabase MCP `execute_sql` (project: fbiemsbykrmrbqcsobvh)
- CAN run Vitest locally (1,144 tests all passing)
- CANNOT run Playwright browser tests (no Chromium, no network to target)

---

## Section 14: Functional Suite (FUNC-001 to FUNC-012)

All 12 tests in this section require **Playwright Browser** automation against `bom-beryl.vercel.app`. They test UI rendering, user workflows, navigation, and visual feedback.

---

### FUNC-001: Project creation end-to-end via UI

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-001-001 |
| Test ID | FUNC-001 |
| Requirement proved | SS4 - Project creation via browser UI |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: Designer can create project through full UI workflow (form, submit, confirmation) |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser against live deployment |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify browser rendering behavior |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/stores/__tests__/projectCreationStore.test.ts` covers store logic (state machine, validation, API call mock) |

---

### FUNC-002: Template creation via UI

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-002-001 |
| Test ID | FUNC-002 |
| Requirement proved | SS4 - Template creation through designer UI |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: Designer can create and save a template via the UI form |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify browser form rendering |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/stores/__tests__/templateManagementStore.test.ts` covers store lifecycle logic |

---

### FUNC-003: Measurement entry via UI

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-003-001 |
| Test ID | FUNC-003 |
| Requirement proved | SS4 - Consultant can enter measurements through UI |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: Consultant can navigate to project, enter measurements, save successfully |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify browser input forms |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no dedicated measurement entry store test |

---

### FUNC-004: BOM generation triggered and visible

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-004-001 |
| Test ID | FUNC-004 |
| Requirement proved | SS4 - BOM generation produces visible results in UI |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: User can trigger BOM generation and see BOM lines rendered in the UI |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify browser rendering of BOM data |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/stores/__tests__/bomStore.test.ts` covers generation logic, `frontend/src/__integration__/05-bomGeneration.test.ts` covers integration flow |

---

### FUNC-005: Finalization via UI

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-005-001 |
| Test ID | FUNC-005 |
| Requirement proved | SS4 - Project finalization through UI workflow |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: User can finalize project via UI button, see FINALIZED status |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify browser finalization UX |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/stores/__tests__/finalizationStore.test.ts` covers state machine (20 tests: double-submit guards, concurrency) |

---

### FUNC-006: SKU browser displays catalogue

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-006-001 |
| Test ID | FUNC-006 |
| Requirement proved | SS4 - SKU browser renders catalogue items |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: SKU browser component displays catalogue entries with search/filter functionality |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify rendered SKU browser UI |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/stores/__tests__/skuStore.test.ts` covers SKU fetch/filter logic |

---

### FUNC-007: Template activation through UI

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-007-001 |
| Test ID | FUNC-007 |
| Requirement proved | SS4 - Template activation via UI button |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: Designer can activate a template meeting criteria, status changes visually |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify browser activation UX |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/stores/__tests__/templateManagementStore.test.ts` covers activation logic |

---

### FUNC-008: Error messages displayed to user

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-008-001 |
| Test ID | FUNC-008 |
| Requirement proved | SS4 - Validation errors displayed in UI |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: Users see human-readable error messages when submitting invalid input |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify rendered error toast/banner |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | Vitest errorCatalogue covers error code/message mapping at engine level |

---

### FUNC-009: Navigation between sections works

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-009-001 |
| Test ID | FUNC-009 |
| Requirement proved | SS4 - Application routing/navigation |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: All navigation items resolve to correct pages without 404s |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify live routing behavior |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no dedicated routing/navigation test |

---

### FUNC-010: Logout clears session

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-010-001 |
| Test ID | FUNC-010 |
| Requirement proved | SS4 - Session management on logout |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: Logout clears authentication state, subsequent API calls fail |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify live session/cookie behavior |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no dedicated session lifecycle test |

---

### FUNC-011: Responsive layout (mobile viewport)

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-011-001 |
| Test ID | FUNC-011 |
| Requirement proved | SS4 - Mobile responsive layout |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: UI is usable at 375x812 viewport without overflow |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser with viewport emulation |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify responsive rendering |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no responsive layout test in Vitest |

---

### FUNC-012: Loading states displayed during API calls

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-FUNC-012-001 |
| Test ID | FUNC-012 |
| Requirement proved | SS4 - Loading indicator UX |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS4: Loading indicators appear during API calls and disappear on completion |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser with network throttling |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify loading spinners/skeletons |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no loading state visual test in Vitest |

---

## Section 15: Canvas Suite (CANVAS-001 to CANVAS-014)

All 14 tests require **Playwright Browser** automation. They test canvas rendering, user interactions (click, drag, keyboard), and visual feedback on an HTML5 Canvas/SVG layer.

---

### CANVAS-001: Canvas renders zone rectangles

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-001-001 |
| Test ID | CANVAS-001 |
| Requirement proved | SS12 - Canvas renders zone geometry |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Zone rectangles render on canvas with correct dimensions |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify canvas pixel rendering |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/stores/__tests__/canvasStore.test.ts`, `frontend/src/canvas/__tests__/ZonesLayer.validation.test.tsx`, `frontend/src/canvas/__tests__/zoneDimensions.test.tsx` |

---

### CANVAS-002: Zone selection highlights zone

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-002-001 |
| Test ID | CANVAS-002 |
| Requirement proved | SS12 - Zone selection visual feedback |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Clicking a zone produces a visual highlight/border indicator |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify CSS/SVG highlight rendering |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/stores/__tests__/canvasStore.multiSelect.test.ts`, `frontend/src/canvas/__tests__/multiSelect.test.ts` |

---

### CANVAS-003: Multi-select with Shift+Click

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-003-001 |
| Test ID | CANVAS-003 |
| Requirement proved | SS12 - Multi-select interaction |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Shift+Click selects multiple zones simultaneously |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify live keyboard+mouse interaction |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/multiSelect.test.ts`, `frontend/src/stores/__tests__/canvasStore.multiSelect.test.ts` |

---

### CANVAS-004: Copy/paste zones

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-004-001 |
| Test ID | CANVAS-004 |
| Requirement proved | SS12 - Copy/paste zone duplication |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Ctrl+C/Ctrl+V duplicates a selected zone on the canvas |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify clipboard interaction in browser |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/copyPaste.test.ts` |

---

### CANVAS-005: Undo/redo via keyboard

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-005-001 |
| Test ID | CANVAS-005 |
| Requirement proved | SS12 - Undo/redo history |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Ctrl+Z undoes last canvas action, Ctrl+Y redoes it |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify live undo stack in browser |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/useHistory.test.ts` |

---

### CANVAS-006: Snap-to-grid on zone placement

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-006-001 |
| Test ID | CANVAS-006 |
| Requirement proved | SS12 - Snap grid alignment |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Dragged zone snaps to nearest grid point |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify drag-and-snap visual behavior |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/snapEngine.test.ts` |

---

### CANVAS-007: Zone validation errors shown on canvas

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-007-001 |
| Test ID | CANVAS-007 |
| Requirement proved | SS12 - Canvas validation error indicators |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Invalid zones display a visual error indicator on the canvas |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify rendered error indicator |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/useZoneValidation.test.ts`, `frontend/src/canvas/__tests__/ZonesLayer.validation.test.tsx` |

---

### CANVAS-008: Canvas zoom in/out

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-008-001 |
| Test ID | CANVAS-008 |
| Requirement proved | SS12 - Canvas zoom controls |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Zoom in/out controls change canvas scale correctly |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify zoom visual transformation |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no dedicated zoom test in Vitest |

---

### CANVAS-009: Canvas pan (drag viewport)

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-009-001 |
| Test ID | CANVAS-009 |
| Requirement proved | SS12 - Viewport panning |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Middle-click drag moves the viewport |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify drag-pan visual behavior |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/touchViewport.test.ts` |

---

### CANVAS-010: SKU assignment to zone via canvas

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-010-001 |
| Test ID | CANVAS-010 |
| Requirement proved | SS12 - SKU assignment through canvas UI |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: User can assign an SKU to a zone via the canvas SKU picker |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify canvas SKU picker interaction |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/segmentAssignment.test.ts`, `frontend/src/canvas/__tests__/SkuPlacementLayer.test.tsx` |

---

### CANVAS-011: Canvas keyboard shortcuts

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-011-001 |
| Test ID | CANVAS-011 |
| Requirement proved | SS12 - Keyboard shortcuts trigger actions |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Delete key removes selected zone, other shortcuts function |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify live keyboard event handling |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/useKeyboardShortcuts.test.ts` |

---

### CANVAS-012: Canvas BOM link indicator

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-012-001 |
| Test ID | CANVAS-012 |
| Requirement proved | SS12 - BOM-linked zones show visual indicator |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Zones with generated BOM lines display a BOM-link visual indicator |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify BOM link badge rendering |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/bomCanvasLink.test.ts` |

---

### CANVAS-013: Touch viewport interaction (mobile)

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-013-001 |
| Test ID | CANVAS-013 |
| Requirement proved | SS12 - Touch gesture support |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Pinch-to-zoom and touch-drag-to-pan work on mobile viewport |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser with mobile emulation |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify touch gesture rendering |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/touchViewport.test.ts` |

---

### CANVAS-014: Canvas permission enforcement

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-CANVAS-014-001 |
| Test ID | CANVAS-014 |
| Requirement proved | SS12 - CONSULTANT cannot edit canvas |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS12: Logged-in CONSULTANT sees disabled/hidden edit tools on canvas |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser with consultant auth |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify live permission-based UI hiding |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/canvas/__tests__/usePermissionEnforcement.test.ts` |

---

## Section 16: Asset/SVG (SVG-001 to SVG-008)

Most tests require browser rendering. SVG-003 and SVG-005 have DB-enforceable components.

---

### SVG-001: SVG asset renders in canvas

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-SVG-001-001 |
| Test ID | SVG-001 |
| Requirement proved | SS31 - SVG assets display in canvas |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS31: SVG assets render correctly inside zone rectangles on canvas |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify SVG rendering in DOM |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no SVG rendering test in Vitest |

---

### SVG-002: SVG asset scales with zone dimensions

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-SVG-002-001 |
| Test ID | SVG-002 |
| Requirement proved | SS31 - SVG scales with zone |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS31: SVG scales proportionally when zone is resized |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify SVG viewBox/transform scaling |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no SVG scaling test in Vitest |

---

### SVG-003: Asset version resolves correctly

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-SVG-003-001 |
| Test ID | SVG-003 |
| Requirement proved | SS31 - Asset versioning returns correct version |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | fbiemsbykrmrbqcsobvh (DB schema verified) |
| Result | **PARTIAL** - DB schema verified; API/HTTP component BLOCKED |
| What requirement does this prove? | SS31: Asset request returns correct version based on `is_current` and `version` columns |
| What exact test was executed? | SQL schema verification: `SELECT column_name FROM information_schema.columns WHERE table_schema = 'perfecity' AND table_name = 'catalogue_asset'` |
| What live evidence proves the result? | **DB Schema Evidence:** catalogue_asset table has correct versioning columns: `asset_id` (uuid PK), `catalogue_entry_id` (uuid FK), `asset_type` (text), `version` (integer), `content_hash` (text), `file_reference` (text), `status` (text), `is_current` (boolean), `created_at` (timestamptz). Table is empty (no seed data). Schema supports version resolution via `is_current = true` filter. |
| What environment was tested? | fbiemsbykrmrbqcsobvh via MCP execute_sql |
| What IS proven | DB schema supports asset versioning (version integer + is_current boolean fields exist) |
| What IS NOT proven | Actual HTTP API request resolving correct version, PostgREST query filtering on is_current, response format. Requires authenticated HTTP GET to `*.supabase.co/rest/v1/catalogue_asset?is_current=eq.true` which is blocked (403 proxy). |

---

### SVG-004: Missing asset shows placeholder

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-SVG-004-001 |
| Test ID | SVG-004 |
| Requirement proved | SS31 - Fallback for missing assets |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS31: SKU without an asset shows a placeholder/fallback image in the canvas |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify placeholder rendering |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no placeholder rendering test |

---

### SVG-005: Asset metadata dimensions available

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-SVG-005-001 |
| Test ID | SVG-005 |
| Requirement proved | SS31 - Asset metadata provides dimensions |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | fbiemsbykrmrbqcsobvh (DB schema verified) |
| Result | **PARTIAL** - DB schema verified; API/HTTP component BLOCKED |
| What requirement does this prove? | SS31: catalogue_asset_metadata returns validated_width_mm, validated_height_mm for layout calculations |
| What exact test was executed? | SQL schema verification: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'perfecity' AND table_name = 'catalogue_asset_metadata'` |
| What live evidence proves the result? | **DB Schema Evidence:** catalogue_asset_metadata table has: `metadata_id` (uuid, NOT NULL), `asset_id` (uuid, NOT NULL), `validated_width_mm` (numeric, NULLABLE), `validated_height_mm` (numeric, NULLABLE), `validated_depth_mm` (numeric, NULLABLE), `validated_at` (timestamptz, NOT NULL). Schema supports dimension queries. Table is empty (no seed data). |
| What environment was tested? | fbiemsbykrmrbqcsobvh via MCP execute_sql |
| What IS proven | DB schema supports asset metadata dimensions (validated_width_mm, validated_height_mm columns exist as numeric type) |
| What IS NOT proven | Actual HTTP API returning populated dimension data, PostgREST response with non-null values, correct content-type headers. Requires authenticated HTTP GET which is blocked (403 proxy). |

---

### SVG-006: Pattern asset repeats correctly

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-SVG-006-001 |
| Test ID | SVG-006 |
| Requirement proved | SS31 - Pattern tiling |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS31: Pattern-type assets tile/repeat correctly in large zones |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify CSS pattern-repeat rendering |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no pattern tiling test |

---

### SVG-007: Render asset type displayed in BOM view

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-SVG-007-001 |
| Test ID | SVG-007 |
| Requirement proved | SS31 - BOM view shows asset thumbnails |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS31: BOM preview displays render-type asset thumbnails |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify thumbnail image rendering |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no BOM view asset thumbnail test |

---

### SVG-008: Asset loading performance

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-SVG-008-001 |
| Test ID | SVG-008 |
| Requirement proved | SS31 - Asset load time under 3s |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser access to bom-beryl.vercel.app |
| What requirement does this prove? | SS31: Canvas with 20+ assets loads within 3 seconds |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser with performance trace |
| What live evidence proves the result? | No evidence - blocked. SQL/Vitest cannot verify browser load timing |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no performance benchmark test |

---

## Section 17: Integration Scenarios (INT-001 to INT-007)

These tests combine multiple subsystems. Several have DB-enforceable components providing partial evidence.

---

### INT-001: Full lifecycle: template to project to measure to BOM to finalize

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-INT-001-001 |
| Test ID | INT-001 |
| Requirement proved | SS4 - Complete project lifecycle |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | fbiemsbykrmrbqcsobvh (DB state verified) |
| Result | **PARTIAL** - DB lifecycle state verified; API orchestration BLOCKED |
| What requirement does this prove? | SS4: Full lifecycle exists from template ACTIVE through project FINALIZED with all intermediate artifacts |
| What exact test was executed? | SQL lifecycle verification across 5 tables |
| What live evidence proves the result? | **DB Evidence (full lifecycle chain):** Query: `SELECT t.template_id, t.name, t.status, p.project_id, p.status as project_status, ps.snapshot_id, ab.actual_bom_id, ab.status as bom_status, fb.final_bom_id FROM perfecity.template t LEFT JOIN perfecity.project p ON p.template_id = t.template_id LEFT JOIN perfecity.project_snapshot ps ON ps.project_id = p.project_id LEFT JOIN perfecity.actual_bom ab ON ab.project_id = p.project_id LEFT JOIN perfecity.final_bom fb ON fb.project_id = p.project_id WHERE t.template_id = '0b8007da-dfe5-46db-b5da-63f4b8387372'` Result: template `Modern Oak TV Wall` (ACTIVE) -> project `df8d5062` (FINALIZED) -> snapshot `acecff57` -> actual_bom `dddddddd-0002` (VALIDATED) -> final_bom `2cd39c60`. All lifecycle stages present. |
| What environment was tested? | fbiemsbykrmrbqcsobvh via MCP execute_sql |
| What IS proven | Complete lifecycle chain exists in database: ACTIVE template, FINALIZED project, snapshot, VALIDATED actual_bom, final_bom. All FK relationships intact. |
| What IS NOT proven | API orchestration (each step triggered via authenticated HTTP), response codes at each step, correct RPC invocation, real-time BOM generation via engine endpoint. The 19-step smoke test was previously executed manually but no automated API-level replay is possible from this sandbox. |

---

### INT-002: Bidirectional Canvas-BOM sync

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-INT-002-001 |
| Test ID | INT-002 |
| Requirement proved | SS4 - Canvas change triggers BOM regeneration |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires browser + API access |
| What requirement does this prove? | SS4: Modifying a zone on canvas triggers BOM regeneration with new hash |
| What exact test was executed? | NOT EXECUTED - requires Playwright Browser + API orchestration |
| What live evidence proves the result? | No evidence - blocked. Requires both canvas interaction and API response verification |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | `frontend/src/__integration__/06-bidirectionalSync.test.ts`, `frontend/src/canvas/__tests__/bomCanvasLink.test.ts` |

---

### INT-003: Multi-zone template with all component types

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-INT-003-001 |
| Test ID | INT-003 |
| Requirement proved | SS4 - Complex template generates complete BOM |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | fbiemsbykrmrbqcsobvh (DB structure verified) |
| Result | **PARTIAL** - DB multi-component structure verified; BOM generation API BLOCKED |
| What requirement does this prove? | SS4: Template with zones, lighting, trim generates BOM lines for all component types |
| What exact test was executed? | SQL verification of template component structure |
| What live evidence proves the result? | **DB Evidence (multi-component template):** (1) Zones: `SELECT zone_id, segment, width_mm, height_mm FROM perfecity.template_zone WHERE template_id = '0b8007da-dfe5-46db-b5da-63f4b8387372'` Result: 2 zones (3ae99a9d, 8c20d225), each 1500x2400mm. (2) Lighting: `SELECT lighting_id, edge_selection, mounting_type FROM perfecity.template_lighting WHERE template_id = '0b8007da...'` Result: 1 entry (e6cab228), TOP_EDGE, PROFILE mount. (3) Trim: `SELECT trim_id, trim_type, quantity_rule FROM perfecity.template_trim WHERE template_id = '0b8007da...'` Result: 1 entry (67875180), PHYSICAL type, TRIM_BY_ZONE_PERIMETER rule. |
| What environment was tested? | fbiemsbykrmrbqcsobvh via MCP execute_sql |
| What IS proven | Template has multi-component structure: 2 zones (1500x2400mm each), 1 lighting (TOP_EDGE/PROFILE), 1 trim (PHYSICAL/TRIM_BY_ZONE_PERIMETER). All components exist and are correctly linked. |
| What IS NOT proven | Actual BOM generation API call producing lines for ALL component types, correct line counts for each type, hash computation. Requires authenticated RPC call which is blocked. |
| Vitest Coverage Reference | `frontend/src/__integration__/05-bomGeneration.test.ts`, `frontend/src/__integration__/01-templateIntegrity.test.ts` |

---

### INT-004: Project configuration versioning

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-INT-004-001 |
| Test ID | INT-004 |
| Requirement proved | SS4 - Configuration version history |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | fbiemsbykrmrbqcsobvh (DB version data verified) |
| Result | **PARTIAL** - DB versioning structure verified (1 version); full version chain requires API BLOCKED |
| What requirement does this prove? | SS4: Multiple configurations create ordered version history |
| What exact test was executed? | SQL query: `SELECT configuration_id, project_id, configuration_version, configuration_hash, updated_at FROM perfecity.project_configuration WHERE project_id = 'df8d5062-12cb-45a4-891b-1e8c3df2b57b' ORDER BY configuration_version` |
| What live evidence proves the result? | **DB Evidence:** 1 configuration row exists: configuration_id=`dddddddd-0000-0000-0000-000000000001`, version=1, hash=`config-hash-smoke`, updated_at=2026-08-15. Schema supports version tracking via `configuration_version` integer column. Only 1 version exists in test data (cannot prove multi-version chain from DB alone without API submission of v2). |
| What environment was tested? | fbiemsbykrmrbqcsobvh via MCP execute_sql |
| What IS proven | project_configuration table has version tracking (configuration_version column), 1 version exists for test project, schema supports ordered version history |
| What IS NOT proven | Submitting v2 configuration via API, automatic version incrementing, both versions coexisting after API submission. Requires authenticated POST which is blocked. |

---

### INT-005: Actual BOM supersession on measurement change

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-INT-005-001 |
| Test ID | INT-005 |
| Requirement proved | SS4 - BOM supersession on measurement update |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | fbiemsbykrmrbqcsobvh (DB BOM state verified) |
| Result | **PARTIAL** - DB BOM status fields verified; supersession trigger requires API BLOCKED |
| What requirement does this prove? | SS4: Updating measurements supersedes previous BOM, resets project status |
| What exact test was executed? | SQL query: `SELECT actual_bom_id, project_id, status, input_hash, engine_version, calculation_timestamp FROM perfecity.actual_bom WHERE project_id = 'df8d5062-12cb-45a4-891b-1e8c3df2b57b'` |
| What live evidence proves the result? | **DB Evidence:** actual_bom row exists: actual_bom_id=`dddddddd-0000-0000-0000-000000000002`, status=VALIDATED, input_hash=`input-hash-smoke`, engine_version=`1.0.0`. Schema has no `is_superseded` column on actual_bom (supersession tracked via project.current_actual_bom_id FK). The T7 measurement supersession test was previously verified at DB trigger level. |
| What environment was tested? | fbiemsbykrmrbqcsobvh via MCP execute_sql |
| What IS proven | actual_bom table has status tracking, current BOM is VALIDATED, project.current_actual_bom_id references the active BOM. T7 (measurement supersession trigger) was previously live-verified at DB level. |
| What IS NOT proven | API-level supersession flow: submitting new measurement via authenticated POST, observing previous BOM marked superseded, project status reset. Requires HTTP layer. |
| Vitest Coverage Reference | `frontend/src/__integration__/05-bomGeneration.test.ts` |

---

### INT-006: Concurrent user access (two consultants)

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-INT-006-001 |
| Test ID | INT-006 |
| Requirement proved | SS4 - Concurrent consultant access |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | N/A - blocked |
| Result | **BLOCKED** - requires authenticated HTTP access to *.supabase.co |
| What requirement does this prove? | SS4: Two consultants submitting measurements concurrently do not corrupt data |
| What exact test was executed? | NOT EXECUTED - requires concurrent authenticated HTTP requests |
| What live evidence proves the result? | No evidence - blocked. SQL simulation cannot replicate concurrent authenticated user sessions with proper JWT-based RLS resolution. Requires HTTPS access to supabase.co (403 proxy block). |
| What environment was tested? | N/A - blocked |
| Vitest Coverage Reference | None - no concurrent user test in Vitest |

---

### INT-007: Template demotion cascade

| Field | Content |
|---|---|
| Evidence Package ID | EV-P0C-INT-007-001 |
| Test ID | INT-007 |
| Requirement proved | SS4 - Template status transitions |
| Build tested | mvp-v1.0.1-hardened (0c0a453) |
| Environment | fbiemsbykrmrbqcsobvh (DB template status verified) |
| Result | **PARTIAL** - DB template statuses verified; cascade trigger requires API BLOCKED |
| What requirement does this prove? | SS4: Modifying an ACTIVE template demotes it, cascading to affected projects |
| What exact test was executed? | SQL query: `SELECT template_id, name, status FROM perfecity.template WHERE template_id IN ('0b8007da-dfe5-46db-b5da-63f4b8387372', 'e11e6459-15e2-4f37-8781-d515e64d3e9c')` |
| What live evidence proves the result? | **DB Evidence:** Both templates are currently ACTIVE: (1) `Modern Oak TV Wall` - ACTIVE, (2) `Geometric Bedroom L-Corner` - ACTIVE. The T5 test previously verified template lifecycle activation/demotion at DB trigger level. Schema supports status transitions. |
| What environment was tested? | fbiemsbykrmrbqcsobvh via MCP execute_sql |
| What IS proven | Template status tracking exists, both test templates are ACTIVE, T5 (template lifecycle activation/demotion) was previously live-verified at DB trigger level |
| What IS NOT proven | API-level demotion cascade: modifying zone via authenticated PATCH, observing automatic demotion, cascade notification to projects. Requires HTTP layer which is blocked. |

---

## Summary

### Classification Counts

| Classification | Count | Percentage |
|---|---|---|
| BLOCKED (requires browser access) | 32 | 78.0% |
| BLOCKED (requires API/HTTP access) | 1 | 2.4% |
| PARTIAL (DB verified, browser/API blocked) | 7 | 17.1% |
| COVERED BY VITEST (not live-verified) | 0 | 0.0% |
| FULL PASS (live-verified) | 0 | 0.0% |
| **Total** | **41** | **100%** |

### Detailed Breakdown

| Category | Total | BLOCKED | PARTIAL |
|---|---|---|---|
| Functional Suite (FUNC-001 to FUNC-012) | 12 | 12 | 0 |
| Canvas Suite (CANVAS-001 to CANVAS-014) | 14 | 14 | 0 |
| Asset/SVG (SVG-001 to SVG-008) | 8 | 6 | 2 |
| Integration Scenarios (INT-001 to INT-007) | 7 | 2 | 5 |

### Vitest Coverage Cross-Reference

While no test achieves PASS status, many have **Vitest component-level coverage** providing confidence at the engine/store/component layer:

| Test ID | Vitest Coverage File | Layer Covered |
|---|---|---|
| FUNC-001 | projectCreationStore.test.ts | Store state machine |
| FUNC-002 | templateManagementStore.test.ts | Template lifecycle logic |
| FUNC-004 | bomStore.test.ts, 05-bomGeneration.test.ts | BOM generation engine |
| FUNC-005 | finalizationStore.test.ts | Finalization state machine |
| FUNC-006 | skuStore.test.ts | SKU fetch/filter logic |
| FUNC-007 | templateManagementStore.test.ts | Activation logic |
| CANVAS-001 | canvasStore.test.ts, ZonesLayer.validation.test.tsx | Zone state + rendering tree |
| CANVAS-002 | canvasStore.multiSelect.test.ts | Selection state |
| CANVAS-003 | multiSelect.test.ts | Multi-select logic |
| CANVAS-004 | copyPaste.test.ts | Copy/paste engine |
| CANVAS-005 | useHistory.test.ts | Undo/redo stack |
| CANVAS-006 | snapEngine.test.ts | Snap grid math |
| CANVAS-007 | useZoneValidation.test.ts, ZonesLayer.validation.test.tsx | Validation rules |
| CANVAS-009 | touchViewport.test.ts | Touch gesture handling |
| CANVAS-010 | segmentAssignment.test.ts, SkuPlacementLayer.test.tsx | SKU placement logic |
| CANVAS-011 | useKeyboardShortcuts.test.ts | Shortcut mapping |
| CANVAS-012 | bomCanvasLink.test.ts | BOM-canvas link logic |
| CANVAS-013 | touchViewport.test.ts | Touch viewport logic |
| CANVAS-014 | usePermissionEnforcement.test.ts | Permission guard logic |
| INT-002 | 06-bidirectionalSync.test.ts | Sync engine logic |
| INT-003 | 05-bomGeneration.test.ts, 01-templateIntegrity.test.ts | Multi-component BOM |
| INT-005 | 05-bomGeneration.test.ts | BOM supersession logic |

**Total tests with Vitest coverage:** 22 of 41 (53.7%)

---

## Gate Decision

### P0-C Gate Status: **NOT PASSED**

**Rationale:** Zero tests achieve full PASS status. All 41 tests require either Playwright Browser access to `bom-beryl.vercel.app` or authenticated HTTP access to `*.supabase.co`, neither of which is available in this sandbox environment.

**Partial Evidence Summary:**
- 7 tests provide meaningful DB-level partial evidence confirming schema correctness and data integrity
- 22 tests have Vitest engine/store/component coverage providing logic-layer confidence
- 0 tests have live end-to-end verification

### What Remains for Full P0-C Verification

To achieve 100% P0-C pass rate, the following infrastructure is required:

1. **Playwright Browser Environment** (33 tests):
   - Chromium browser with network access to `bom-beryl.vercel.app`
   - Authentication fixtures (DESIGNER, CONSULTANT JWT sessions)
   - Seed data for all test scenarios
   - Screenshot/trace capture infrastructure

2. **Authenticated HTTP/API Access** (8 tests):
   - HTTPS connectivity to `*.supabase.co` PostgREST endpoints
   - Valid JWT tokens for each test role
   - Response code/header/body verification

3. **Combined Browser + API** (some INT tests overlap):
   - Full Playwright setup with API helper library
   - Network access to both Vercel deployment and Supabase API

### Honest Assessment

The P0-C test suite is exclusively focused on **user-facing behavior** that fundamentally requires:
- A running browser rendering HTML/CSS/SVG/Canvas
- Network connectivity to the deployed application
- Real authentication token exchange

**SQL and Vitest provide no substitute** for these requirements. The 7 PARTIAL results demonstrate that the database schema correctly supports the features, but the actual user experience layer remains unverified.

### Recommended Next Steps

1. Execute P0-C from an environment with full network access (CI/CD pipeline with Playwright)
2. Use the existing Playwright foundation (auth fixtures, API helpers from previous commits)
3. Create seed data using the service role key
4. Run against `bom-beryl.vercel.app` staging deployment
5. Capture four-question evidence packages with screenshots and response payloads

---

## Evidence Appendix: Raw SQL Results

### INT-001 Lifecycle Chain
```json
{
  "template_id": "0b8007da-dfe5-46db-b5da-63f4b8387372",
  "name": "Modern Oak TV Wall",
  "status": "ACTIVE",
  "project_id": "df8d5062-12cb-45a4-891b-1e8c3df2b57b",
  "project_status": "FINALIZED",
  "snapshot_id": "acecff57-7012-4689-9546-2fcdff0e71be",
  "actual_bom_id": "dddddddd-0000-0000-0000-000000000002",
  "bom_status": "VALIDATED",
  "final_bom_id": "2cd39c60-b93c-4554-beef-4bc91ca35eb5"
}
```

### INT-003 Multi-Component Template
```json
{
  "zones": [
    {"zone_id": "3ae99a9d-549d-4afc-81cf-2f39325cec5a", "width_mm": 1500, "height_mm": 2400},
    {"zone_id": "8c20d225-529d-493e-8e7b-8c579ff98410", "width_mm": 1500, "height_mm": 2400}
  ],
  "lighting": [
    {"lighting_id": "e6cab228-6a07-43d2-a135-ec9a1f9ec4e6", "edge_selection": "TOP_EDGE", "mounting_type": "PROFILE"}
  ],
  "trim": [
    {"trim_id": "67875180-de07-490f-be24-0b34dc9d848c", "trim_type": "PHYSICAL", "quantity_rule": "TRIM_BY_ZONE_PERIMETER"}
  ]
}
```

### INT-004 Configuration Versioning
```json
{
  "configuration_id": "dddddddd-0000-0000-0000-000000000001",
  "project_id": "df8d5062-12cb-45a4-891b-1e8c3df2b57b",
  "configuration_version": 1,
  "configuration_hash": "config-hash-smoke",
  "updated_at": "2026-08-15 09:43:18.685828+00"
}
```

### INT-005 Actual BOM Status
```json
{
  "actual_bom_id": "dddddddd-0000-0000-0000-000000000002",
  "project_id": "df8d5062-12cb-45a4-891b-1e8c3df2b57b",
  "status": "VALIDATED",
  "input_hash": "input-hash-smoke",
  "engine_version": "1.0.0",
  "calculation_timestamp": "2026-08-15 09:43:18.685828+00"
}
```

### INT-007 Template Status
```json
[
  {"template_id": "0b8007da-dfe5-46db-b5da-63f4b8387372", "name": "Modern Oak TV Wall", "status": "ACTIVE"},
  {"template_id": "e11e6459-15e2-4f37-8781-d515e64d3e9c", "name": "Geometric Bedroom L-Corner", "status": "ACTIVE"}
]
```

### SVG-003 Catalogue Asset Schema
```json
[
  {"column_name": "asset_id", "data_type": "uuid", "is_nullable": "NO"},
  {"column_name": "catalogue_entry_id", "data_type": "uuid", "is_nullable": "NO"},
  {"column_name": "asset_type", "data_type": "text", "is_nullable": "NO"},
  {"column_name": "version", "data_type": "integer", "is_nullable": "NO"},
  {"column_name": "content_hash", "data_type": "text", "is_nullable": "NO"},
  {"column_name": "file_reference", "data_type": "text", "is_nullable": "NO"},
  {"column_name": "status", "data_type": "text", "is_nullable": "NO"},
  {"column_name": "created_at", "data_type": "timestamp with time zone", "is_nullable": "NO"},
  {"column_name": "is_current", "data_type": "boolean", "is_nullable": "NO"}
]
```

### SVG-005 Catalogue Asset Metadata Schema
```json
[
  {"column_name": "metadata_id", "data_type": "uuid", "is_nullable": "NO"},
  {"column_name": "asset_id", "data_type": "uuid", "is_nullable": "NO"},
  {"column_name": "validated_width_mm", "data_type": "numeric", "is_nullable": "YES"},
  {"column_name": "validated_height_mm", "data_type": "numeric", "is_nullable": "YES"},
  {"column_name": "validated_depth_mm", "data_type": "numeric", "is_nullable": "YES"},
  {"column_name": "validated_at", "data_type": "timestamp with time zone", "is_nullable": "NO"}
]
```
