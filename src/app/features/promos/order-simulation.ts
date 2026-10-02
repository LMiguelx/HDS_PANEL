import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MobilePromoView } from '../../shared/models/promo-simulation.models';
import {
  OrderSimulationView,
  SimulateOrderCommand,
} from '../../shared/models/promo-simulation.models';

/**
 * OrderSimulationController — promociones disponibles de un cliente y
 * simulación de pedido (precio + promos + bonificaciones, sin guardar
 * nada). `order.manage`. Ver doc 30, secciones 7.7 y 10.
 */
@Injectable({ providedIn: 'root' })
export class OrderSimulationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/promos`;

  available(customerId: number, salesChannelId: number) {
    const params = new HttpParams()
      .set('customerId', customerId)
      .set('salesChannelId', salesChannelId);
    return this.http.get<MobilePromoView[]>(`${this.base}/available`, { params });
  }

  simulateOrder(cmd: SimulateOrderCommand) {
    return this.http.post<OrderSimulationView>(`${this.base}/simulate-order`, cmd);
  }
}
