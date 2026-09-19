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
  UserSummaryView,
  UserView,
} from '../../shared/models/user.models';

/** UserAdminController, /api/users — requiere `user.manage`. */
@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/users`;

  create(cmd: CreateUserCommand) {
    return this.http.post<UserCreatedResult>(this.base, cmd);
  }

  list(page = 0, size = 20) {
    let params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<UserSummaryView>>(this.base, { params });
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
