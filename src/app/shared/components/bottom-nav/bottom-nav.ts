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
}
