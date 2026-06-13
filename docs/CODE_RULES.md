# Code Rules

Cross-cutting engineering principles **every** agent applies to **every** block, regardless of layer. This is the single source — `CLAUDE.md` and the `/command` files link here instead of restating these.

Layer-specific rules live elsewhere: frontend in `ANGULAR_PATTERNS.md` + `/visualizer`; backend in `BACKEND_PATTERNS.md` + `/plumber`.

## DRY — Don't Repeat Yourself

Three identical or near-identical lines across two files is the extraction threshold. At that point, extract — route by type:

- Pure logic → `src/app/shared/utils/`
- Presentational markup / components → `src/app/shared/components/`
- Singleton services → `src/app/core/services/`
- Shared Edge Function logic → `supabase/functions/_shared/`

## Single Responsibility

Each component, service, and Edge Function does exactly one job.

- A component that fetches data **and** renders a non-trivial template → split: smart container (data, loading, error) + dumb presentational (template only, no service calls).
- A service doing more than one domain job → split.
- An Edge Function handling more than one workflow → new function.

## Separation of Concerns

Presentation in templates, business logic in services, data access in Supabase queries or Edge Functions. Never interleave layers. Structure every Edge Function as a clear sequence: preflight → auth → validate input → business logic → respond.

## Descriptive names

Names must communicate intent without needing a comment — `getUserPlantsByZone()` not `getData()`.

- **Rejected** as variable or method names: `data`, `flag`, `handle`, `manage`, `process`, `item`, `temp`.
- Booleans carry an `is` / `has` / `can` / `should` prefix: `isLoading`, `hasError`, `canSubmit`.
- No single-letter variables outside loop indices (`i`, `j`).

## Honesty & provenance

- **No fabricated API fields** — verify every external field via context7 or official docs before using it.
- **Secrets in Edge Functions only** — never in client bundles.
- **No block labels in source comments** — a comment may reference a phase (e.g. "Phase 2.5") but never a plan's block (e.g. "Block A"). Plans are temporary planning artifacts and rot; describe _what_ the code does and _why_.
