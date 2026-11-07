import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

/**
 * Mantiene vivas las pantallas de listado con filtros (Pedidos, Reportes de
 * ventas, Asignaciones, Promociones, Catálogo, etc.) cuando se entra a un
 * detalle y se vuelve con "Atrás": por defecto Angular destruye el
 * componente al salir de la ruta y lo recrea desde cero al volver, así que
 * cualquier filtro elegido (vendedor, fecha, búsqueda…) se perdía.
 *
 * Regla: se cachea cualquier ruta hoja (sin hijos activos) cuyo segmento de
 * ruta no tenga parámetro (nada de `:id`) — eso ya separa automáticamente
 * cada listado de su detalle/edición, sin tener que nombrar pantalla por
 * pantalla. `DENY_PATHS` saca las que, aunque no llevan parámetro, son
 * formularios o flujos de un solo uso (crear, simular, sincronizar): volver
 * a ellas con datos a medio llenar de la visita anterior sería peor que
 * perderlos. `DENY_PREFIXES` saca módulos enteros con otro patrón de uso
 * (Televentas, que es más un flujo tipo app que una pantalla de oficina).
 */
const DENY_PATHS = new Set<string>([
  'pedidos/nuevo',
  'promociones/nueva',
  'promociones/simular',
  'notificaciones/nuevo',
  'inventario/ajuste',
  'inventario/cuadre/actualizacion',
  'empresa/sistema',
  'mi-perfil',
]);

const DENY_PREFIXES = ['televentas'];

function fullPath(route: ActivatedRouteSnapshot): string {
  const segments: string[] = [];
  let current: ActivatedRouteSnapshot | null = route;
  while (current) {
    const urlSegments = current.url.map((s) => s.path);
    if (urlSegments.length > 0) segments.unshift(urlSegments.join('/'));
    current = current.parent;
  }
  return segments.join('/');
}

function isCacheable(route: ActivatedRouteSnapshot): boolean {
  if (route.children.length > 0) return false; // no es una hoja: su hijo activo decide
  const path = route.routeConfig?.path;
  // `path: ''` es justo el patrón de casi todos los listados (la ruta
  // índice de su módulo cargado perezoso, p. ej. Pedidos) — ahí sí hay que
  // cachear. Solo se descarta si no hay routeConfig en absoluto o si trae
  // parámetro (`:id`, detalle/edición).
  if (path == null || path.includes(':')) return false;
  const key = fullPath(route);
  if (!key || DENY_PATHS.has(key)) return false;
  return !DENY_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}/`));
}

@Injectable({ providedIn: 'root' })
export class ListRouteReuseStrategy implements RouteReuseStrategy {
  private handles = new Map<string, DetachedRouteHandle>();

  /**
   * `AuthService.logout()` la llama: sin esto, el usuario B vería en caché
   * los listados que dejó armados el usuario A en la misma pestaña/sesión
   * de Electron.
   */
  clear(): void {
    this.handles.clear();
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return isCacheable(route);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = fullPath(route);
    if (!key) return;
    if (handle) this.handles.set(key, handle);
    else this.handles.delete(key);
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    return isCacheable(route) && this.handles.has(fullPath(route));
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    return this.handles.get(fullPath(route)) ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    // Comportamiento por defecto de Angular — lo que ya hace que, p. ej.,
    // pedidos/detalle/123 → pedidos/detalle/456 reutilice el componente en
    // vez de recrearlo (las pantallas de detalle ya reaccionan al input que
    // cambia). Esta estrategia solo agrega el cacheo de arriba.
    return future.routeConfig === curr.routeConfig;
  }
}
