import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../ui/toast';
import { ProblemDetail } from '../../shared/models/api.models';

/**
 * Marca una petición cuyo error es esperado y ya se maneja en la pantalla
 * (p. ej. "sin jornada abierta hoy" al consultar /routes/today): el
 * interceptor no muestra el toast genérico para no duplicar el aviso.
 * Uso: `this.http.get(url, { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })`.
 */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/**
 * El backend a veces manda en `detail` una instrucción para el desarrollador
 * ("Usa POST /api/routes/start") — nunca debe llegar tal cual a un usuario
 * final. Si el mensaje menciona una ruta de API o un verbo HTTP, se descarta
 * y se usa un mensaje genérico en su lugar.
 */
const TECHNICAL_DETAIL_PATTERN = /\/api\/|\b(GET|POST|PUT|PATCH|DELETE)\s+\/\w/i;

function cleanDetail(detail: string | undefined): string | null {
  if (!detail) return null;
  return TECHNICAL_DETAIL_PATTERN.test(detail) ? null : detail;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // El 401 lo maneja el authInterceptor (refresh). No mostramos toast ahí.
      if (err.status !== 401 && !req.context.get(SKIP_ERROR_TOAST)) {
        const problem = err.error as ProblemDetail | undefined;
        const msg =
          cleanDetail(problem?.detail) ??
          (err.status === 403
            ? 'No tienes permiso para esta acción.'
            : err.status === 0
              ? 'No se pudo conectar con el servidor.'
              : 'Ocurrió un error. Intenta nuevamente.');
        toast.error(msg);
      }
      return throwError(() => err);
    }),
  );
};
