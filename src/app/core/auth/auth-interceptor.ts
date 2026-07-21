import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../../environments/environment';
import { TokenResponse } from '../../shared/models/auth.models';

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
          return http
            .post<TokenResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken: refresh })
            .pipe(
              switchMap((res) => {
                auth.handleTokens(res);
                return next(
                  req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }),
                );
              }),
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
