import { Routes } from '@angular/router';

export const FLEET_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./fleet-vehicles').then((m) => m.FleetVehiclesPage) },
  { path: 'equipos', loadComponent: () => import('./fleet-teams').then((m) => m.FleetTeamsPage) },
];
