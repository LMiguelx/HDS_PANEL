import { Routes } from '@angular/router';

export const COMPANY_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'sedes' },
  {
    path: 'sedes',
    loadComponent: () => import('./branch-list').then((m) => m.BranchListPage),
  },
  {
    path: 'configuracion',
    loadComponent: () => import('./config-list').then((m) => m.ConfigListPage),
  },
];
