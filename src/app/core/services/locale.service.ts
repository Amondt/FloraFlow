import { Injectable, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type Locale = 'en' | 'fr' | 'nl';

export interface LocaleOption {
  id: Locale;
  label: string;
}

const SUPPORTED_LOCALES: Locale[] = ['en', 'fr', 'nl'];
const LOCALE_STORAGE_KEY = 'flora-locale';

function detectInitialLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
    return stored as Locale;
  }
  const navLang = navigator.language.slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.includes(navLang as Locale) ? (navLang as Locale) : 'en';
}

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly translocoService = inject(TranslocoService);

  readonly locale = signal<Locale>(detectInitialLocale());

  readonly availableLocales: LocaleOption[] = [
    { id: 'en', label: 'English' },
    { id: 'fr', label: 'Français' },
    { id: 'nl', label: 'Nederlands' },
  ];

  private readonly applyLocaleEffect = effect(() => {
    const lang = this.locale();
    this.translocoService.setActiveLang(lang);
    localStorage.setItem(LOCALE_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  });

  setLocale(locale: Locale): void {
    this.locale.set(locale);
  }
}
