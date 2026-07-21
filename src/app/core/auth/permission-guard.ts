import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth';

/** Protege una ruta por permiso (uno o varios; basta tener uno). */
export function permissionGuard(...perms: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.hasAny(...perms) ? true : router.parseUrl('/dashboard');
  };
}
