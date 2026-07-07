-- Phase 6 Block D — restore Supabase's standard baseline role grants.
-- This hosted project never received the default GRANTs Supabase normally
-- provisions at project creation (anon/authenticated/service_role had only
-- REFERENCES/TRIGGER/TRUNCATE on every public table, no SELECT/INSERT/
-- UPDATE/DELETE), breaking every Edge Function and the app itself.
-- RLS remains the real per-row boundary; these grants only restore
-- table-level access that every Supabase project ships with by default.
GRANT USAGE ON SCHEMA public TO anon,
authenticated,
service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,
authenticated,
service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon,
authenticated,
service_role;

GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon,
authenticated,
service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON TABLES TO anon,
authenticated,
service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON SEQUENCES TO anon,
authenticated,
service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON ROUTINES TO anon,
authenticated,
service_role;
