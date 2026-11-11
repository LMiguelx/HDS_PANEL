import { Routes } from '@angular/router';

export const SEGMENT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./segment-list').then((m) => m.SegmentListPage) },
  {
    path: ':id',
    loadComponent: () => import('./segment-members').then((m) => m.SegmentMembersPage),
  },
];
