import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { decodeJwt } from './jwt.util';
import { Session, TokenResponse } from '../../shared/models/auth.models';

const ACCESS_KEY = 'hds.access';
const REFRESH_KEY = 'hds.refresh';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private accessToken = signal<string | null>(null);
  private sessionSig = signal<Session | null>(null);

  readonly currentUser = this.sessionSig.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSig() !== null);
  readonly permissions = computed(() => this.sessionSig()?.permissions ?? []);

  constructor() {
    this.restoreFromStorage();
  }

  login(tenantTaxId: string, username: string, password: string) {
    return this.http.post<TokenResponse>(`${environment.apiUrl}/auth/login`, {
      tenantTaxId,
      username,
      password,
    });
  }

  handleTokens(res: TokenResponse): void {
    this.accessToken.set(res.accessToken);
    localStorage.setItem(ACCESS_KEY, res.accessToken);
    localStorage.setItem(REFRESH_KEY, res.refreshToken);

    const claims = decodeJwt(res.accessToken);
    this.sessionSig.set({
      userId: res.user.userId,
      username: res.user.username,
      fullName: res.user.fullName,
      roles: claims['roles'] ?? res.user.roles ?? [],
      permissions: claims['permissions'] ?? [],
    });
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  /** ¿Tiene este permiso exacto? */
  has(permission: string): boolean {
    return this.permissions().includes(permission);
  }
  /** ¿Tiene al menos uno? (vacío = sí, para ítems públicos del menú) */
  hasAny(...perms: string[]): boolean {
    return perms.length === 0 || perms.some((p) => this.has(p));
  }
  hasRole(role: string): boolean {
    return this.currentUser()?.roles.includes(role) ?? false;
  }

  logout(): void {
    this.accessToken.set(null);
    this.sessionSig.set(null);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    void this.router.navigateByUrl('/login');
  }

  private restoreFromStorage(): void {
    const token = localStorage.getItem(ACCESS_KEY);
    if (!token) return;

    const claims = decodeJwt(token);
    // Si expiró, limpia y no restaura sesión.
    if (!claims['exp'] || claims['exp'] * 1000 < Date.now()) {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      return;
    }

    this.accessToken.set(token);
    this.sessionSig.set({
      userId: claims['uid'],
      username: claims['sub'] ?? '',
      fullName: '',
      roles: claims['roles'] ?? [],
      permissions: claims['permissions'] ?? [],
    });
  }
}
