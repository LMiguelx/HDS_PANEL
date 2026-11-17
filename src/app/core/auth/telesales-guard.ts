import { CanActivateChildFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth';

/**
 * Rutas que siguen siendo "el punto de llegada común" en modo televentas
 * (doc 42, sección 1.3): el detalle y la edición de un pedido son los
 * mismos de siempre, a los que Mi día, Mis pedidos y Liquidación navegan.
 * El resto de `/pedidos` (listado general, Nuevo pedido de mostrador) sigue
 * bloqueado: ese lo reemplaza el propio menú de Televentas.
 */
const EXEMPT_PREFIXES = ['/televentas', '/mi-perfil', '/pedidos/detalle', '/pedidos/editar'];

/**
 * Modo televentas (doc 42, sección 1.1): si el usuario navega a mano a la
 * URL de otro módulo, lo devuelve a Mi día. Va como `canActivateChild` en
 * la ruta del shell: cubre cualquier hijo, incluido `/dashboard` (destino
 * de la redirección `''`).
 */
export const telesalesRouteGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isTelesalesMode()) return true;
  const url = state.url;
  if (EXEMPT_PREFIXES.some((p) => url.startsWith(p))) return true;
  return router.parseUrl('/televentas');
};
