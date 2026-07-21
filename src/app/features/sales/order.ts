import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  CreateOrderCommand,
  OrderCreatedResult,
  OrderDetail,
  OrderSummary,
  SuggestedItem,
} from '../../shared/models/order.models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/orders`;

  /** Todos los pedidos (supervisión, order.view_all). */
  all(page = 0, size = 20, status?: string, customerId?: number) {
    const params: Record<string, string | number> = { page, size };
    if (status) params['status'] = status;
    if (customerId) params['customerId'] = customerId;
    return this.http.get<PageResponse<OrderSummary>>(this.base, { params });
  }

  detail(id: number) {
    return this.http.get<OrderDetail>(`${this.base}/${id}`);
  }

  create(cmd: CreateOrderCommand) {
    return this.http.post<OrderCreatedResult>(this.base, cmd);
  }

  suggested(customerId: number) {
    return this.http.get<SuggestedItem[]>(`${this.base}/suggested/${customerId}`);
  }

  sendToBilling(id: number) {
    return this.http.post<void>(`${this.base}/${id}/send-to-billing`, {});
  }

  cancel(id: number) {
    return this.http.post<void>(`${this.base}/${id}/cancel`, {});
  }
}
