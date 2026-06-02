import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginComponent),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/onboarding/onboarding').then((m) => m.OnboardingComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shared/components/shell/shell').then((m) => m.ShellComponent),
    canActivate: [authGuard, onboardingGuard],
    children: [
      {
        path: 'dashboard',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
          },
          {
            path: 'zones/:id',
            loadComponent: () =>
              import('./features/dashboard/zone-detail/zone-detail').then(
                (m) => m.ZoneDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'scheduler',
        loadComponent: () =>
          import('./features/scheduler/scheduler').then((m) => m.SchedulerComponent),
      },
      {
        path: 'journal',
        loadComponent: () => import('./features/journal/journal').then((m) => m.JournalComponent),
      },
      {
        path: 'library',
        loadComponent: () => import('./features/library/library').then((m) => m.LibraryComponent),
      },
      {
        path: 'vault',
        loadComponent: () => import('./features/vault/vault').then((m) => m.VaultComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
