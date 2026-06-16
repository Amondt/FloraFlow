# Phase 5.1 — Viewport, Safe-Area & PWA Shell

**Goal:** Give the app the iOS/Android foundation every later mobile block depends on — the layout reaches edge-to-edge under the notch and home indicator, and bottom-fixed elements (the 5.3 tab bar, 5.2 bottom-anchored dialogs, the 5.7 filter sheet) can pad themselves clear of the home indicator.

**Already in place — do NOT redo:** the `pointer-fine` custom variant already exists in `src/styles.input.css` (companion to the built-in `pointer-coarse:`). This block adds only the safe-area helpers.

**No DB migration. `/visualizer` · Sonnet · low.**

---

- [x] **Block A — Viewport meta** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `src/index.html` — change the viewport meta to opt into the safe-area model:
    ```html
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    ```
  - Without `viewport-fit=cover`, iOS Safari letterboxes the page and `env(safe-area-inset-*)` all report `0` — so this must land before the safe-area utilities are meaningful.

- [x] **Block B — Safe-area utilities** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `src/styles.input.css` — add small utilities the bottom-fixed components compose. Keep them lean (one purpose each):
    ```css
    /* Safe-area helpers — Phase 5 bottom-fixed elements (tab bar, bottom-anchored dialogs, filter sheet).
       env() resolves to 0 on devices without insets, so these are no-ops on desktop. */
    .pb-safe {
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .h-bottom-nav {
      height: calc(3.5rem + env(safe-area-inset-bottom, 0px));
    }
    ```
  - Rationale: centralising the inset math here means 5.2/5.3/5.7 reference one source instead of repeating the `calc()`/`env()` expression (DRY).

- [x] **Block C — Manifest sanity check** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - Open `public/manifest.webmanifest`; confirm `"display": "standalone"` and a valid `"start_url"` (e.g. `"/"` or `"/dashboard"`). Add/fix only if wrong — no change if already correct.

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Safe-area foundation
───────────────────────────────────────────
App: http://localhost:4200  ·  DevTools → device toolbar → iPhone 12 / 14 Pro

1. Pick a device with a notch/Dynamic Island. The page background reaches the very
   top and bottom edges (no white letterbox bars).
2. DevTools → Application → Manifest → "display" reads "standalone", start_url valid,
   no manifest errors listed.
3. DevTools Console → zero red errors.
4. Desktop (disable device toolbar) → layout visually identical to before this block
   (env() insets are 0, so nothing shifts).
```
