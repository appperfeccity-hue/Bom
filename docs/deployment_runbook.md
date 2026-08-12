# PERFECCITY MVP – Deployment Runbook

## Target Environment

| Property | Value |
|----------|-------|
| PostgreSQL | 16.4+ (verified on 17.6) |
| Extensions | pgcrypto, btree_gist |
| Schema | `perfecity` |
| Supabase Project | `fbiemsbykrmrbqcsobvh` (ap-northeast-2) |

## Fresh Installation (v1.1.5 Baseline)

1. **Connect** as a superuser (or a role with CREATE SCHEMA / CREATE EXTENSION privileges).

2. **Run the baseline script:**
   ```bash
   psql -h <host> -U <user> -d <database> -f baseline/v1.1.5_baseline.sql
   ```

3. **Verify schema creation:**
   ```sql
   \dn perfecity
   \dt perfecity.*
   ```
   Expected: 34 tables in the `perfecity` schema.

4. **Execute the regression harness:**
   ```bash
   psql -v ON_ERROR_STOP=1 -h <host> -U <user> -d <database> -f tests/regression_v1.1.5.sql
   ```
   All tests (T1–T7) must pass.

## Supabase Deployment

For Supabase-hosted databases, the baseline is applied via migrations using the Supabase MCP or CLI:

```bash
# Link to the project
supabase link --project-ref fbiemsbykrmrbqcsobvh

# Apply migrations
supabase db push
```

Or apply via the Supabase Dashboard SQL Editor by running the baseline script.

## Upgrading from v1.1.4 to v1.1.5

If a v1.1.4 database already exists, apply only the corrective patch:

```bash
psql -h <host> -U <user> -d <database> -f migrations/v1.1.4_to_v1.1.5.sql
```

Then run the full regression harness. The harness validates both the new constraint and the existing P1-01/P1-02 invariants.

## Rollback (v1.1.5 → v1.1.4)

```sql
ALTER TABLE perfecity.template_zone_sku
  DROP CONSTRAINT IF EXISTS uq_zone_single_sku;
```

> **Warning:** This rollback is irreversible if new data depends on the 1:1 constraint. Only use if the deployment fails verification.

## Baseline Tagging

After verification, tag the repository:

```bash
git tag -a db-v1.1.5-verified -m "PostgreSQL execution-verified baseline"
git push origin db-v1.1.5-verified
```

## Post-Deployment Security

Row Level Security (RLS) is **not** enabled by default. Before exposing the database to client applications:

1. Enable RLS on all tables
2. Create appropriate policies for each role (ADMIN, DESIGNER, CONSULTANT)
3. Run `supabase db diff --linked` to verify no drift

## Troubleshooting

| Issue | Resolution |
|-------|-----------|
| Extension not available | Run `CREATE EXTENSION IF NOT EXISTS <name>;` as superuser |
| Schema already exists | Safe to re-run; uses `IF NOT EXISTS` |
| Seed data conflict | Check if product_master already has entries |
| Trigger errors during test | Verify all functions were created in `perfecity` schema |
