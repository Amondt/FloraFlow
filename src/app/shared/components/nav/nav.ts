import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { FLORA_HOVER } from '../../ui/pt/states.pt';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher';
import { SignOutButtonComponent } from '../sign-out-button/sign-out-button';
import { LogoComponent } from '../logo/logo';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    ThemeToggleComponent,
    LanguageSwitcherComponent,
    SignOutButtonComponent,
    LogoComponent,
    TranslocoPipe,
  ],
  templateUrl: './nav.html',
})
export class NavComponent {
  // px-2 between md and lg — that band is tight: 5 tab links + the language/theme/sign-out
  // cluster competing for the same row, and longer translations (French) overflow it first.
  // lg: regains the roomier px-4 once the viewport has space to spare.
  protected readonly linkBase = [
    'inline-flex items-center gap-1.5 h-14 px-2 lg:px-4 -mb-px whitespace-nowrap',
    'text-sm font-medium font-display',
    'text-neutral-600 dark:text-neutral-300',
    'border-b-2 border-transparent',
    'hover:text-primary-600 dark:hover:text-primary-400',
    'outline-none focus-visible:!border-primary-500 dark:focus-visible:!border-primary-400',
    FLORA_HOVER,
  ].join(' ');

  protected readonly linkActive = '!border-primary-500 text-primary-600 dark:text-primary-400';
}
