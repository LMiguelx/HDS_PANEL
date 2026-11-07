import { Routes } from '@angular/router';

// Todos los endpoints de este módulo requieren un único permiso
// (customer.assign), ya exigido por la ruta padre en app.routes.ts — no hace
// falta repetir permissionGuard por pantalla (mismo criterio que Promociones
// usa para sus rutas sin permiso más estricto que el del módulo).
export const ASSIGNMENT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./portfolio').then((m) => m.PortfolioPage) },
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
  // Pestañas eliminadas (doc 68, sección 3): Cartera con su filtro de horario.
  {
    path: 'listado',
    loadComponent: () => import('./assignments-redirect').then((m) => m.AssignmentsRedirectPage),
    data: { schedule: 'ALL' },
  },
  {
    path: 'huerfanos',
    loadComponent: () => import('./assignments-redirect').then((m) => m.AssignmentsRedirectPage),
    data: { schedule: 'NO_SELLER' },
  },
  {
    path: 'pendientes',
    loadComponent: () => import('./assignments-redirect').then((m) => m.AssignmentsRedirectPage),
    data: { schedule: 'INCOMPLETE' },
  },
];
