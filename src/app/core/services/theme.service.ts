import {
  Injectable,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly destroyRef = inject(DestroyRef);

  readonly preference = signal<ThemePreference>(
    (() => {
      const stored = localStorage.getItem('flora-theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    })(),
  );

  private readonly systemPrefersDark = signal(
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  readonly resolvedTheme = computed<'light' | 'dark'>(() =>
    this.preference() === 'system'
      ? this.systemPrefersDark()
        ? 'dark'
        : 'light'
      : this.preference(),
  );

  private readonly applyThemeEffect = effect(() => {
    const pref = this.preference();
    const resolved = this.resolvedTheme();

    document.documentElement.classList.toggle('dark', resolved === 'dark');

    if (pref === 'system') {
      localStorage.removeItem('flora-theme');
    } else {
      localStorage.setItem('flora-theme', pref);
    }
  });

  constructor() {
    afterNextRender(() => {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onMediaChange = (e: MediaQueryListEvent) => this.systemPrefersDark.set(e.matches);
      mq.addEventListener('change', onMediaChange);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', onMediaChange));
    });
  }

  cycle(): void {
    const next: Record<ThemePreference, ThemePreference> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    this.preference.set(next[this.preference()]);
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
  }
}
