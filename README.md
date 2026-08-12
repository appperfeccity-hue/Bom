# PERFECCITY MVP – Database Contract v1.1.5

> **Status: Frozen Baseline – Execution-Verified on Supabase PostgreSQL 17.6**

PERFECCITY is a rule-driven modular wall design and BOM (Bill of Materials) platform. This repository contains the authoritative database contract for the MVP.

## Overview

The platform converts:
- Approved SKUs + reusable Designer Templates + actual site measurements + permitted Consultant decisions

Into:
- A deterministic, traceable, and immutable Final BOM

## Architecture

| Layer | Description |
|-------|-------------|
| **Product Master** | SKUs, families, categories, compatibility rules |
| **Product Catalogue** | Reusable geometry, patterns, renders per SKU |
| **Template & Design** | Zones, lighting, furniture, trims, hidden components |
| **Master BOM** | System-generated, designer-approved BOM per template |
| **Project** | Immutable snapshot, measurements, configuration |
| **Actual BOM** | Calculated from snapshot + site measurements |
| **Final BOM** | Immutable customer-specific result |

## Repository Structure

```
perfecity-db/
├── README.md                           ← You are here
├── baseline/
│   └── v1.1.5_baseline.sql            ← Full DDL (authoritative baseline)
├── migrations/
│   └── v1.1.4_to_v1.1.5.sql           ← Patch for existing v1.1.4 databases
├── tests/
│   └── regression_v1.1.5.sql           ← CI-compatible verification harness
├── docs/
│   ├── deployment_runbook.md
│   ├── verification_checklist.md
│   ├── erd.md
│   └── onboarding_guide.md
├── ci/
│   └── run_tests.sh                    ← Shell wrapper for CI
└── .gitignore
```

## Quick Start

### Prerequisites

- PostgreSQL 16.4+ (verified on 17.6)
- Extensions: `pgcrypto`, `btree_gist`

### Deploy

```bash
# Fresh install
psql -h <host> -U <user> -d <database> -f baseline/v1.1.5_baseline.sql

# Verify
psql -v ON_ERROR_STOP=1 -h <host> -U <user> -d <database> -f tests/regression_v1.1.5.sql
```

### Supabase

The database is deployed on Supabase project `fbiemsbykrmrbqcsobvh` (ap-northeast-2).

## Key Design Decisions

1. **34 tables** in the `perfecity` schema
2. **One Zone = One SKU** enforced at database level
3. **Immutable snapshots** – Projects reference frozen template state
4. **Immutable Final BOM** – Cannot be modified after finalisation
5. **Append-only audit trail** – All state changes logged
6. **Idempotent operations** – Project creation and finalisation are safe to retry
7. **Trigger-driven state management** – Catalogue READY, template demotion, BOM supersession

## Roles

| Role | Responsibility |
|------|---------------|
| ADMIN | Master data management |
| DESIGNER | Template and Design Library |
| CONSULTANT | Project execution |
| SYSTEM | Calculation, validation, BOM generation |

## Non-Negotiable Rules

- Hard deletion prohibited for referenced entities
- No Template Versioning (modify via Draft Workspace Pattern)
- All runtime queries use `snapshot_id`, never `template_id`
- Waste factor selected by Designer; Consultant cannot view/modify
- No manual BOM override

## Documentation

- [Deployment Runbook](docs/deployment_runbook.md)
- [Verification Checklist](docs/verification_checklist.md)
- [Entity-Relationship Diagram](docs/erd.md)
- [Onboarding Guide](docs/onboarding_guide.md)

## Version History

| Version | Date | Change |
|---------|------|--------|
| v1.1.4 | 2026-08-10 | Specification-aligned baseline |
| v1.1.5 | 2026-08-12 | Zone SKU 1:1 invariant enforcement + execution fixes |

## License

Proprietary – PERFECCITY
