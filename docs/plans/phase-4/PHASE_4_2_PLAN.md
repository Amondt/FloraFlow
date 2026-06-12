# Phase 4.2 — i18n EN / FR / NL

> Read `docs/PLANS_GUIDE.md` before touching this file.

## Objective

Runtime EN / FR / NL switching with no page reload, persisted to `localStorage`, plus a
full string audit — zero hardcoded user-facing text left in any template, component, or
shared util after this phase.

**No DB migration — pure frontend.** Mirrors the Phase 4.1 theme pattern: a `core/services`
singleton + a nav-bar control, both signal-driven.

## Library: `@jsverse/transloco`

Verified via context7 (`/jsverse/transloco`) — signal-based API, standalone
`provideTransloco`, runtime `setActiveLang`, HTTP loader. Fits zoneless + Signals:

- **Templates** read via the `transloco` pipe — `{{ 'nav.dashboard' | transloco }}`. With
  `reRenderOnLangChange: true` the pipe calls `markForCheck()`, which schedules a zoneless CD
  tick, so a language switch repaints the current route in the same cycle (QA criterion #2).
- **Reactive TS reads** (computed `aria-label`s, labels) use `translateSignal('key')`.
- **Event-time TS reads** (toast detail strings) use `translocoService.translate('key', params)`.
- **Plurals / counts** (overdue by N days, N varieties) use ICU `{count, plural, …}` via the
  MessageFormat plugin — EN/FR/NL pluralize differently, so a params-only string is wrong.

## Resolved architecture decisions

1. **Translation files: `public/i18n/{en,fr,nl}.json`** — NOT `src/assets/i18n/` as the
   PHASES_PLAN bullet says. `src/assets/` does not exist; `angular.json` serves only `public/`
   (`{ glob: "**/*", input: "public" }`). The loader fetches `/i18n/${lang}.json`. Per CLAUDE.md
   conflict order, the build config (runtime truth) outranks the doc's design-intent path.
   → After this phase, correct the 4.2 bullet in `docs/PHASES_PLAN.md` to read `public/i18n/`.
2. **Keys nested by feature namespace**, one object per area inside each flat lang file:
   `common`, `validation`, `nav`, `language`, `auth`, `onboarding`, `dashboard`, `zones`,
   `tasks`, `journal`, `leafDoctor`, `library`, `botanical`, `seeds`. `common.*` holds the
   shared verbs (Cancel / Save / Delete / Edit / Close / Add / Back / Retry / Loading).
3. **`LocaleService` (`core/services/locale.service.ts`)** mirrors `ThemeService`: a `locale`
   signal, an `effect()` that calls `setActiveLang`, persists `flora-locale`, and sets
   `document.documentElement.lang`. Initial value: `localStorage('flora-locale')` ?? a
   `navigator.language` match against the three locales ?? `'en'` — the same "stored else system"
   fallback shape the theme service uses for `prefers-color-scheme`.
4. **No raw-key flash on first paint:** a `provideAppInitializer` awaits
   `translocoService.load(activeLang)` before the app renders (Angular 21 supersedes the
   `APP_INITIALIZER` token — keep the existing SW initializer untouched).
5. **Pure utils stay pure:** `plant-message.util.ts` and the relative-time strings in
   `date.util.ts` return `{ key, params }`, never a translated string. The caller translates.
   This preserves Single Responsibility — a pure formatter must not depend on `TranslocoService`.
6. **Enum→label maps become key maps:** `journal-categories.ts` `CATEGORY_LABEL`,
   `leaf-doctor.utils` labels, growth-stage / container / substrate enum labels map to keys;
   the visible label is resolved at point of use via the pipe.
7. **Specs:** Block A adds `src/app/testing/transloco-testing.ts` (loads `en.json` into a
   Transloco testing provider). Every feature block that touches a component with a `.spec`
   asserting visible text wires that helper and asserts against the resolved English copy.

## Translation sourcing

Agents draft FR and NL from the EN source keys. The user is the native validator (FR primary,
NL confirm) — FR/NL copy is checked during each block's Manual Browser Check, not assumed correct.
EN is always the source of truth and the `fallbackLang`.

### Namespace example — `nav` (pattern for every block)

```jsonc
// en: { "nav": { "dashboard": "Dashboard", "tasks": "Tasks", … } }
// fr: { "nav": { "dashboard": "Tableau de bord", "tasks": "Tâches", … } }
// nl: { "nav": { "dashboard": "Dashboard", "tasks": "Taken", … } }
```

---

## Blocks

- [x] **Block A — i18n foundation & test harness** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `bun add @jsverse/transloco` + the MessageFormat plugin (confirm exact package + provider
    name via context7 — `@jsverse/transloco-messageformat` / `provideTranslocoMessageformat`).
  - `core/services/transloco-loader.ts` — `TranslocoHttpLoader implements TranslocoLoader`;
    `getTranslation(lang)` → `inject(HttpClient).get('/i18n/' + lang + '.json')`.
  - `app.config.ts` — `provideTransloco({ config: { availableLangs: ['en','fr','nl'],
    defaultLang: 'en', fallbackLang: 'en', reRenderOnLangChange: true, prodMode: !isDevMode() },
    loader: TranslocoHttpLoader })` + the MessageFormat provider + `provideAppInitializer` awaiting
    `load(activeLang)`.
  - `core/services/locale.service.ts` — `Locale = 'en'|'fr'|'nl'`; `locale` signal (init per
    decision 3); `effect()` → `setActiveLang` + persist `flora-locale` + set `<html lang>`;
    `setLocale(l)`; `availableLocales` = `[{ id, label }]`.
  - `public/i18n/{en,fr,nl}.json` scaffolds containing `common.*` + `validation.*` only.
  - `src/app/testing/transloco-testing.ts` — exported helper providing Transloco with `en.json`
    preloaded for TestBed specs.
  - Smoke only (no visible UI change): app boots, Network shows `/i18n/en.json` → 200, no console
    errors. `bun run format` + `bun run lint`.

- [x] **Block B — Language switcher, nav & `<html lang>` (first vertical slice)** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `shared/components/language-switcher/language-switcher.{ts,html}` — trigger `<button>`
    (`pi pi-globe` + `{{ locale.locale() | uppercase }}`, `cursor-pointer`, `aria-haspopup`,
    translated `aria-label`) opening a `p-menu` (`FloraMenuPT`) of the three locales; active item
    check-marked; `command` → `locale.setLocale(id)`. Compose `FLORA_FOCUS` / `FLORA_HOVER` and
    reuse the ThemeToggle button-class shape.
  - `nav.html` — add `<app-language-switcher />` to the `ml-auto` group beside `<app-theme-toggle />`.
  - Migrate nav link labels + `aria-label="Main navigation"` to `nav.*`; add `nav.*` + `language.*`
    keys to all three files (real FR/NL copy).
  - Manual Browser Check: switch EN→FR→NL → nav relabels instantly with zero reload; reload keeps
    the choice; `<html lang>` attribute tracks the locale. `bun run format` + `bun run lint`.

- [x] **Block C — Auth & onboarding** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `features/auth/login.html` + `features/onboarding/onboarding.html` (+ any inline TS toast/aria).
  - Add `auth.*` + `onboarding.*` keys (en/fr/nl). Note: these routes are pre-shell (no switcher);
    they render in the persisted/auto locale — verify by setting locale in the shell, then signing out.
  - format + lint + Manual Browser Check (login + onboarding wizard in all three locales).

- [x] **Block D — Dashboard & zones** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `dashboard.html`, `zone-card`, `zone-form`, `zone-form-fields`, `zone-detail`, `location-dialog`
    (templates + toast/aria strings in their TS). Add `dashboard.*` + `zones.*` keys.
  - Update `zone.service.spec`, `zone-detail.spec`, `location-dialog.spec`, `care-recommendations-panel.spec`
    as touched (wire the test harness; assert resolved EN copy).
  - format + lint + Manual Browser Check (dashboard + a zone detail in all three locales).

- [x] **Block E — Tasks & soil check** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `tasks.html`, `plant-alert-card`, `soil-check-dialog`, `plant-form-dialog` (templates + the
    dialog's dynamic copy + toasts). Add `tasks.*` keys.
  - Update `tasks.spec`, `soil-check-dialog.spec`, `plant-form-dialog.spec`, `plant.service.spec`.
  - format + lint + Manual Browser Check (tasks list, snooze/confirm flow, plant form — all locales).

- [x] **Block F — Journal & Leaf Doctor** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `journal.html`, `journal-entry-card`, `journal-entry-form`, `leaf-doctor-dialog`,
    `leaf-doctor-badges`. Add `journal.*` + `leafDoctor.*` keys. Category label strings come from
    Block J's key map — reference, don't duplicate.
  - Update `journal.service.spec`, `journal-entry-form.spec`, `leaf-doctor-dialog.spec`.
  - format + lint + Manual Browser Check (journal feed, entry form, Leaf Doctor — all locales).

- [ ] **Block G — Library page & filters** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `library.html` (filter section headings, tooltips, empty/loading states, pagination) +
    `botanical-record-card`. Add `library.*` keys.
  - Update `library.spec`.
  - format + lint + Manual Browser Check (library filters + results in all three locales).

- [ ] **Block H — Botanical & shared dialogs** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `botanical-detail-dialog`, `species-photo-carousel`, `botanical-tags`,
    `care-recommendations-panel`, `plant-identifier-dialog`, `substrate-mix-wizard-dialog`,
    `plant-select`, `photo-lightbox-dialog`. Add `botanical.*` keys.
  - Update `species-photo-carousel.spec`, `photo-lightbox-dialog.spec`, `plant-identifier-dialog.spec`.
  - format + lint + Manual Browser Check (species detail dialog + identifier + substrate wizard).

- [ ] **Block I — Seeds** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `seeds.html`, `seed-batch-card`, `seed-batch-form-dialog` (+ stage-label strings, toasts).
    Add `seeds.*` keys.
  - Update `seed-batch.service.spec`.
  - format + lint + Manual Browser Check (seed list, add/edit, stage transitions — all locales).

- [ ] **Block J — Dynamic strings, enum labels & util refactor** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `plant-message.util.ts` → returns `{ key, params }`; callers translate via `translate()`.
    Update `plant-message.util.spec`.
  - `date.util.ts` relative-time strings → ICU plural keys (`{count, plural, …}`) + params.
    Update `date.util.spec`.
  - Convert enum label maps to key maps: `journal-categories.ts` `CATEGORY_LABEL`,
    `leaf-doctor.utils` labels, and the growth-stage / container / substrate enum labels; resolve
    each at point of use.
  - Sweep remaining service-level literals (toasts / aria) in `plant.service`, `journal.service`,
    `seed-batch.service`, `weather.service`, etc.
  - format + lint + Manual Browser Check (urgency messages, dates, category labels switch locale).

- [ ] **Block K — Final audit & lint gate** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Repo-wide sweep for any surviving hardcoded user-facing text (templates + toast/aria literals);
    optionally run `@jsverse/transloco-keys-manager find` to list missing / unused keys.
  - Verify `en/fr/nl` key trees are identical (no missing FR/NL key).
  - Verify QA criterion #2 on every route: switching locale updates all strings in the same render
    cycle with zero page reload.
  - `bun run format` + `bun run lint` → zero errors.
  - Last block of the phase → closing line: "All blocks done — call `/gatekeeper` to close out the phase."

---

## Verification (every block)

Run in this order before any Manual Browser Check:

```powershell
bun run format
bun run lint
```

Then the per-block Manual Browser Check at `http://localhost:4200`, exercised in **all three
locales**, ending with: "Open DevTools Console → confirm zero red errors."

## Phase QA mapping (`docs/PHASES_PLAN.md` §4)

- **#2** — language switch updates all strings on the current route within the same render cycle,
  zero reload → Block K (verified per route in B–J).
- **#5** — `bun run lint` zero errors after all Phase 4 code → Block K.

## Out of scope

- The nav-bar **Sign out** button (Phase 4.3) and **Create account** route (Phase 4.4) — their
  strings are translated when those phases land, not here.
