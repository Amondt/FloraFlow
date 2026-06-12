import { Component, computed, inject } from '@angular/core';
import { Tooltip } from 'primeng/tooltip';
import { ThemeService } from '../../../core/services/theme.service';
import { FLORA_FOCUS, FLORA_HOVER } from '../../ui/pt/states.pt';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [Tooltip],
  templateUrl: './theme-toggle.html',
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);

  protected readonly buttonClass = [
    'cursor-pointer inline-flex items-center justify-center h-14 px-3',
    'text-neutral-600 dark:text-neutral-300',
    'hover:text-primary-600 dark:hover:text-primary-400',
    FLORA_FOCUS,
    FLORA_HOVER,
  ].join(' ');

  protected readonly iconClass = computed(() =>
    this.theme.resolvedTheme() === 'dark' ? 'pi pi-moon' : 'pi pi-sun',
  );

  protected readonly tooltipLabel = computed(() =>
    this.theme.resolvedTheme() === 'dark' ? 'Switch to Light' : 'Switch to Dark',
  );

  protected readonly ariaLabel = computed(() =>
    this.theme.resolvedTheme() === 'dark'
      ? 'Dark theme active. Switch to Light.'
      : 'Light theme active. Switch to Dark.',
  );
}
