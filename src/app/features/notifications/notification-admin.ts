import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  AdminNotificationPage,
  BroadcastDetail,
  BroadcastListFilters,
  BroadcastResult,
  BroadcastSummary,
  NotificationListFilters,
  RecipientRoleView,
  RecipientView,
  SendBroadcastCommand,
} from '../../shared/models/notification.models';

function toParams(filters: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class NotificationAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/notifications`;

  /** notification.view_all o notification.send — sección 9.2. */
  recipientRoles() {
    return this.http.get<RecipientRoleView[]>(`${this.base}/recipient-roles`);
  }

  /** Sin `roleCode` trae a todos los usuarios activos, sin paginar — sección 9.3. */
  recipients(roleCode?: string) {
    return this.http.get<RecipientView[]>(`${this.base}/recipients`, {
      params: toParams({ roleCode }),
    });
  }

  /** notification.view_all — sección 9.4. */
  list(filters: NotificationListFilters = {}) {
    return this.http.get<AdminNotificationPage>(this.base, { params: toParams(filters) });
  }

  /** notification.send — sección 10.2. */
  send(cmd: SendBroadcastCommand) {
    return this.http.post<BroadcastResult>(`${this.base}/broadcasts`, cmd);
  }

  /** notification.view_all — sección 11.1. */
  broadcasts(filters: BroadcastListFilters = {}) {
    return this.http.get<PageResponse<BroadcastSummary>>(`${this.base}/broadcasts`, {
      params: toParams(filters),
    });
  }

  /** notification.view_all — sección 11.2. */
  broadcastDetail(broadcastId: number) {
    return this.http.get<BroadcastDetail>(`${this.base}/broadcasts/${broadcastId}`);
  }
}
