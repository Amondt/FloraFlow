import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FLORA_HOVER } from '../../ui/pt/states.pt';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.html',
})
export class NavComponent {
  protected readonly linkBase = [
    'inline-flex items-center h-14 px-4 -mb-px',
    'text-sm font-medium font-display',
    'text-neutral-600 dark:text-neutral-300',
    'border-b-2 border-transparent',
    'hover:text-primary-600 dark:hover:text-primary-400',
    'outline-none focus-visible:!border-primary-500 dark:focus-visible:!border-primary-400',
    FLORA_HOVER,
  ].join(' ');

  protected readonly linkActive = '!border-primary-500 text-primary-600 dark:text-primary-400';
}
