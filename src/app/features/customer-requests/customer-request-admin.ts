import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  ApproveCreationCommand,
  CreationRequestDetail,
  FieldChangeGroupView,
  RequestListFilters,
  RequestView,
} from '../../shared/models/customer-request.models';

/**
 * El documento no da el path base literal, solo el sufijo (".../creation/pending",
 * etc.) — se usa /api/admin/customer-requests siguiendo el mismo criterio que
 * el resto de este doc: todo lo "(admin)" cuelga de /api/admin/<recurso>
 * (ver /api/admin/customers, /api/admin/assignments). Distinto del
 * /api/customer-requests que usa el vendedor para crear una solicitud.
 */
@Injectable({ providedIn: 'root' })
export class CustomerRequestAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/customer-requests`;

  private paramsFrom(filters: RequestListFilters): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  pendingCreation(filters: RequestListFilters = {}) {
    return this.http.get<PageResponse<RequestView>>(`${this.base}/creation/pending`, {
      params: this.paramsFrom(filters),
    });
  }

  /** Detalle completo, para revisar antes de aprobar/rechazar una creación. */
  creationDetail(requestId: number) {
    return this.http.get<CreationRequestDetail>(`${this.base}/creation/${requestId}`);
  }

  pendingFieldChange() {
    return this.http.get<FieldChangeGroupView[]>(`${this.base}/field-change/pending`);
  }

  pendingClosure(filters: RequestListFilters = {}) {
    return this.http.get<PageResponse<RequestView>>(`${this.base}/closure/pending`, {
      params: this.paramsFrom(filters),
    });
  }

  /** Aprueba y materializa el cliente con el código asignado. */
  approveCreation(requestId: number, cmd: ApproveCreationCommand) {
    return this.http.post<{ customerId: number }>(
      `${this.base}/creation/${requestId}/approve`,
      cmd,
    );
  }

  approveFieldChange(groupId: string) {
    return this.http.post<void>(`${this.base}/field-change/${groupId}/approve`, {});
  }

  rejectFieldChange(groupId: string) {
    return this.http.post<void>(`${this.base}/field-change/${groupId}/reject`, {});
  }

  approveClosure(requestId: number) {
    return this.http.post<void>(`${this.base}/closure/${requestId}/approve`, {});
  }

  /** Rechaza una solicitud de creación o cierre (cambios de campo usan rejectFieldChange). */
  reject(type: 'creation' | 'closure', requestId: number) {
    return this.http.post<void>(`${this.base}/${type}/${requestId}/reject`, {});
  }
}
