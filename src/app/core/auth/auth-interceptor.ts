import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, share, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../../environments/environment';
import { TokenResponse } from '../../shared/models/auth.models';

/**
 * Una sola renovación en curso, compartida entre todas las peticiones que
 * reciben 401 al mismo tiempo — doc 62, sección 7.5: antes cada 401
 * disparaba su propio `POST /auth/refresh`; con el token vencido, varias
 * peticiones en paralelo (p. ej. al cargar una pantalla) producían varios
 * refresh seguidos. Ahora la primera dispara la llamada y las demás
 * esperan esa misma antes de reintentarse.
 */
let refreshInFlight: Observable<TokenResponse> | null = null;

function sharedRefresh(http: HttpClient, auth: AuthService, refreshToken: string) {
  if (!refreshInFlight) {
    refreshInFlight = http
      .post<TokenResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((res) => auth.handleTokens(res)),
        share(),
        finalize(() => {
          refreshInFlight = null;
        }),
      );
  }
  return refreshInFlight;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const http = inject(HttpClient); // capturado en contexto de inyección
  const token = auth.getAccessToken();
  const isAuthCall = req.url.includes('/auth/');

  const authReq =
    token && !isAuthCall ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Solo intentamos refrescar en un 401 que no venga de /auth/*
      if (err.status === 401 && !isAuthCall) {
        const refresh = auth.getRefreshToken();
        if (refresh) {
          return sharedRefresh(http, auth, refresh).pipe(
            switchMap((res) =>
              next(req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } })),
            ),
            catchError((err2) => {
              auth.logout();
              return throwError(() => err2);
            }),
          );
        }
        auth.logout();
      }
      return throwError(() => err);
    }),
  );
};
