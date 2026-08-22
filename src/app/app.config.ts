import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { loadingInterceptor } from '@core/interceptors/loading.interceptor';
import { forbiddenInterceptor } from '@core/interceptors/forbidden.interceptor';
import { AuraTechPrimeNgPreset } from '@core/theme/auratech-primeng.preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([loadingInterceptor, forbiddenInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: AuraTechPrimeNgPreset,
        options: {
          darkModeSelector: '[data-theme="dark"]',
        },
      },
      ripple: true,
    }),
    { provide: LOCALE_ID, useValue: 'en-US' },
    { provide: LocationStrategy, useClass: HashLocationStrategy }
  ]
};
