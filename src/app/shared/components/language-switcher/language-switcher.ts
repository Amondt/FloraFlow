import { Component, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Tooltip } from 'primeng/tooltip';
import { Locale, LocaleService } from '../../../core/services/locale.service';
import { FLORA_FOCUS, FLORA_HOVER } from '../../ui/pt/states.pt';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [TranslocoPipe, UpperCasePipe, Tooltip],
  templateUrl: './language-switcher.html',
})
export class LanguageSwitcherComponent {
  protected readonly locale = inject(LocaleService);
  protected readonly isOpen = signal(false);

  protected readonly buttonClass = [
    'cursor-pointer inline-flex items-center justify-center gap-1 h-14 px-3',
    'text-neutral-600 dark:text-neutral-300',
    'hover:text-primary-600 dark:hover:text-primary-400',
    FLORA_FOCUS,
    FLORA_HOVER,
  ].join(' ');

  protected toggle(): void {
    this.isOpen.update((v) => !v);
  }

  protected selectLocale(id: Locale): void {
    this.locale.setLocale(id);
    this.isOpen.set(false);
  }

  // Closes the dropdown when focus leaves the entire component (trigger OR options).
  // relatedTarget is the element gaining focus; if it's still inside this component,
  // do nothing so keyboard users can Tab between options without the list collapsing.
  protected onContainerFocusOut(event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement;
    if (!container.contains(event.relatedTarget as Node | null)) {
      this.isOpen.set(false);
    }
  }
}
