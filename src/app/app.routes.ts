import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'scheduler',
    loadComponent: () =>
      import('./features/scheduler/scheduler').then(
        (m) => m.SchedulerComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'journal',
    loadComponent: () =>
      import('./features/journal/journal').then(
        (m) => m.JournalComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'library',
    loadComponent: () =>
      import('./features/library/library').then(
        (m) => m.LibraryComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'vault',
    loadComponent: () =>
      import('./features/vault/vault').then((m) => m.VaultComponent),
    canActivate: [authGuard],
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
