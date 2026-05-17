import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'scheduler',
    loadComponent: () =>
      import('./features/scheduler/scheduler.component').then(
        (m) => m.SchedulerComponent,
      ),
  },
  {
    path: 'journal',
    loadComponent: () =>
      import('./features/journal/journal.component').then(
        (m) => m.JournalComponent,
      ),
  },
  {
    path: 'library',
    loadComponent: () =>
      import('./features/library/library.component').then(
        (m) => m.LibraryComponent,
      ),
  },
  {
    path: 'vault',
    loadComponent: () =>
      import('./features/vault/vault.component').then((m) => m.VaultComponent),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
