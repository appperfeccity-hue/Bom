# PERFECCITY MVP – Entity-Relationship Diagram

## Mermaid Diagram

```mermaid
erDiagram
    PRODUCT_MASTER ||--o{ SKU_MASTER : "product_type"
    FAMILY_MASTER ||--o{ CATEGORY_MASTER : "contains"
    FAMILY_MASTER ||--o{ SKU_MASTER : "family"
    CATEGORY_MASTER ||--o{ SKU_MASTER : "category"
    DESIGN_FAMILY_MASTER ||--o{ DESIGN_SUBFAMILY_MASTER : "contains"
    DESIGN_SUBFAMILY_MASTER ||--o{ TEMPLATE : "design_subfamily"
    TEMPLATE ||--o{ TEMPLATE_ZONE : "contains"
    TEMPLATE_ZONE ||--|| TEMPLATE_ZONE_SKU : "1:1 invariant"
    TEMPLATE_ZONE_SKU }o--|| SKU_MASTER : "sku_id"
    TEMPLATE_ZONE ||--o{ TEMPLATE_ZONE_ALTERNATIVE : "alternatives"
    TEMPLATE_ZONE_ALTERNATIVE }o--|| SKU_MASTER : "alternative_sku"
    TEMPLATE ||--o{ TEMPLATE_LIGHTING : "lighting"
    TEMPLATE ||--o{ TEMPLATE_FURNITURE : "furniture"
    TEMPLATE ||--o{ TEMPLATE_TRIM : "trims"
    TEMPLATE ||--o{ TEMPLATE_HIDDEN_COMPONENT : "hidden"
    TEMPLATE ||--o{ TEMPLATE_CONSULTANT_PERMISSION : "permissions"
    TEMPLATE ||--o{ MASTER_BOM : "generates"
    MASTER_BOM ||--o{ MASTER_BOM_LINE : "lines"
    TEMPLATE ||--o{ PROJECT : "creates"
    PROJECT ||--|| PROJECT_SNAPSHOT : "frozen at creation"
    PROJECT ||--o{ PROJECT_CONFIGURATION : "versions"
    PROJECT ||--|| PROJECT_MEASUREMENT : "actual site"
    PROJECT ||--o{ ACTUAL_BOM : "calculates"
    ACTUAL_BOM ||--o{ ACTUAL_BOM_LINE : "lines"
    ACTUAL_BOM ||--|| FINAL_BOM : "finalises to"
    FINAL_BOM ||--o{ FINAL_BOM_LINE : "immutable lines"
    SKU_MASTER ||--o{ SKU_VARIANT : "variants"
    SKU_MASTER ||--o{ SKU_COMPATIBILITY : "source"
    SKU_MASTER ||--o{ CATALOGUE_ENTRY : "catalogue"
    CATALOGUE_ENTRY ||--o{ CATALOGUE_ASSET : "versioned assets"
    CATALOGUE_ASSET ||--o| CATALOGUE_ASSET_METADATA : "metadata"
    RULE_SET ||--o{ MASTER_BOM : "governs"
    RULE_SET ||--o{ ACTUAL_BOM : "governs"
    RULE_SET ||--o{ FINAL_BOM : "frozen at finalisation"
    RULE_SET ||--o{ PROJECT_SNAPSHOT : "frozen in snapshot"
```

## Key Invariants

- **One Zone = One SKU** – Enforced by `UNIQUE (zone_id)` on `template_zone_sku`
- **Snapshot Immutability** – Trigger prevents UPDATE/DELETE on `project_snapshot`
- **Final BOM Immutability** – Trigger prevents UPDATE/DELETE on `final_bom` and `final_bom_line`
- **Audit Append-Only** – Trigger prevents UPDATE/DELETE on `audit_event`

## Table Summary (34 tables)

### Master Data (5)
- `product_master` – Three product types
- `family_master` – Product families
- `category_master` – Categories under families
- `design_family_master` – Design classification vocabulary
- `design_subfamily_master` – Child design classifications

### SKU Management (3)
- `sku_master` – All SKU definitions
- `sku_variant` – Variant groupings
- `sku_compatibility` – Compatibility rules between SKUs

### Product Catalogue (3)
- `catalogue_entry` – Catalogue entries per SKU
- `catalogue_asset` – Versioned assets (geometry, pattern, render)
- `catalogue_asset_metadata` – Validated dimensions

### Rule Engine (1)
- `rule_set` – Calculation constants and rules

### Template & Design (8)
- `template` – Reusable design definitions
- `template_zone` – Zone geometry within templates
- `template_zone_sku` – Primary SKU per zone (1:1)
- `template_zone_alternative` – Promoted alternatives
- `template_lighting` – Lighting configurations
- `template_furniture` – Furniture placements
- `template_trim` – Trim definitions
- `template_hidden_component` – Hidden construction components
- `template_consultant_permission` – Consultant permission rules

### BOM (Master) (2)
- `master_bom` – System-generated BOM per template
- `master_bom_line` – Individual BOM lines

### Project (4)
- `project` – Project instances
- `project_snapshot` – Immutable frozen template state
- `project_configuration` – Versioned consultant configurations
- `project_measurement` – Actual site measurements

### BOM (Actual) (2)
- `actual_bom` – Calculated BOM per project
- `actual_bom_line` – Actual BOM detail lines

### BOM (Final) (2)
- `final_bom` – Immutable finalised BOM
- `final_bom_line` – Denormalised immutable lines

### System (3)
- `audit_event` – Append-only audit trail
- `project_idempotency` – Project creation idempotency keys
- `finalization_idempotency` – Finalisation idempotency keys
