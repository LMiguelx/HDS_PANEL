import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth';
import { permissionGuard } from '../../core/auth/permission-guard';

/**
 * Con `notification.send` pero sin `notification.view_all` solo se muestra
 * Nuevo envío (sección 13.4) — la entrada del módulo cae directo ahí en vez
 * de la pestaña Del equipo, que el usuario no podría consultar.
 */
const notificationHomeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.hasAny('notification.view_all')) return true;
  if (auth.hasAny('notification.send')) return router.parseUrl('/notificaciones/nuevo');
  return router.parseUrl('/dashboard');
};

export const NOTIFICATION_ROUTES: Routes = [
  {
    path: '',
    canActivate: [notificationHomeGuard],
    loadComponent: () => import('./notifications-team').then((m) => m.NotificationsTeamPage),
  },
  {
    path: 'envios',
    canActivate: [permissionGuard('notification.view_all')],
    loadComponent: () =>
      import('./notifications-broadcasts').then((m) => m.NotificationsBroadcastsPage),
  },
  {
    path: 'nuevo',
    canActivate: [permissionGuard('notification.send')],
    loadComponent: () =>
      import('./notification-new-broadcast').then((m) => m.NotificationNewBroadcastPage),
  },
];
