import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { PageResponse, SliceResponse } from '../../shared/models/api.models';
import {
  AssignmentAdminView,
  AssignmentListFilters,
  AssignmentView,
  AutoAssignmentResult,
  CoverageAdminView,
  CoverageCandidateView,
  CoverageListFilters,
  CoverageView,
  CreateAssignmentCommand,
  CreateCoverageCommand,
  IncompleteScheduleView,
  ImportCoverageParams,
  ImportCoverageResult,
  MapQuery,
  MapResponse,
  OrphanCustomerView,
  PendingScheduleFilters,
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
    return this.http.get<PageResponse<AssignmentAdminView>>(this.base, { params });
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
    if (query.date) {
      params = params.set('date', query.date);
    }
    return this.http.get<MapResponse>(`${this.base}/map`, { params });
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

  /** dryRun=true (default) solo simula; dryRun=false aplica los cambios. */
  importCoverage(params: ImportCoverageParams, file: File, dryRun: boolean) {
    const form = new FormData();
    form.append('file', file, file.name);
    let httpParams = new HttpParams()
      .set('absentUserId', params.absentUserId)
      .set('coveringUserId', params.coveringUserId)
      .set('coverageDate', params.coverageDate)
      .set('dryRun', String(dryRun));
    if (params.reason) httpParams = httpParams.set('reason', params.reason);
    return this.http.post<ImportCoverageResult>(`${this.base}/coverage/import`, form, {
      params: httpParams,
    });
  }

  /** Cartera real del vendedor ausente en la fecha dada, para el checklist del modal. */
  coverageCandidates(userId: number, date: string) {
    const params = new HttpParams().set('userId', userId).set('date', date);
    return this.http.get<CoverageCandidateView[]>(`${this.base}/coverage-candidates`, { params });
  }

  /** Coberturas ya realizadas — para confirmar que una puntual no siga apareciendo al día siguiente. */
  coverageList(filters: CoverageListFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<PageResponse<CoverageAdminView>>(`${this.base}/coverage`, { params });
  }

  autoAssign() {
    return this.http.post<AutoAssignmentResult>(`${this.base}/auto-assign`, {});
  }

  /** Pagina sin total: es una cola de trabajo que se encoge mientras se resuelve. */
  pendingSchedule(filters: PendingScheduleFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<SliceResponse<IncompleteScheduleView>>(`${this.base}/pending-schedule`, {
      params,
    });
  }
}
