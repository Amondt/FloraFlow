import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { TranslocoHttpLoader } from './core/services/transloco-loader';
import { LocaleService } from './core/services/locale.service';

function clearStaleSwInDev(): () => Promise<void> {
  return async () => {
    if (isDevMode() && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(PreloadAllModules),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(),
    providePrimeNG({ ripple: false, unstyled: true }),
    provideTransloco({
      config: {
        availableLangs: ['en', 'fr', 'nl'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideTranslocoMessageformat(),
    provideAppInitializer(() => {
      const localeService = inject(LocaleService);
      const translocoService = inject(TranslocoService);
      const lang = localeService.locale();
      translocoService.setActiveLang(lang);
      return firstValueFrom(translocoService.load(lang));
    }),
    { provide: APP_INITIALIZER, useFactory: clearStaleSwInDev, multi: true },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
