import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  OrderDetail,
  OrderListFilters,
  OrderSummary,
  PendingBonusOrderView,
} from '../../shared/models/order.models';

/**
 * Solo los 4 endpoints GET documentados (consulta/supervisión) — creación,
 * envío a facturación y anulación de pedidos no figuran en el documento de
 * referencia, quedan fuera de alcance hasta que se confirmen.
 */
@Injectable({ providedIn: 'root' })
export class OrderAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/orders`;

  private paramsFrom(filters: OrderListFilters): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  /** CU-22 — búsqueda global por cliente y/o vendedor. */
  list(filters: OrderListFilters = {}) {
    return this.http.get<PageResponse<OrderSummary>>(this.base, {
      params: this.paramsFrom(filters),
    });
  }

  byCustomer(customerId: number, filters: OrderListFilters = {}) {
    return this.http.get<PageResponse<OrderSummary>>(`${this.base}/customer/${customerId}`, {
      params: this.paramsFrom(filters),
    });
  }

  detail(orderId: number) {
    return this.http.get<OrderDetail>(`${this.base}/${orderId}`);
  }

  /** Pedidos OPEN con bonificaciones sin stock respaldado. */
  pendingBonuses(branchId?: number) {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', String(branchId));
    return this.http.get<PendingBonusOrderView[]>(`${this.base}/pending-bonuses`, { params });
  }
}
