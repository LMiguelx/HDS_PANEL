import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  AdminCustomerFilters,
  AdminCustomerSummary,
  CustomerDetail,
  CustomerInvoiceSummary,
  CustomerSummary,
  RateCustomerCommand,
} from '../../shared/models/customer.models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/customers`;
  private adminBase = `${environment.apiUrl}/admin/customers`;

  /** Cartera del vendedor logueado (lista plana). */
  portfolio() {
    return this.http.get<CustomerSummary[]>(`${this.base}/portfolio`);
  }

  /** Búsqueda paginada (cartera del vendedor logueado). */
  search(query: string, page = 0, size = 20) {
    return this.http.get<PageResponse<CustomerSummary>>(this.base, {
      params: { query, page, size },
    });
  }

  /** Ficha completa con métricas de compra. También la usa el mapa de Asignaciones al clickear un punto. */
  detail(id: number) {
    return this.http.get<CustomerDetail>(`${this.base}/${id}`);
  }

  /** Facturas del cliente (historial). */
  invoices(id: number) {
    return this.http.get<CustomerInvoiceSummary[]>(
      `${environment.apiUrl}/invoices/by-customer/${id}`,
    );
  }

  /** Buscador admin (todos los clientes del tenant, no solo la cartera propia). */
  adminSearch(filters: AdminCustomerFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<PageResponse<AdminCustomerSummary>>(this.adminBase, { params });
  }

  /** Califica al cliente (1-5) para priorizar atención. */
  rate(customerId: number, cmd: RateCustomerCommand) {
    return this.http.patch<CustomerDetail>(`${this.adminBase}/${customerId}/rating`, cmd);
  }
}
