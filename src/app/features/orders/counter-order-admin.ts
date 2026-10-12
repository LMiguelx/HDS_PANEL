import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CounterCustomerContext,
  CreateCounterOrderCommand,
  OrderCreatedResult,
  SuggestedItem,
} from '../../shared/models/counter-order.models';

export interface ForgottenProductView {
  productId: number;
  productName: string;
  lastPurchasedAt: string | null;
}

export interface TopFamilyView {
  familyId: number;
  familyName: string;
  quantity: number;
}

export interface PurchaseConfidenceView {
  probabilityPercent: number;
  text: string;
}

/**
 * Pedido de mostrador (OrderController, /api/orders/counter y sugerido/
 * predicción) — doc 30, secciones 7.2, 7.6 y 7.9. `order.manage` (sugerido
 * y predicción admiten también `order.create`, para el vendedor en su app).
 */
@Injectable({ providedIn: 'root' })
export class CounterOrderAdminService {
  private http = inject(HttpClient);
  private ordersBase = `${environment.apiUrl}/orders`;
  private predictionBase = `${environment.apiUrl}/prediction/customers`;

  customerContext(customerId: number) {
    return this.http.get<CounterCustomerContext>(
      `${this.ordersBase}/counter/customers/${customerId}`,
    );
  }

  create(cmd: CreateCounterOrderCommand) {
    return this.http.post<OrderCreatedResult>(`${this.ordersBase}/counter`, cmd);
  }

  suggested(customerId: number, limit = 15) {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<SuggestedItem[]>(`${this.ordersBase}/suggested/${customerId}`, { params });
  }

  forgottenProducts(customerId: number, top = 10, months = 6) {
    const params = new HttpParams().set('top', top).set('months', months);
    return this.http.get<ForgottenProductView[]>(
      `${this.predictionBase}/${customerId}/forgotten-products`,
      { params },
    );
  }

  topFamilies(customerId: number, top = 5, months = 6) {
    const params = new HttpParams().set('top', top).set('months', months);
    return this.http.get<TopFamilyView[]>(`${this.predictionBase}/${customerId}/top-families`, {
      params,
    });
  }

  purchaseConfidence(customerId: number) {
    return this.http.get<PurchaseConfidenceView>(
      `${this.predictionBase}/${customerId}/purchase-confidence`,
    );
  }
}
