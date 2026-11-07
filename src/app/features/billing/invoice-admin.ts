import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  InvoiceDetail,
  InvoiceListFilters,
  InvoiceSummary,
  ManualMatchCommand,
  MismatchCommand,
} from '../../shared/models/invoice.models';

/**
 * `POST /auto-match` no está conectado: no figura en el controller actual
 * (pendiente de confirmación — ver 16-panel-supervision-reparto-facturas.md).
 */
@Injectable({ providedIn: 'root' })
export class InvoiceAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/invoices`;

  byCustomer(customerId: number, filters: InvoiceListFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<PageResponse<InvoiceSummary>>(`${this.base}/by-customer/${customerId}`, {
      params,
    });
  }

  detail(invoiceId: string) {
    return this.http.get<InvoiceDetail>(`${this.base}/${encodeURIComponent(invoiceId)}`);
  }

  match(invoiceId: string, cmd: ManualMatchCommand) {
    return this.http.post<void>(`${this.base}/${encodeURIComponent(invoiceId)}/match`, cmd);
  }

  mismatch(invoiceId: string, cmd: MismatchCommand) {
    return this.http.post<void>(`${this.base}/${encodeURIComponent(invoiceId)}/mismatch`, cmd);
  }

  unmatch(invoiceId: string) {
    return this.http.post<void>(`${this.base}/${encodeURIComponent(invoiceId)}/unmatch`, {});
  }

  unmatched(filters: InvoiceListFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<PageResponse<InvoiceSummary>>(`${this.base}/unmatched`, { params });
  }
}
