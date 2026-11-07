import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { PageResponse } from '../../shared/models/api.models';
import {
  AssignmentView,
  BulkAssignCommand,
  BulkAssignResult,
  CoverageAdminView,
  CoverageCandidateView,
  CoverageListFilters,
  CoverageView,
  CreateAssignmentCommand,
  CreateCoverageCommand,
  ImportCoverageParams,
  ImportCoverageResult,
  OrphanCustomerView,
  PortfolioCustomerRow,
  PortfolioFilters,
  PortfolioSummary,
  UpdateScheduleCommand,
  VendorOnRouteView,
} from '../../shared/models/assignment-admin.models';
import { environment } from '../../../environments/environment';

function paramsFrom(filters: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Injectable({ providedIn: 'root' })
export class AssignmentAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/assignments`;

  /** Cartera — doc 68, sección 4.1. */
  portfolio(filters: PortfolioFilters = {}) {
    return this.http.get<PageResponse<PortfolioCustomerRow>>(`${this.base}/portfolio`, {
      params: paramsFrom(filters),
    });
  }

  /** Contadores de las tarjetas de Cartera — doc 68, sección 4.2. Siempre a hoy, sin filtros. */
  portfolioSummary() {
    return this.http.get<PortfolioSummary>(`${this.base}/portfolio/summary`);
  }

  /** Asignación en lote — doc 68, sección 6.3. */
  bulkAssign(cmd: BulkAssignCommand) {
    return this.http.post<BulkAssignResult>(`${this.base}/bulk`, cmd);
  }

  /** Solo la usa el mapa de Asignaciones (vista general), que no cambia en el doc 68. */
  orphans() {
    return this.http.get<OrphanCustomerView[]>(`${this.base}/orphans`);
  }

  activeVendorsToday() {
    return this.http.get<VendorOnRouteView[]>(`${this.base}/active-vendors-today`);
  }

  vendorsWithoutRouteToday() {
    return this.http.get<VendorOnRouteView[]>(`${this.base}/vendors-without-route-today`);
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
}
