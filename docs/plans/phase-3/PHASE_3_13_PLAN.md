# 3.13 — Journal Entry Edit / Delete + Care-Tips-Style Accordion

> No DB migration needed. Pure frontend work within `src/app/features/journal/`.

---

## Blocks

- [x] **Block A — `JournalService`: `updateEntry` + `deleteEntry`** | Agent: `/visualizer`
  - Add `JournalUpdate` type alias from `database.types.ts`
  - `updateEntry(id: string, payload: JournalUpdate): Promise<void>` — `UPDATE plant_journals WHERE id`
  - `deleteEntry(id: string): Promise<void>` — `DELETE FROM plant_journals WHERE id`
  - No signal mutation in service — callers reload via `loadEntries()`

- [x] **Block B — `JournalEntryFormComponent`: edit mode** | Agent: `/visualizer`
  - Add `editEntry = input<JournalEntryWithPlant | null>(null)`
  - `isEditMode = computed(() => this.editEntry() !== null)`
  - Pre-fill effect: when `visible() && isEditMode()`, patch all form fields from `editEntry()`
    - `logged_at` conversion: `new Date(entry.logged_at).toISOString().slice(0, 10)` → `YYYY-MM-DD`
  - `onSubmit()` branches: `isEditMode()` → `updateEntry(id, { category, notes, logged_at })`, else `createEntry()`
  - Dialog `[header]`: `isEditMode() ? 'Edit Care Event' : 'Log Care Event'`
  - "Log entry" button label: `isEditMode() ? 'Save changes' : 'Log entry'`
  - Photo section: hidden with `@if (!isEditMode())` — photo cannot be changed after logging
  - Toast: "Entry updated" / "Your care event has been updated." in edit mode

- [x] **Block C — `JournalEntryCardComponent`: footer CTA + accordion move** | Agent: `/visualizer`
  - Add `editRequested = output<void>()`
  - Add `deleteRequested = output<void>()`
  - Remove the existing full-width "Action points" button from mid-card
  - Add `<footer class="px-3.5 pb-3 pt-3 border-t border-neutral-100 dark:border-neutral-700 flex items-center gap-1">` after the main content `<div>`
    - Edit button: `pi-pencil` + "Edit" label, `hover:text-primary-600`, emits `editRequested`
    - Delete button: `pi-trash` + "Delete" label, `hover:text-danger-500`, emits `deleteRequested`
    - `@if (diagnostics())`: "Action points" button with `pi-eye` icon + chevron (zone-detail pattern)
      - `aria-expanded`, `(click)="toggleDiagnostics()"`, rotating chevron `[class.rotate-180]`
  - Move diagnostics panel content block below `</footer>`:
    ```html
    @if (showDiagnostics() && diagnostics()) {
    <div class="border-t border-neutral-100 dark:border-neutral-700 px-3.5 py-3.5 relative z-20">
      <!-- remedial actions list — unchanged -->
    </div>
    }
    ```
  - Lightbox stays last, unchanged

- [x] **Block D — `JournalComponent`: wire edit/delete, add ConfirmDialog** | Agent: `/visualizer`
  - Add `editingEntry = signal<JournalEntryWithPlant | null>(null)`
  - Update `openDialog()`: also sets `editingEntry(null)` before opening
  - Add `onEditRequested(entry: JournalEntryWithPlant)`: sets `editingEntry(entry)`, `dialogVisible.set(true)`
  - Add `onDeleteRequested(entry: JournalEntryWithPlant)`: calls `ConfirmationService.confirm()`:
    - `message`: `'Delete this ${entry.category} entry for ${entry.plants.common_name}? This cannot be undone.'`
    - `header`: `'Delete entry'`
    - `acceptLabel`: `'Delete entry'`
    - `rejectLabel`: `'Cancel'`
    - `accept`: calls `journalService.deleteEntry(entry.id)` → `loadEntries()` → success toast
    - Error path: error toast
  - Update `onEntrySaved()`: also clears `editingEntry(null)` after save
  - Pass `[editEntry]="editingEntry()"` to `app-journal-entry-form`
  - Template `app-journal-entry-card`: bind `(editRequested)="onEditRequested(entry)"` and `(deleteRequested)="onDeleteRequested(entry)"`
  - Add `<p-confirmdialog [pt]="FloraConfirmDialogPT" />` to template
  - Imports: add `ConfirmDialogModule`; providers: add `ConfirmationService`

---

## Verification

```powershell
bun run format
bun run lint
```

**Manual Browser Check — Journal Entry Edit / Delete**

App running at: `http://localhost:4200/journal`

1. Open journal page → each card shows a footer with **Edit** and **Delete** buttons.
2. If an entry has a Leaf Doctor diagnostic → footer also shows **Action points** with chevron.
3. Click **Action points** → diagnostics panel expands below the footer; chevron rotates 180°. Click again → collapses.
4. Click **Edit** on any card → "Edit Care Event" dialog opens, pre-filled with the entry's category, notes, and date. Photo section is not shown.
5. Change the notes → click **Save changes** → dialog closes, toast "Entry updated" appears, card reflects the new notes.
6. Click **Delete** on any card → confirm dialog appears with "Delete entry" / "Cancel" buttons.
7. Click **Cancel** → dialog dismisses, no change.
8. Click **Delete** again → confirm → entry disappears from the list, toast "Entry deleted" appears.
9. Click **New entry** → "Log Care Event" dialog opens (not pre-filled, photo section visible).
10. Open DevTools Console → zero red errors across all steps.
