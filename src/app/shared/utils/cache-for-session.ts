import { Observable, ReplaySubject, share } from 'rxjs';

/**
 * Memoriza el primer resultado exitoso de un observable HTTP para el resto
 * de la sesión (catálogos que casi no cambian: tipos de cliente, roles de
 * notificación…). Un error no queda pegado: `resetOnError` hace que la
 * próxima llamada vuelva a pedirlo en vez de repetir el fallo para siempre.
 */
export function cacheForSession<T>(source$: Observable<T>): Observable<T> {
  return source$.pipe(
    share({
      connector: () => new ReplaySubject(1),
      resetOnError: true,
      resetOnComplete: false,
      resetOnRefCountZero: false,
    }),
  );
}
