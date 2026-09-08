import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  AssignTeamCommand,
  BatchCustomerView,
  BatchDetail,
  BatchListFilters,
  BatchSummary,
  ReturnReasonView,
  ReturnView,
} from '../../shared/models/delivery.models';

@Injectable({ providedIn: 'root' })
export class DeliveryAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/deliveries`;

  /** Todas las planillas del tenant, sin filtro de fecha — browse histórico completo. */
  batchesAll(filters: BatchListFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<PageResponse<BatchSummary>>(`${this.base}/batches/all`, { params });
  }

  batchDetail(batchId: number) {
    return this.http.get<BatchDetail>(`${this.base}/batches/${batchId}`);
  }

  batchCustomers(batchId: number) {
    return this.http.get<BatchCustomerView[]>(`${this.base}/batches/${batchId}/customers`);
  }

  /** Solo funciona con la planilla en OPEN — en IN_ROUTE o SETTLED el backend responde error. */
  assignTeam(batchId: number, cmd: AssignTeamCommand) {
    return this.http.patch<void>(`${this.base}/batches/${batchId}/team`, cmd);
  }

  /** Exige que ningún ítem quede en PENDING. */
  settle(batchId: number) {
    return this.http.post<void>(`${this.base}/batches/${batchId}/settle`, {});
  }

  returnsByInvoice(invoiceId: string) {
    return this.http.get<ReturnView[]>(
      `${this.base}/returns/by-invoice/${encodeURIComponent(invoiceId)}`,
    );
  }

  returnReasons() {
    return this.http.get<ReturnReasonView[]>(`${this.base}/return-reasons`);
  }
}
