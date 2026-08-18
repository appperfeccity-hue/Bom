---
name: local-supabase-testing
description: Stand up a local Supabase stack for the Perfeccity (Bom) repo so consultant/designer UI flows can be tested end-to-end without live credentials.
---

# Local Supabase stack for Bom UI testing

There are usually **no live Supabase credentials** on the box (`list_secrets` empty, no
`frontend/.env`, no `.env.e2e`). `frontend/e2e/global-setup.ts` hard-requires
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `E2E_{DESIGNER,CONSULTANT,ADMIN}_{EMAIL,PASSWORD}`
and throws without them, so a local stack is normally the only route to UI testing.
Never apply migrations to the live project.

## Setup

1. `npx supabase@2.114.x init` in a scratch dir (e.g. `/home/ubuntu/localsb`) and edit
   `supabase/config.toml` so `[api] schemas` includes `perfecity` — the frontend client
   sets `db.schema = 'perfecity'` (`frontend/src/lib/supabase.ts`) and PostgREST will
   otherwise 404 every request.
2. Copy `baseline/v1.1.5_baseline.sql` then every `migrations/*.sql` (chronological) into
   `supabase/migrations/` with sortable timestamp prefixes, then `npx supabase start`.
   If PostgREST logs `schema "perfecity" does not exist`, the migrations have not loaded yet.
3. Create users through the GoTrue admin API with `app_metadata.role` set to
   `CONSULTANT` / `DESIGNER` — RLS reads `auth.jwt() -> 'app_metadata' ->> 'role'`
   (`migrations/v1.1.5_rls_policies.sql`). A role only in `user_metadata` will silently fail RLS.
4. Write `frontend/.env` with `VITE_SUPABASE_URL=http://127.0.0.1:54321` and the local anon key,
   then `npm ci && npm run dev`.
5. `psql` is not installed on the host; use `docker exec -i supabase_db_localsb psql -U postgres`.
   **`docker exec` without `-i` silently discards heredoc stdin** — the command exits 0 having
   run nothing. Always pass `-i` when piping SQL.

## Seeding for snapshot/BOM tests

A usable consultant template needs: `template` (ACTIVE) + `template_zone` rows +
`template_zone_sku` + `sku_master` + an ACTIVE `rule_set` + a consultant permission row +
an APPROVED `master_bom`. Give the template a wall geometry that differs from the hard-coded
`3000 x 2400` fallback in `canvas/CanvasContainer.tsx` so a broken hydration is visually obvious.
The app writes `template_zone_sku.is_primary = false`, so seed it that way.

## UI navigation cheatsheet

- Consultant: IconRail `◈` → `/design-library` → template card **Select** → customer/site
  reference → **Create Project**. This is the only path that reaches
  `projectStore.loadProject()` (it is called solely from `projectCreationStore.createProject()`),
  so any snapshot-hydration test must go through a create.
- Canvas: IconRail `◧` → `/canvas`. Zoom out to ~25-33% to see the wall dimension label.
- Zone Properties panel only appears in **Designer** mode (header `Designer` button) after
  clicking a zone.
- Designer template load: log in as the designer, `Open Canvas` → **My Templates** → **View**
  (reads live `template_*` tables, not snapshots).
- The right-hand *Wall Configuration* panel shows `3000 / 2400` when the template has no
  `template_wall_configuration` row; that is a wallConfigStore default, not the canvas fallback.
  Judge geometry from the on-canvas dimension label instead.

## Simulating a legacy v1 snapshot

To exercise the legacy (pre-`snapshot_version`) reader through the real UI, install a
temporary local-only BEFORE INSERT trigger on `perfecity.project_snapshot` that strips
`snapshot_version`/`template` from `NEW.snapshot_data` and recomputes `snapshot_hash`, then
create a project normally. Drop the trigger afterwards.

## Devin Secrets Needed

None for the local path. For live testing you would need `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `E2E_CONSULTANT_EMAIL/PASSWORD`, `E2E_DESIGNER_EMAIL/PASSWORD`.

## Known pre-existing noise

`npx tsc --noEmit` reports two TS6133 unused-variable errors in
`canvas/layers/ValidationOverlayLayer.tsx` and `stores/publishStore.ts` on the base branch —
not caused by your change. Konva "stage has N layers" warnings are also normal.
