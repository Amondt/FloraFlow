import { importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import enJson from '../../../public/i18n/en.json';

/**
 * Provides Transloco with the English translation file preloaded.
 * Add to TestBed providers so components using the transloco pipe resolve correctly.
 */
export function provideTranslocoTesting() {
  return importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { en: enJson },
      translocoConfig: {
        availableLangs: ['en'],
        defaultLang: 'en',
      },
      preloadLangs: true,
    }),
  );
}
