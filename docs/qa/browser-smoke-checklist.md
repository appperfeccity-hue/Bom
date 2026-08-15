# Browser Smoke Test Checklist

**Target:** https://bom-beryl.vercel.app  
**Release:** mvp-v1.0.1-hardened (frozen architecture)  
**Branch:** feat/db-baseline-v1.1.5  
**Estimated Duration:** 20-30 minutes  
**Executed By:** ____________________  
**Date:** ____________________  
**Browser / Version:** ____________________  

---

## 1. Prerequisites

Before starting the smoke test, ensure the following:

- [ ] Modern browser (Chrome 120+, Firefox 120+, or Edge 120+) with DevTools available
- [ ] Screen capture tool ready (OS screenshot or browser extension)
- [ ] Network tab open in DevTools to observe API calls
- [ ] Console tab open in DevTools to catch client-side errors
- [ ] Screenshots folder created: `smoke-YYYY-MM-DD/`
- [ ] Access to the following test accounts:

| Role | Email | Password |
|------|-------|----------|
| Designer | designer@perfeccity.test | Designer@123 |
| Consultant | consultant@perfeccity.test | Consultant@123 |
| Admin | admin@perfeccity.test | Admin@123 |

### Gate Decision Framework

This smoke test is the gate before leaked-password protection and automated P0 execution. Results determine the next action:

| Result | Action |
|--------|--------|
| All critical smoke paths pass | Enable leaked-password protection, then build Playwright foundation |
| Non-critical UI issue | Record change request; do NOT patch frozen release |
| Auth/RBAC/RLS/data-integrity failure | **STOP** - investigate before automation |
| Designer/Consultant core workflow failure | **STOP** - do not proceed to P0-A |

---

## 2. Designer Canvas Smoke (12 Steps)

### 2.1 Designer Login

| # | Action | Expected Result | Evidence | Result |
|---|--------|----------------|----------|--------|
| D-01 | Navigate to `https://bom-beryl.vercel.app` (or `/login`). Enter `designer@perfeccity.test` / `Designer@123` and submit. | Valid authentication succeeds. No 401/403 responses in Network tab. | Screenshot: `D-01-login.png` | PASS / FAIL / BLOCKED |
| D-02 | Verify the post-login landing page. | User is redirected to the correct role-specific dashboard (designer dashboard or `/dashboard`). Designer-specific navigation is visible. | Screenshot: `D-02-dashboard.png` | PASS / FAIL / BLOCKED |
| D-03 | Check browser console and Network tab for unauthorized errors. | No console errors. No unexpected 401/403/500 API responses. No RLS policy violation messages. | Screenshot: `D-03-console-clean.png` | PASS / FAIL / BLOCKED |

### 2.2 Designer Workflow

| # | Action | Expected Result | Evidence | Result |
|---|--------|----------------|----------|--------|
| D-04 | Open the Template Editor (navigate to template list, click an existing template or create new). | Template Editor loads. Canvas area is visible. Editor toolbar/panels render without error. | Screenshot: `D-04-template-editor.png` | PASS / FAIL / BLOCKED |
| D-05 | Create or open a wall in the template. Verify wall dimensions and wall type are editable. | Wall element is present on canvas. Dimension inputs accept values. Wall type selector is functional. | Screenshot: `D-05-wall-config.png` | PASS / FAIL / BLOCKED |
| D-06 | Add or modify zones on the canvas (click Add Zone or select existing zone to edit). | Zones render as visually distinct regions. Zone properties panel allows configuration. | Screenshot: `D-06-zones.png` | PASS / FAIL / BLOCKED |
| D-07 | Open the SKU assignment panel and assign a SKU to a zone or element. | SKU panel is visible and accessible. SKU list loads. Assignment completes without error. | Screenshot: `D-07-sku-assign.png` | PASS / FAIL / BLOCKED |
| D-08 | Open the lighting panel and add/configure lighting for the template. | Lighting panel renders. Fixture options are available. Configuration saves without error. | Screenshot: `D-08-lighting.png` | PASS / FAIL / BLOCKED |
| D-09 | Open the furniture/trim panel (if applicable) and add an item. | Furniture/trim panel renders. Catalogue items are available. Placement or assignment completes. | Screenshot: `D-09-furniture.png` | PASS / FAIL / BLOCKED |
| D-10 | Verify 2D rendering of the complete template (all walls, zones, SKUs, lighting, furniture visible). | Canvas displays a coherent 2D layout with all added elements rendered correctly. No missing elements or rendering artifacts. | Screenshot: `D-10-2d-render.png` | PASS / FAIL / BLOCKED |
| D-11 | Save the template and then publish/snapshot it (click Save, then Publish). | Save succeeds (confirmation shown). Publish/snapshot succeeds. Template status changes to published/active. | Screenshot: `D-11-save-publish.png` | PASS / FAIL / BLOCKED |
| D-12 | Attempt to edit the published template (try modifying a wall or zone after publishing). | Published template is immutable. Edit controls are disabled, or attempts to modify are rejected with an appropriate message. | Screenshot: `D-12-immutable.png` | PASS / FAIL / BLOCKED |

**Designer Smoke Summary:** ___/12 PASS | ___/12 FAIL | ___/12 BLOCKED

---

## 3. Consultant Canvas Smoke (11 Steps)

### 3.1 Consultant Login

| # | Action | Expected Result | Evidence | Result |
|---|--------|----------------|----------|--------|
| C-01 | Navigate to `https://bom-beryl.vercel.app` (or `/login`). Enter `consultant@perfeccity.test` / `Consultant@123` and submit. | Valid authentication succeeds. No 401/403 responses in Network tab. | Screenshot: `C-01-login.png` | PASS / FAIL / BLOCKED |
| C-02 | Verify the post-login landing page shows a restricted consultant UI. | Dashboard renders with consultant-specific content. Navigation shows only consultant-permitted actions. Designer tools (template editor, zone builder) are NOT visible. | Screenshot: `C-02-dashboard.png` | PASS / FAIL / BLOCKED |

### 3.2 Consultant Permissions

| # | Action | Expected Result | Evidence | Result |
|---|--------|----------------|----------|--------|
| C-03 | Select the published template (created in D-11) from available templates. | Template details load in read-only or consultant-appropriate view. Template data is visible. | Screenshot: `C-03-select-template.png` | PASS / FAIL / BLOCKED |
| C-04 | Create a new project using the selected template (complete project creation wizard). | Project is created successfully. Canvas renders with the template snapshot applied. | Screenshot: `C-04-create-project.png` | PASS / FAIL / BLOCKED |
| C-05 | Verify that permitted edits work according to configured permissions (e.g., measurement entry, notes, client details). | Editable fields accept input. Changes save without error. Permitted actions complete successfully. | Screenshot: `C-05-permitted-edits.png` | PASS / FAIL / BLOCKED |
| C-06 | Attempt to change wall dimensions (these should be LOCKED for consultant). | Wall dimension fields are either: not displayed, displayed as read-only, or reject modification with an error. Changes do NOT persist. | Screenshot: `C-06-wall-dims-locked.png` | PASS / FAIL / BLOCKED |
| C-07 | Attempt to change wall type (this should be LOCKED for consultant). | Wall type selector is either: not displayed, displayed as read-only, or rejects modification. Changes do NOT persist. | Screenshot: `C-07-wall-type-locked.png` | PASS / FAIL / BLOCKED |
| C-08 | Verify `canEditPanelLayout` remains false (attempt to rearrange, add, or remove panels/zones on the canvas). | Panel layout editing is disabled. Drag-and-drop of zones is non-functional. Add/remove zone controls are absent or disabled. | Screenshot: `C-08-panel-layout-locked.png` | PASS / FAIL / BLOCKED |
| C-09 | Attempt any other forbidden operation through the UI (e.g., publish template, delete zone, reassign SKU). | Forbidden operations cannot be performed. Controls are hidden, disabled, or actions are rejected server-side. | Screenshot: `C-09-forbidden-ops.png` | PASS / FAIL / BLOCKED |

### 3.3 Consultant Workflow Completion

| # | Action | Expected Result | Evidence | Result |
|---|--------|----------------|----------|--------|
| C-10 | Trigger BOM generation (click Generate BOM or equivalent). | BOM generation initiates and completes. Material list with SKUs, quantities, and pricing is displayed. | Screenshot: `C-10-bom-generate.png` | PASS / FAIL / BLOCKED |
| C-11 | Trigger project finalization and verify final state. | Project finalizes successfully. Status updates to completed/finalized. BOM is locked. Further edits are prevented. | Screenshot: `C-11-finalize.png` | PASS / FAIL / BLOCKED |

**Consultant Smoke Summary:** ___/11 PASS | ___/11 FAIL | ___/11 BLOCKED

---

## 4. Admin Smoke (5 Steps)

| # | Action | Expected Result | Evidence | Result |
|---|--------|----------------|----------|--------|
| A-01 | Navigate to `https://bom-beryl.vercel.app` (or `/login`). Enter `admin@perfeccity.test` / `Admin@123` and submit. | Login succeeds. User is redirected to the admin dashboard or admin area. | Screenshot: `A-01-login.png` | PASS / FAIL / BLOCKED |
| A-02 | Navigate to SKU list (Admin > SKU Management or similar route like `/admin/skus`). | SKU list page renders. Existing SKUs are displayed in a table or grid with identifiers, names, and status. | Screenshot: `A-02-sku-list.png` | PASS / FAIL / BLOCKED |
| A-03 | Create a new SKU (click Add/Create SKU, fill in required fields with test data, submit). Use name: `SMOKE-TEST-SKU-{timestamp}`. | New SKU is created successfully. Confirmation message appears. SKU appears in the list. | Screenshot: `A-03-create-sku.png` | PASS / FAIL / BLOCKED |
| A-04 | Edit the newly created SKU (click Edit, modify description or price, save). | Edit form loads with current values. After saving, updated values are reflected in the list. | Screenshot: `A-04-edit-sku.png` | PASS / FAIL / BLOCKED |
| A-05 | Navigate to Catalogue management (Admin > Catalogues or similar route). Verify the catalogue list loads. | Catalogue management page renders. Existing catalogues or families are displayed. CRUD controls are available. | Screenshot: `A-05-catalogue.png` | PASS / FAIL / BLOCKED |

**Admin Smoke Summary:** ___/5 PASS | ___/5 FAIL | ___/5 BLOCKED

---

## 5. Cross-Role Verification (5 Steps)

| # | Action | Expected Result | Evidence | Result |
|---|--------|----------------|----------|--------|
| X-01 | While logged in as Designer, manually navigate to `/admin/skus` (or known admin route) by editing the URL bar. | Access is denied. User sees a 403/unauthorized message, is redirected to dashboard, or the page shows no admin content. | Screenshot: `X-01-designer-no-admin.png` | PASS / FAIL / BLOCKED |
| X-02 | While logged in as Consultant, manually navigate to the designer canvas/template editor URL. | Access is denied or the page renders in read-only mode. Consultant cannot perform designer-specific actions (edit template, assign SKUs). | Screenshot: `X-02-consultant-no-designer.png` | PASS / FAIL / BLOCKED |
| X-03 | While logged in as Consultant, manually navigate to `/admin/skus` (or known admin route). | Access is denied. User sees a 403/unauthorized message, is redirected, or admin content is not rendered. | Screenshot: `X-03-consultant-no-admin.png` | PASS / FAIL / BLOCKED |
| X-04 | While logged in as Designer, verify the navigation menu does NOT show admin links (SKU management, catalogue management). | Admin menu items are absent from the designer navigation. Only designer-relevant links are visible. | Screenshot: `X-04-designer-nav.png` | PASS / FAIL / BLOCKED |
| X-05 | While logged in as Consultant, verify the navigation menu does NOT show designer or admin links. | Only consultant-relevant navigation items are visible (projects, templates for selection). No admin or designer-edit links. | Screenshot: `X-05-consultant-nav.png` | PASS / FAIL / BLOCKED |

**Cross-Role Summary:** ___/5 PASS | ___/5 FAIL | ___/5 BLOCKED

---

## 6. Critical End-to-End Path (5 Steps)

This section validates the complete Designer-to-Consultant handoff workflow as a single integrated path.

| # | Action | Expected Result | Evidence | Result |
|---|--------|----------------|----------|--------|
| E2E-01 | (Designer) Publish a template with walls, zones, SKUs, and lighting configured. | Template publishes successfully. Status is ACTIVE/PUBLISHED. | Screenshot: `E2E-01-publish.png` | PASS / FAIL / BLOCKED |
| E2E-02 | (Consultant) Open the published template and create a project from it. | Consultant can see and select the published template. Project creation succeeds. | Screenshot: `E2E-02-open.png` | PASS / FAIL / BLOCKED |
| E2E-03 | (Consultant) Make only permitted changes (measurements, client details, notes). Verify locked fields remain unchanged. | Permitted changes save. Wall dimensions, wall type, and panel layout remain as the designer set them. | Screenshot: `E2E-03-permitted.png` | PASS / FAIL / BLOCKED |
| E2E-04 | (Consultant) Complete the quotation/configuration flow (BOM generation, pricing). | Quotation generates correctly based on template SKUs and consultant measurements. No calculation errors. | Screenshot: `E2E-04-quotation.png` | PASS / FAIL / BLOCKED |
| E2E-05 | Verify no unexpected authorization or RLS failures during the entire flow. Check console and Network tab. | Zero 401/403 errors for legitimate operations. Zero RLS policy violation messages. All API calls return expected status codes. | Screenshot: `E2E-05-no-auth-errors.png` | PASS / FAIL / BLOCKED |

**End-to-End Summary:** ___/5 PASS | ___/5 FAIL | ___/5 BLOCKED

---

## 7. Evidence Capture (Section 51 Model)

### Per-Step Evidence Record

For every step (passed or failed), capture evidence using the following model:

| Field | Description | Example |
|-------|-------------|---------|
| **Requirement Proved** | What requirement does this step validate? | "Designer can assign SKUs to zones" |
| **Environment** | What environment/release was tested? | `bom-beryl.vercel.app` |
| **DB Version** | Database schema version (from migration or `/api/health`) | `v1.1.5` |
| **Release/Tag** | Git tag of the deployed release | `mvp-v1.0.1-hardened` |
| **Evidence** | What exact evidence proves the result? | Screenshot filename, network response |
| **Disposition** | What is the next action? | "PASS - no action" or "FAIL - CR filed" |

### Evidence Package Header

Record once per test execution:

| Field | Value |
|-------|-------|
| **Evidence Package ID** | `SMOKE-{YYYY-MM-DD}-{sequence}` |
| **Environment** | https://bom-beryl.vercel.app |
| **DB Version** | |
| **Release/Tag** | mvp-v1.0.1-hardened |
| **Tester** | |
| **Timestamp (UTC)** | |
| **Overall Result** | |
| **Evidence Location** | `smoke-YYYY-MM-DD/` |

### Screenshot Naming Convention

```
smoke-YYYY-MM-DD/{step-id}-{description}.png
```

Examples:
- `smoke-2025-01-15/D-01-login.png`
- `smoke-2025-01-15/C-06-wall-dims-locked.png`
- `smoke-2025-01-15/E2E-03-permitted.png`

---

## 8. Defect Reporting

If any step results in FAIL, create a defect record. Do NOT patch the frozen release. All fixes must go through a change request (CR).

### Defect Record Template

```
-------------------------------------------------------
DEFECT ID:        SMOKE-{date}-{step-id}
STEP:             {step number, e.g., D-04}
SEVERITY:         Critical / High / Medium / Low
SECTION:          Designer / Consultant / Admin / Cross-Role / E2E
-------------------------------------------------------

REQUIREMENT PROVED:
{What requirement was being validated}

ENVIRONMENT:
{URL, DB version, release tag}

SUMMARY:
{One-line description of the failure}

EXPECTED:
{What should have happened per the checklist}

ACTUAL:
{What actually happened}

EVIDENCE:
{Screenshot filename + network/console captures}

BROWSER:
{Browser name and version, e.g., Chrome 121.0.6167.85}

OS:
{Operating system, e.g., macOS 14.2, Windows 11}

CONSOLE ERRORS:
{Copy/paste of any relevant console output}

NETWORK ERRORS:
{Failed requests: method, URL, status code, response snippet}

DISPOSITION:
{Next action: CR filed / Investigation required / Deferred}

CHANGE REQUEST:
{Link to CR once filed, or "PENDING"}
-------------------------------------------------------
```

### Severity Guidelines

| Severity | Definition | Gate Impact |
|----------|-----------|-------------|
| **Critical** | Auth/RBAC/RLS/data-integrity failure; core workflow broken | RED - STOP all automation work |
| **High** | Designer/Consultant core workflow partially broken; workaround exists | RED - STOP; investigate |
| **Medium** | Non-blocking UI issue; feature works but UX is degraded | YELLOW - Record CR; do not patch |
| **Low** | Cosmetic issue (typo, color, spacing) | YELLOW - Record CR; do not patch |

### Post-Test Actions

1. Compile all defect records into: `smoke-YYYY-MM-DD/defects.md`
2. File a change request (CR) for each Critical or High defect
3. Attach screenshots and defect report to the CR
4. Do NOT modify application code on the frozen branch
5. If any Critical defect: **STOP** - do not proceed to leaked-password protection or Playwright foundation
6. If any High defect in Designer/Consultant workflow: **STOP** - do not proceed to P0-A

---

## 9. Summary and Gate Decision

### Results Summary

| Section | Total | Pass | Fail | Blocked |
|---------|-------|------|------|---------|
| Designer Canvas Smoke | 12 | | | |
| Consultant Canvas Smoke | 11 | | | |
| Admin Smoke | 5 | | | |
| Cross-Role Verification | 5 | | | |
| Critical End-to-End Path | 5 | | | |
| **TOTAL** | **38** | | | |

### Gate Decision

| Condition | Decision | Next Step |
|-----------|----------|-----------|
| All critical smoke paths pass (38/38 or only Low/Medium issues) | PROCEED | Enable leaked-password protection, then build Playwright foundation |
| Non-critical UI issue found | CONDITIONAL PROCEED | Record change request; continue with automation |
| Auth/RBAC/RLS/data-integrity failure | **STOP** | Investigate before any automation work |
| Designer/Consultant core workflow failure | **STOP** | Do not proceed to P0-A automation |

### Final Gate Result

- [ ] GREEN - All critical paths pass. Proceed to leaked-password protection and Playwright foundation.
- [ ] YELLOW - Non-critical issues found. CRs filed. Proceed with caution.
- [ ] RED - Critical/High failures. STOPPED. Investigation required.

---

## Completion Sign-Off

| Field | Value |
|-------|-------|
| **Evidence Package ID** | |
| **Tester Name** | |
| **Date Completed** | |
| **Total Time Spent** | |
| **Overall Gate Result** | GREEN / YELLOW / RED |
| **Defects Filed** | {count} |
| **Change Requests** | {CR links} |
| **Notes** | |

**Signature:** ____________________  
**Reviewer (if applicable):** ____________________
