import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../ui/toast';
import { ProblemDetail } from '../../shared/models/api.models';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // El 401 lo maneja el authInterceptor (refresh). No mostramos toast ahí.
      if (err.status !== 401) {
        const problem = err.error as ProblemDetail | undefined;
        const msg =
          problem?.detail ??
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
