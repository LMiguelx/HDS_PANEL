import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  AdminResetPasswordCommand,
  AdminUpdateUserCommand,
  AssignRolesCommand,
  CreateUserCommand,
  UserCreatedResult,
  UserSummaryCounts,
  UserSummaryView,
  UserView,
} from '../../shared/models/user.models';

export interface UserListFilters {
  q?: string;
  roleCode?: string;
  active?: boolean;
  onRouteToday?: boolean;
  page?: number;
  size?: number;
}

/** UserAdminController, /api/users — requiere `user.manage`. */
@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/users`;

  create(cmd: CreateUserCommand) {
    return this.http.post<UserCreatedResult>(this.base, cmd);
  }

  /** doc 66, sección 4.1 — filtros en el servidor; ya no trae al usuario que consulta. */
  list(filters: UserListFilters = {}) {
    let params = new HttpParams().set('page', filters.page ?? 0).set('size', filters.size ?? 20);
    if (filters.q) params = params.set('q', filters.q);
    if (filters.roleCode) params = params.set('roleCode', filters.roleCode);
    if (filters.active != null) params = params.set('active', filters.active);
    if (filters.onRouteToday != null) params = params.set('onRouteToday', filters.onRouteToday);
    return this.http.get<PageResponse<UserSummaryView>>(this.base, { params });
  }

  /** doc 66, sección 4.2 — totales y resumen por rol. Sin parámetros. */
  summary() {
    return this.http.get<UserSummaryCounts>(`${this.base}/summary`);
  }

  detail(userId: number) {
    return this.http.get<UserView>(`${this.base}/${userId}`);
  }

  update(userId: number, cmd: AdminUpdateUserCommand) {
    return this.http.patch<void>(`${this.base}/${userId}`, cmd);
  }

  resetPassword(userId: number, cmd: AdminResetPasswordCommand) {
    return this.http.post<void>(`${this.base}/${userId}/reset-password`, cmd);
  }

  assignRoles(userId: number, cmd: AssignRolesCommand) {
    return this.http.put<void>(`${this.base}/${userId}/roles`, cmd);
  }

  deactivate(userId: number) {
    return this.http.post<void>(`${this.base}/${userId}/deactivate`, {});
  }

  activate(userId: number) {
    return this.http.post<void>(`${this.base}/${userId}/activate`, {});
  }
}
