import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  CustomerDetail,
  CustomerInvoiceSummary,
  CustomerSummary,
} from '../../shared/models/customer.models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/customers`;

  /** Cartera del vendedor logueado (lista plana). */
  portfolio() {
    return this.http.get<CustomerSummary[]>(`${this.base}/portfolio`);
  }

  /** Búsqueda paginada. */
  search(query: string, page = 0, size = 20) {
    return this.http.get<PageResponse<CustomerSummary>>(this.base, {
      params: { query, page, size },
    });
  }

  detail(id: number) {
    return this.http.get<CustomerDetail>(`${this.base}/${id}`);
  }

  /** Facturas del cliente (historial). */
  invoices(id: number) {
    return this.http.get<CustomerInvoiceSummary[]>(
      `${environment.apiUrl}/invoices/by-customer/${id}`,
    );
  }
}
