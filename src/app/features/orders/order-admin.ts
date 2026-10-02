import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  AdminOrderSummary,
  GlobalDailyOrderSummaryView,
  OrderDetail,
  OrderListFilters,
  OrderSummary,
  PendingBonusOrderView,
  UpdateOrderCommand,
} from '../../shared/models/order.models';

/**
 * OrderController, /api/orders. Consulta, edición y las acciones del
 * supervisor sobre un pedido (editar · entregar en mostrador · enviar a
 * facturación · anular) — ver doc 30, sección 8. El registro del pedido de
 * mostrador vive en CounterOrderAdminService (POST /orders/counter).
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

  /**
   * Búsqueda global — todo filtro (fecha, cliente, vendedor, estado) se
   * resuelve en el servidor antes de paginar. Sin from/to, el backend
   * devuelve solo los pedidos de hoy.
   */
  list(filters: OrderListFilters = {}) {
    return this.http.get<PageResponse<AdminOrderSummary>>(this.base, {
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

  /** Solo pedidos OPEN. Se envían solo los productos que cambian. */
  updateItems(orderId: number, cmd: UpdateOrderCommand) {
    return this.http.patch<OrderDetail>(`${this.base}/${orderId}/items`, cmd);
  }

  /** Pasa un pedido de mostrador de OPEN a COUNTER_DELIVERED. No se puede deshacer. */
  deliverAtCounter(orderId: number) {
    return this.http.post<void>(`${this.base}/${orderId}/deliver-at-counter`, {});
  }

  /** Pasa de OPEN a SENT_TO_BILLING. Desde ahí es inmutable. */
  sendToBilling(orderId: number) {
    return this.http.post<void>(`${this.base}/${orderId}/send-to-billing`, {});
  }

  /** Solo pedidos OPEN. Devuelve el stock y revierte las promociones. */
  cancel(orderId: number) {
    return this.http.post<void>(`${this.base}/${orderId}/cancel`, {});
  }

  /** Pedidos OPEN con bonificaciones sin stock respaldado. */
  pendingBonuses(branchId?: number) {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', String(branchId));
    return this.http.get<PendingBonusOrderView[]>(`${this.base}/pending-bonuses`, { params });
  }

  /**
   * Equivalente global (todo el tenant) de "mi liquidación del día", para
   * el admin — `order.view_all`. Sin pantalla propia todavía (base para una
   * futura vista); se deja disponible para reuso, p.ej. desde el dashboard.
   */
  dailySummary(date?: string) {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<GlobalDailyOrderSummaryView>(`${this.base}/daily-summary`, { params });
  }
}
