import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Tooltip } from 'primeng/tooltip';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FLORA_FOCUS, FLORA_HOVER } from '../../ui/pt/states.pt';

@Component({
  selector: 'app-sign-out-button',
  standalone: true,
  imports: [TranslocoPipe, Tooltip],
  templateUrl: './sign-out-button.html',
})
export class SignOutButtonComponent {
  private readonly supabase = inject(SupabaseService);

  protected readonly loggingOut = signal(false);

  protected readonly buttonClass = [
    'cursor-pointer inline-flex items-center justify-center h-14 px-3',
    'text-sm font-medium font-display',
    'text-neutral-600 dark:text-neutral-300',
    'hover:text-danger-500 dark:hover:text-danger-400',
    FLORA_FOCUS,
    FLORA_HOVER,
  ].join(' ');

  async signOut(): Promise<void> {
    this.loggingOut.set(true);
    await this.supabase.signOut();
    window.location.assign('/login');
  }
}
