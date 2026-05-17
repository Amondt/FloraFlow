# FloraFlow

A smart gardening companion — context-aware plant care scheduling, botanical discovery, and AI-powered health diagnostics.

Built as a training project with Angular 21, Supabase, and the Anthropic Claude API.

---

## Tech Stack

| Layer       | Technology                                              |
|-------------|---------------------------------------------------------|
| Framework   | Angular 21 — standalone, Signals-first, zoneless        |
| UI          | PrimeNG v18 (unstyled PassThrough) + Tailwind CSS v4    |
| Backend     | Supabase — PostgreSQL, Auth, Deno Edge Functions        |
| AI          | Anthropic Claude (Haiku + Sonnet)                       |
| Testing     | Vitest                                                  |
| Package manager | Bun                                                 |

---

## Prerequisites

- [Bun](https://bun.sh)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Docker](https://www.docker.com) (for the local Supabase stack)

---

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Start the local Supabase stack

```bash
supabase start
```

### 3. Start the dev server

```bash
bun run start
```

Open `http://localhost:4200` in your browser.

---

## Available Scripts

| Command            | Description                              |
|--------------------|------------------------------------------|
| `bun run start`    | Start the Angular dev server             |
| `bun run build`    | Production build to `dist/`             |
| `bun run lint`     | Run ESLint across all TypeScript files   |
| `bun run test`     | Run Vitest unit and component tests      |
| `supabase start`   | Start local Supabase Docker stack        |
| `supabase stop`    | Stop local Supabase Docker stack         |
| `supabase db test` | Run RLS and schema integrity tests       |

---

## Project Documentation

All design decisions, patterns, and architecture specs live in `docs/`:

| File                        | Purpose                                      |
|-----------------------------|----------------------------------------------|
| `docs/PRD.md`               | Product requirements and feature definitions |
| `docs/APP_SPEC.md`          | Angular architecture and routing spec        |
| `docs/DB_SCHEMA_MATRIX.md`  | PostgreSQL schema and RLS policies           |
| `docs/DESIGN_SYSTEM.md`     | Tailwind tokens and PrimeNG PT config        |
| `docs/AI_PROMPT_MANIFEST.md`| Claude system prompts and JSON schemas       |
| `docs/ANGULAR_PATTERNS.md`  | Angular 21 required patterns reference       |
| `docs/BACKEND_PATTERNS.md`  | Edge Function and migration patterns         |
| `docs/PHASES_PLAN.md`       | Build roadmap and QA acceptance criteria     |
