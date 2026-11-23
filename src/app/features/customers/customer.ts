import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  AdminCustomerFilters,
  AdminCustomerSummary,
  CreateCustomerCommand,
  CreateCustomerResult,
  CustomerDetail,
  CustomerEditOptions,
  CustomerInvoiceSummary,
  CustomerSummary,
  EditCustomerCommand,
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

  /** Clientes que cubre hoy por ausencia de otro vendedor — doc 42, sección 6.1. */
  portfolioCoverage() {
    return this.http.get<CustomerSummary[]>(`${this.base}/portfolio/coverage`);
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

  /** customer.status.manage — doc 68, sección 8.2: deja la asignación en pausa, sin borrarla. */
  deactivate(customerId: number) {
    return this.http.post<CustomerDetail>(`${this.adminBase}/${customerId}/deactivate`, {});
  }

  /** customer.status.manage — doc 68, sección 8.3: vuelve con el mismo vendedor y horario. */
  activate(customerId: number) {
    return this.http.post<CustomerDetail>(`${this.adminBase}/${customerId}/activate`, {});
  }

  private editOptions$?: Observable<CustomerEditOptions>;

  /** customer.edit — doc 70, sección 1.1. Catálogos casi fijos: se cachea en memoria durante la sesión. */
  editOptions() {
    if (!this.editOptions$) {
      this.editOptions$ = this.http
        .get<CustomerEditOptions>(`${this.adminBase}/edit-options`)
        .pipe(shareReplay(1));
    }
    return this.editOptions$;
  }

  /** customer.edit — doc 70, sección 1.1: edición directa desde el panel, no se envía al ERP. */
  update(customerId: number, cmd: EditCustomerCommand) {
    return this.http.patch<CustomerDetail>(`${this.adminBase}/${customerId}`, cmd);
  }

  /** customer.create — doc 74, sección 2.2: el supervisor hace de ERP, código y secuencia incluidos. */
  create(cmd: CreateCustomerCommand) {
    return this.http.post<CreateCustomerResult>(this.adminBase, cmd);
  }
}
