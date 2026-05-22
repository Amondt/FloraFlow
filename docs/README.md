# FloraFlow (SproutRoute) - Developer Workspace Manual

Welcome to the development repository for **FloraFlow**, an open-source, full-stack, free-tier smart gardening companion app built with Angular 21+ and managed through a multi-agent AI workflow.

This document serves as your operational manual for configuring the local environment, routing system keys securely, and managing workspace AI agents.

---

## 1. ⚙️ Local Development Setup

To establish a predictable local environment that perfectly mirrors our "Always Free 2026 Tech Stack," install the core prerequisites exactly as configured below.

### 1.1 Core Prerequisites

- **Node.js:** v22.x LTS or higher (Mandatory for Angular 21 compatibility primitives).
- **Supabase CLI:** Installed globally via your package manager to simulate the Deno Edge environment locally.
- **Docker Desktop:** Required locally to spin up the local isolated Supabase development container suite.

### 1.2 Initial Workspace Bootstrap Execution

Run the following initialization chain to install frontend dependencies and link your local repository:

    bun install
    supabase init

---

## 2. 🔐 Environment Variables & Secret Masking

Never commit plain text API credentials or service role keys to this public repository. All external transactions are piped through serverless Supabase Edge Functions (Deno) to hide secret keys away from client inspection frameworks.

Create a `.env` file in your root folder and map these required connection strings:

    # --- CLIENT INTERFACE BINDINGS (Cloudflare/Vercel Targets) ---
    SUPABASE_URL=your_local_or_production_supabase_endpoint_url
    SUPABASE_ANON_KEY=your_public_anonymous_client_access_token

    # --- EDGE VAULT CREDENTIALS (Masked Serverless Environment) ---
    # Locked to Deno runtime containers. Banned from frontend bundles.
    ANTHROPIC_API_KEY=your_anthropic_api_key
    PERENUAL_API_KEY=your_perenual_botanical_index_credential_token
    PLANTNET_API_KEY=your_plantnet_computer_vision_access_token
    RESEND_API_KEY=your_resend_email_infrastructure_token

---

## 3. 🤖 Multi-Agent AI Workflow (Claude Code Slash Commands)

This workspace uses **Claude Code custom slash commands** to switch between focused engineering roles. Each agent role is defined as a markdown file in `.claude/commands/` — when you invoke a slash command, Claude Code loads that file as its working context for the session.

There is no external tool, package manager, or `skills.sh` runtime involved. The agents are plain markdown prompt files.

### 3.1 Standard Feature Workflow

This is the normal flow for any new feature or phase task:

```
Step 1 — Plan
  /mind <task description>
  → reads PHASES_PLAN.md, produces a numbered block plan
  → saves the plan to docs/plans/PHASE_X_Y_PLAN.md
  → you review and approve before any code is written

Step 2 — Build (block by block)
  /visualizer <block description>   ← Angular components, UI, templates
  /plumber <block description>      ← migrations, RLS, Edge Functions

  After each block:
  → agent runs bun run lint
  → agent outputs a Manual Browser Check or db test command
  → you confirm before moving to the next block

Step 3 — QA
  /gatekeeper                       ← after all blocks are confirmed
  → runs Vitest, pgTAP, security checks
  → marks PHASES_PLAN.md checkbox [x]

Step 4 — Commit
  git commit && git push
```

### 3.2 Utility Commands (Use As Needed)

These slot in around the standard flow — they don't replace it.

| Command | When to use |
|---|---|
| `/align <feature idea>` | Before `/mind` when the feature is still fuzzy — resolves ambiguities, produces a clear brief |
| `/diagnose <bug description>` | When something is broken — runs a 6-phase investigation loop |
| `/zoom-out <area of code>` | When an agent (or you) needs a map of an unfamiliar area before touching it |
| `/handoff` | At the end of a long session — compacts the conversation into a brief for the next session |

### 3.3 Role Agents

| Command | Role | Reads before acting |
|---|---|---|
| `/mind` | **The Mind** — Architecture & planning | `APP_SPEC.md`, `DB_SCHEMA_MATRIX.md`, `PHASES_PLAN.md` |
| `/visualizer` | **The Visualizer** — Angular components & UI | `DESIGN_SYSTEM.md`, `APP_SPEC.md`, `ANGULAR_PATTERNS.md` |
| `/plumber` | **The Plumber** — Supabase, migrations, Edge Functions | `DB_SCHEMA_MATRIX.md`, `BACKEND_PATTERNS.md`, `AI_PROMPT_MANIFEST.md` |
| `/gatekeeper` | **The Gatekeeper** — QA, tests, security | `PHASES_PLAN.md`, `DB_SCHEMA_MATRIX.md` |

### 3.4 Agent Source Files

All agent definitions live in `.claude/commands/`. Edit them directly to adjust any agent's behaviour:

    .claude/
    └── commands/
        ├── mind.md          # The Mind — architect role
        ├── visualizer.md    # The Visualizer — frontend role
        ├── plumber.md       # The Plumber — data role
        ├── gatekeeper.md    # The Gatekeeper — QA role
        ├── align.md         # Pre-feature alignment
        ├── diagnose.md      # Bug investigation loop
        ├── zoom-out.md      # Code orientation map
        └── handoff.md       # Session compaction


---

## 4. 🎛️ Local Verification and Quality Hooks

Before opening up a Pull Request, you must trigger your local testing harness to confirm code syntax compliance across framework layers.

### 4.1 Check Database Integrity & RLS Verification

Validate your PostgreSQL schema changes and local Row-Level Security rules by executing:

    supabase db test

### 4.2 Run Quality Assurance Engine

Invoke the **Gatekeeper Agent** directly via its slash command:

    # General Code Elegance Check
    /gatekeeper review the current codebase

    # Target Security Verification (Audits Supabase Isolation Contexts)
    /gatekeeper [SECURITY] audit the current RLS policies

---

## 📁 System Code Directory Map Reference

When operating inside this workspace, adhere strictly to this standardized layout to keep domain spaces separated:

    flora-flow-root/
    ├── src/                      # Angular 21 Application Root Directory
    │   ├── app/                  # Application Logic, Routing & Signals Codebase
    │   └── assets/               # Static icons and image compression schemas
    ├── supabase/                 # Supabase Infrastructure Framework Directory
    │   ├── functions/            # Serverless Deno Edge Functions (Claude AI & Webhooks)
    │   └── migrations/           # Incremental DDL SQL Database Schema Scripts
    ├── docs/                     # Centralized Markdown Source-of-Truth Suite
    │   ├── README.md             # This File: Operational Manual
    │   ├── PRD.md                # High-Level Roadmap, Module Specifications & Personas
    │   ├── APP_SPEC.md           # Folder Patterns, Routing & Signal State Models
    │   ├── DB_SCHEMA_MATRIX.md   # Database Blueprints, Indexes & RLS Policy Matrix
    │   ├── DESIGN_SYSTEM.md      # Tailwind v4 tokens & PrimeNG PassThrough Rules
    │   ├── AI_PROMPT_MANIFEST.md # Claude System Prompts & Strict JSON Schemas
    │   ├── PHASES_PLAN.md        # Iterative Build Roadmap & QA Verification Checklists
    │   ├── ANGULAR_PATTERNS.md   # Angular 21 Required Syntax & Pattern Reference
    │   └── BACKEND_PATTERNS.md   # Supabase JS v2 & Deno Edge Function Patterns
    └── package.json              # Client Dependency and Testing Script Declarations
