import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslocoPipe],
  templateUrl: './bottom-nav.html',
})
export class BottomNavComponent {
  protected readonly tabBase = [
    'relative flex-1 flex flex-col items-center justify-center gap-0.5',
    'text-neutral-500 dark:text-neutral-400',
    'outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset',
    'transition-colors duration-150',
  ].join(' ');

  protected readonly tabActive = '!text-primary-600 dark:!text-primary-400';

  // truncate (not wrap) — longer FR/NL translations would otherwise wrap to two lines and
  // break the bar's fixed height; max-w-full lets it shrink within the flex-1 tab instead
  // of overflowing. leading-tight (not leading-none) — truncate's overflow-hidden clips to
  // the line box, and leading-none's line-height (1) is too tight to fit descenders (g, y),
  // shaving their tails off.
  protected readonly tabLabel =
    'max-w-full truncate text-[0.6875rem] font-display font-medium leading-tight';
}
