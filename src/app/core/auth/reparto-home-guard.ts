import { CanActivateChildFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth';

/**
 * Inicio de reparto (doc 50, sección 5.1): quien tiene `delivery.manage` y
 * no `order.view_all` no usa el inicio de ventas — ni él llama a endpoints
 * para los que no tiene permiso. Decidido por permisos, nunca por el nombre
 * del rol (sección 3, regla 5): cualquier otro rol futuro con la misma
 * combinación de permisos cae en el mismo inicio.
 */
export const repartoHomeRouteGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (state.url !== '/dashboard') return true;
  const isRepartoOnly = auth.hasAny('delivery.manage') && !auth.hasAny('order.view_all');
  if (!isRepartoOnly) return true;
  return router.parseUrl('/inicio-reparto');
};
