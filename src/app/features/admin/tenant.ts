import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  BranchView,
  ConfigView,
  CreateBranchCommand,
  RecalculationResult,
  TenantInfo,
  UpsertConfigCommand,
} from '../../shared/models/tenant.models';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  tenant() {
    return this.http.get<TenantInfo>(`${this.api}/tenant`);
  }

  // Sedes
  branches() {
    return this.http.get<BranchView[]>(`${this.api}/tenant/branches`);
  }
  createBranch(cmd: CreateBranchCommand) {
    return this.http.post<BranchView>(`${this.api}/tenant/branches`, cmd);
  }
  deactivateBranch(id: number) {
    return this.http.post<void>(`${this.api}/tenant/branches/${id}/deactivate`, {});
  }

  // Configuración
  configurations(group?: string) {
    const params = group ? { group } : undefined;
    return this.http.get<ConfigView[]>(`${this.api}/tenant/configurations`, { params });
  }
  putConfiguration(cmd: UpsertConfigCommand) {
    return this.http.put<ConfigView>(`${this.api}/tenant/configurations`, cmd);
  }

  // Mantenimiento
  recalculateMetrics() {
    return this.http.post<RecalculationResult>(`${this.api}/admin/metrics/recalculate`, {});
  }
}
