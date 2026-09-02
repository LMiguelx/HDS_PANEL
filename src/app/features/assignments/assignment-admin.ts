import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { PageResponse } from '../../shared/models/api.models';
import {
  AssignmentListFilters,
  AssignmentView,
  AutoAssignmentResult,
  CoverageView,
  CreateAssignmentCommand,
  CreateCoverageCommand,
  IncompleteScheduleView,
  MapCustomerView,
  MapQuery,
  OrphanCustomerView,
  UpdateScheduleCommand,
  VendorOnRouteView,
} from '../../shared/models/assignment-admin.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AssignmentAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/assignments`;

  list(filters: AssignmentListFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<PageResponse<AssignmentView>>(this.base, { params });
  }

  orphans() {
    return this.http.get<OrphanCustomerView[]>(`${this.base}/orphans`);
  }

  activeVendorsToday() {
    return this.http.get<VendorOnRouteView[]>(`${this.base}/active-vendors-today`);
  }

  vendorsWithoutRouteToday() {
    return this.http.get<VendorOnRouteView[]>(`${this.base}/vendors-without-route-today`);
  }

  /** El endpoint nunca debe llamarse sin filtro: exige userIds no vacío u orphansOnly. */
  map(query: MapQuery) {
    let params = new HttpParams();
    for (const id of query.userIds ?? []) {
      params = params.append('userIds', String(id));
    }
    if (query.orphansOnly) {
      params = params.set('orphansOnly', 'true');
    }
    return this.http.get<MapCustomerView[]>(`${this.base}/map`, { params });
  }

  create(cmd: CreateAssignmentCommand) {
    return this.http.post<AssignmentView>(this.base, cmd);
  }

  updateSchedule(assignmentId: number, cmd: UpdateScheduleCommand) {
    return this.http.patch<AssignmentView>(`${this.base}/${assignmentId}/schedule`, cmd);
  }

  end(assignmentId: number) {
    return this.http.post<void>(`${this.base}/${assignmentId}/end`, {});
  }

  coverage(cmd: CreateCoverageCommand) {
    return this.http.post<CoverageView[]>(`${this.base}/coverage`, cmd);
  }

  autoAssign() {
    return this.http.post<AutoAssignmentResult>(`${this.base}/auto-assign`, {});
  }

  pendingSchedule() {
    return this.http.get<IncompleteScheduleView[]>(`${this.base}/pending-schedule`);
  }
}
