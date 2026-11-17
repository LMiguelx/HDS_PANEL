import { Routes } from '@angular/router';

export const USER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./user-list').then((m) => m.UserListPage),
  },
  {
    path: ':userId',
    loadComponent: () => import('./user-detail').then((m) => m.UserDetailPage),
  },
];
