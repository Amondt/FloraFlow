import { importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import enJson from '../../../public/i18n/en.json';

/**
 * Provides Transloco with the English translation file preloaded and MessageFormat
 * interpolation enabled — matching the real app config so {param} substitution works in tests.
 */
export function provideTranslocoTesting() {
  return [
    importProvidersFrom(
      TranslocoTestingModule.forRoot({
        langs: { en: enJson },
        translocoConfig: {
          availableLangs: ['en'],
          defaultLang: 'en',
        },
        preloadLangs: true,
      }),
    ),
    provideTranslocoMessageformat(),
  ];
}
