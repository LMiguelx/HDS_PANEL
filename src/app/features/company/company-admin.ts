import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  BranchView,
  ConfigView,
  CreateBranchCommand,
  UpsertConfigCommand,
} from '../../shared/models/tenant.models';

/**
 * TenantController, /api/tenant — sedes y configuración. `branches()` es de
 * cualquier autenticado (lo usa también el alta de usuarios); el resto
 * requiere `config.edit`. No hay endpoint para reabrir una sede: solo
 * `deactivate` (cierre), sin `activate` documentado.
 */
@Injectable({ providedIn: 'root' })
export class CompanyAdminService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  branches() {
    return this.http.get<BranchView[]>(`${this.api}/tenant/branches`);
  }

  createBranch(cmd: CreateBranchCommand) {
    return this.http.post<BranchView>(`${this.api}/tenant/branches`, cmd);
  }

  deactivateBranch(branchId: number) {
    return this.http.post<void>(`${this.api}/tenant/branches/${branchId}/deactivate`, {});
  }

  configurations(group?: string) {
    let params = new HttpParams();
    if (group) params = params.set('group', group);
    return this.http.get<ConfigView[]>(`${this.api}/tenant/configurations`, { params });
  }

  putConfiguration(cmd: UpsertConfigCommand) {
    return this.http.put<ConfigView>(`${this.api}/tenant/configurations`, cmd);
  }
}
