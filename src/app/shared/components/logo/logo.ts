import { Component, input } from '@angular/core';

// Module-level counter guarantees a unique gradient id per instance, so multiple
// logos on one page never collide on the same <linearGradient id="…">.
let logoInstanceId = 0;

@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-2">
      <svg [class]="markClass()" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs>
          <linearGradient
            [id]="gradId"
            x1="6"
            y1="6"
            x2="42"
            y2="42"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="#10b981" />
            <stop offset="1" stop-color="#047857" />
          </linearGradient>
        </defs>
        <!-- Leaf body -->
        <path d="M9 39 C 9 21, 21 9, 39 9 C 39 27, 27 39, 9 39 Z" [attr.fill]="markFill" />
        <!-- Flowing midrib -->
        <path
          d="M14.5 33.5 C 24 30, 20.5 19.5, 33 14.5"
          fill="none"
          stroke="rgba(255,255,255,0.92)"
          stroke-width="2.4"
          stroke-linecap="round"
        />
      </svg>
      @if (showWordmark()) {
        <span
          [class]="wordmarkClass()"
          class="font-display font-extrabold tracking-tight leading-none select-none"
        >
          <span class="text-neutral-900 dark:text-white">Flora</span
          ><span class="text-primary-600 dark:text-primary-500">Flow</span>
        </span>
      }
    </span>
  `,
})
export class LogoComponent {
  /** Show the "FloraFlow" wordmark beside the leaf mark. */
  readonly showWordmark = input<boolean>(true);
  /** Tailwind size classes for the leaf mark. */
  readonly markClass = input<string>('w-7 h-7');
  /** Tailwind size classes for the wordmark text. */
  readonly wordmarkClass = input<string>('text-lg');

  protected readonly gradId = `flora-leaf-${logoInstanceId++}`;
  protected readonly markFill = `url(#${this.gradId})`;
}
