import { Routes } from '@angular/router';

// Todos los endpoints de este módulo requieren un único permiso
// (customer.assign), ya exigido por la ruta padre en app.routes.ts — no hace
// falta repetir permissionGuard por pantalla (mismo criterio que Promociones
// usa para sus rutas sin permiso más estricto que el del módulo).
export const ASSIGNMENT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./assignment-home').then((m) => m.AssignmentHomePage) },
  {
    path: 'listado',
    loadComponent: () => import('./assignment-list').then((m) => m.AssignmentListPage),
  },
  {
    path: 'huerfanos',
    loadComponent: () => import('./assignment-orphans').then((m) => m.AssignmentOrphansPage),
  },
  {
    path: 'ausencias',
    loadComponent: () => import('./assignment-absences').then((m) => m.AssignmentAbsencesPage),
  },
  {
    path: 'mapa',
    loadComponent: () => import('./assignment-map').then((m) => m.AssignmentMapPage),
  },
  {
    path: 'coberturas',
    loadComponent: () =>
      import('./assignment-coverage-list').then((m) => m.AssignmentCoverageListPage),
  },
  {
    path: 'pendientes',
    loadComponent: () =>
      import('./assignment-pending-schedule').then((m) => m.AssignmentPendingSchedulePage),
  },
];
