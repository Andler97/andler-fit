# andler-fit — Supabase

## Schema
Migrations live in `migrations/`, applied in order:
- `0001_init_mvp.sql` — profiles, goals, weight_logs, foods (Open Food Facts cache + custom),
  food_log_entries, fasting_settings/logs, plus forward-compatible `exercises` and `push_tokens`.
- `0002_harden_functions.sql` — function search_path + RPC execute hardening (clears all security advisors).

All user tables have RLS: a row is visible/writable only to `auth.uid() = user_id`.
`foods` allows public read of Open Food Facts cache rows; clients may only write their own `custom` foods.
Open Food Facts cache writes go through a service-role Edge Function (see below), never the client.

## Apply to a project
Via the Supabase MCP connector (apply each file as a migration), or the Supabase CLI:
`supabase db push` with these files under `supabase/migrations/`.

## Planned Edge Functions
- `off-lookup` — barcode -> Open Food Facts API -> upsert into `foods` (source='off') with service role.
