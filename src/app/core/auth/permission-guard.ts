import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth';
import { ToastService } from '../ui/toast';

/** Protege una ruta por permiso (uno o varios; basta tener uno). */
export function permissionGuard(...perms: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (auth.hasAny(...perms)) return true;
    // Entrar por URL a una sección sin permiso vuelve al inicio con aviso
    // (doc 50, secciones 3 y 10) — vale para cualquier ruta guardada, no
    // solo las del Jefe de reparto.
    inject(ToastService).info('No tienes acceso a esa sección.');
    return router.parseUrl('/dashboard');
  };
}
