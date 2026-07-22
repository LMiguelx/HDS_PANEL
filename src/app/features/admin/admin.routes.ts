import { Routes } from '@angular/router';
import { EmpresaShell } from './empresa-shell';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: EmpresaShell,
    children: [
      { path: '', loadComponent: () => import('./tenant-info').then((m) => m.TenantInfoPage) },
      { path: 'sedes', loadComponent: () => import('./branches').then((m) => m.BranchesPage) },
      { path: 'configuracion', loadComponent: () => import('./config').then((m) => m.ConfigPage) },
      {
        path: 'mantenimiento',
        loadComponent: () => import('./maintenance').then((m) => m.MaintenancePage),
      },
    ],
  },
];
