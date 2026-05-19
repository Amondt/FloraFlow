# `docs/ANGULAR_PATTERNS.md` — Angular 21 Required Patterns

Reference for **The Visualizer**. Always verify against context7 before implementing — this doc may lag behind the live Angular release.

---

## File Structure & Naming

Angular 21 drops the `.component.` middle segment **for components only**. Other artifact types keep their suffix.

```
// ❌ Old convention
login.component.ts
login.component.html
login.component.css
login.component.spec.ts

// ✅ New convention — components only
login.ts
login.html
login.css
login.spec.ts

// ✅ Other artifacts — suffix stays
plant.service.ts
auth.guard.ts
highlight.directive.ts
date-format.pipe.ts
```

**Template placement — sibling file, not inline**

```ts
// ❌ Inline template — avoid except for trivially small components
@Component({
  template: `<p>Hello</p>`,
})

// ✅ Sibling file — default for every component
@Component({
  templateUrl: './login.html',
  styleUrl:    './login.css',
})
```

The three files for any component share the same base name:
`login.ts` · `login.html` · `login.css`

**Sub-component folder rule**

Each sub-component lives in its own named subfolder inside its feature directory. The feature's page component and shared artifacts (models, services) stay at the feature root.

```
// ❌ Flat — breaks down once a feature has 3+ components
scheduler/
├─ scheduler.ts
├─ scheduler.html
├─ plant-alert-card.ts
├─ plant-alert-card.html
└─ plant-form-dialog.ts

// ✅ Per-component folders — Angular style guide recommendation
scheduler/
├─ scheduler.ts          ← page component at feature root
├─ scheduler.html
├─ plant.model.ts        ← shared within feature, stays at root
├─ plant.service.ts
├─ plant-alert-card/
│  ├─ plant-alert-card.ts
│  └─ plant-alert-card.html
└─ plant-form-dialog/
   ├─ plant-form-dialog.ts
   └─ plant-form-dialog.html
```

Import paths update accordingly:

```ts
// ✅ Correct import from page component to sub-component
import { PlantAlertCardComponent } from './plant-alert-card/plant-alert-card';
```

---

## Dependency Injection

```ts
// ❌ constructor injection is dead
constructor(private svc: PlantService) {}

// ✅ inject() — works in class fields, standalone functions, guards
private readonly svc = inject(PlantService);
```

---

## Component Inputs, Outputs, Two-way Binding

```ts
// ✅ Signal-based — no decorators
readonly plant    = input.required<Plant>();        // required
readonly zone     = input<string>('south-window');  // optional + default
readonly selected = output<Plant>();                // replaces @Output() EventEmitter
readonly query    = model<string>('');              // two-way — replaces @Input + @Output pair

// Accessing in template: plant(), zone(), query()
// Accessing in class:    this.plant(), this.zone()
```

---

## View Queries (Angular 17.3+)

```ts
// ❌ Old decorator-based
@ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

// ✅ Signal-based — no lifecycle hook needed
readonly canvas   = viewChild<ElementRef<HTMLCanvasElement>>('canvas');         // optional
readonly canvas   = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas'); // throws if absent

// Access in class: this.canvas()?.nativeElement
// Access after render (safe):
afterNextRender(() => {
  const el = this.canvas()?.nativeElement; // guaranteed to exist here
});

// Multiple elements
readonly items = viewChildren<ElementRef>('item');
// Access: this.items() → readonly Signal<readonly ElementRef[]>
```

---

## Reactive State

```ts
// Writable source
readonly dueCount = signal(0);

// Derived — recomputes only when deps change — replaces most pipes/selectors
readonly label = computed(() =>
  this.dueCount() === 0 ? 'All clear' : `${this.dueCount()} overdue`
);

// Writable derived — resets when source changes (Angular 19+)
readonly activeZone = linkedSignal(() => this.zones()[0]);

// Side effect — use sparingly, prefer computed()
effect(() => {
  localStorage.setItem('lastZone', this.activeZone().id);
});
```

---

## RxJS Bridge (only when RxJS is unavoidable)

```ts
// Observable → Signal — the most common bridge
private readonly plants$ = this.svc.getPlants();
readonly plants = toSignal(this.plants$, { initialValue: [] });

// Signal → Observable (rare)
readonly plants$ = toObservable(this.plantsSignal);

// Manual subscription — must be assigned to a field, must clean up
private readonly destroyRef = inject(DestroyRef);
private readonly _sub = this.stream$
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(val => { /* side effect */ });
// ↑ _sub is assigned (not a bare statement) so TypeScript accepts it as a field initializer
```

---

## Template Control Flow

```html
<!-- @if — replaces *ngIf -->
@if (plant()) {
<article>{{ plant().commonName }}</article>
} @else {
<p>No plant selected.</p>
}

<!-- @for — replaces *ngFor — track is mandatory -->
@for (p of plants(); track p.id) {
<li>{{ p.commonName }}</li>
} @empty {
<p>No plants yet.</p>
}

<!-- @switch — replaces *ngSwitch -->
@switch (status()) { @case ('dry') { <span class="text-warning-500">Water needed</span> } @case
('moist') { <span class="text-primary-500">All good</span> } @default { <span>Unknown</span> } }

<!-- @let — for aliasing a signal call or narrowing a type, not for computation -->
@let plant = selectedPlant();
<!-- alias to avoid repeated plant()() calls -->
@if (plant) {
<h2>{{ plant.commonName }}</h2>
}

<!-- ❌ Never compute in @let — put derived logic in computed() in the class instead -->
<!-- @let overdue = plants().filter(p => p.isDue);  ← runs on every render -->

<!-- ✅ Correct — computed() in class runs only when deps change -->
<!-- readonly overdue = computed(() => this.plants().filter(p => p.isDue)); -->
```

---

## Deferrable Views

```html
<!-- Lazy-load heavy components -->
@defer (on viewport) {
<app-journal-timeline />
} @loading (minimum 200ms) {
<p class="text-neutral-600 text-sm">Loading…</p>
} @error {
<p class="text-danger-500">Failed to load. Try refreshing.</p>
} @placeholder {
<div class="h-32 bg-neutral-100 rounded-garden-md animate-pulse"></div>
}

<!-- Other triggers -->
@defer (on idle) { ... }
<!-- when browser is idle -->
@defer (on interaction) { ... }
<!-- on first user interaction -->
@defer (when isAdmin()) { ... }
<!-- conditional -->
```

---

## Async Data Fetching (GET — httpResource)

```ts
// httpResource (Angular 19+) — source signal drives the URL reactively
// Use ONLY for GET requests. For mutations, see "Calling Edge Functions" below.
readonly plantData = httpResource<Plant[]>(
  () => `/api/plants?zone=${this.zoneId()}`
);

// Access shape:
// plantData.value()     → Plant[] | undefined
// plantData.isLoading() → boolean
// plantData.error()     → unknown
// plantData.reload()    → trigger refetch
```

Template pattern for all three states:

```html
@if (plantData.isLoading()) {
  <div class="animate-pulse h-32 bg-neutral-100 rounded-garden-md"></div>
} @else if (plantData.error()) {
  <p-message severity="error" text="Failed to load plants. Please try again." />
} @else {
  @for (p of plantData.value(); track p.id) {
    <app-plant-card [plant]="p" />
  } @empty {
    <p class="text-neutral-500 text-sm">No plants found.</p>
  }
}
```

---

## Calling Edge Functions (POST Mutations)

`httpResource` is read-only (GET). For POST/PATCH/DELETE calls to Supabase Edge Functions — such as triggering the AI Scribe, snoozing a plant check, or uploading a diagnosis image — use `HttpClient` directly.

```ts
import { inject }      from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

// In a service or component
private readonly http = inject(HttpClient);

async callEdgeFunction<T>(fnName: string, body: unknown, token: string): Promise<T> {
  const url = `${environment.supabaseUrl}/functions/v1/${fnName}`;
  return firstValueFrom(
    this.http.post<T>(url, body, {
      headers: {
        'Authorization': `Bearer ${token}`,  // user's Supabase JWT
        'Content-Type': 'application/json',
      },
    })
  );
}

// Usage — call after getting the session token from SupabaseService
const result = await this.callEdgeFunction<EnrichmentPayload>(
  'claude-enrichment',
  { scientificName, commonName },
  session.access_token
);
```

**Why not `httpResource` here?** `httpResource` is designed for reactive GET fetches tied to signal-derived URLs. Mutations are imperative actions, not reactive queries — `HttpClient.post()` is the right fit.

---

## DOM Access

```ts
// ❌ Never ngAfterViewInit for DOM-dependent logic (breaks SSR/zoneless)
ngAfterViewInit() { this.chart.render(); }

// ✅ afterNextRender — runs once after first render, only in browser
afterNextRender(() => {
  this.canvasRef.nativeElement.focus();
});

// ✅ afterRender — runs after every render cycle
afterRender(() => { ... });
```

---

## Routing

```ts
// Lazy route — loadComponent, never loadChildren + NgModule
{
  path: 'dashboard',
  loadComponent: () =>
    import('./features/dashboard/dashboard.component')
      .then(c => c.DashboardComponent)
}

// Route params bound directly to input() — requires withComponentInputBinding()
// In app.config.ts:
provideRouter(routes, withComponentInputBinding())
// In component:
readonly plantId = input<string>(); // auto-bound from :plantId route param
```

---

## `satisfies` for PrimeNG PassThrough Objects

Use `satisfies` instead of type casting for PT config — it catches missing/wrong keys at compile time without widening the type:

```ts
import type { CardPassThroughOptions } from 'primeng/card';

// ❌ No type safety — typos compile silently
export const FloraCardPT = {
  root: { class: 'bg-neutral-100 rounded-garden-md p-5' },
};

// ✅ satisfies — validates against the PT interface, preserves literal types
export const FloraCardPT = {
  root: { class: 'bg-neutral-100 rounded-garden-md p-5 shadow-sm' },
  title: { class: 'text-lg font-semibold text-neutral-900' },
  content: { class: 'text-sm text-neutral-600' },
} satisfies CardPassThroughOptions;
```

Apply `satisfies` to every PT object exported from `docs/DESIGN_SYSTEM.md`.

---

## App Config (`app.config.ts`)

```ts
import { providePrimeNG } from 'primeng/config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),          // zoneless — no zone.js
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),             // native fetch, not XHR
    provideAnimationsAsync(),
    providePrimeNG({ ripple: false, unstyled: true }), // unstyled REQUIRED — without it PrimeNG's default theme overrides Tailwind classes
  ],
};
```
