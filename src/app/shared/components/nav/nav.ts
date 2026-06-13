import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { FLORA_HOVER } from '../../ui/pt/states.pt';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher';
import { SignOutButtonComponent } from '../sign-out-button/sign-out-button';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    ThemeToggleComponent,
    LanguageSwitcherComponent,
    SignOutButtonComponent,
    TranslocoPipe,
  ],
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
