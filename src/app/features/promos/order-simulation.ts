import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  MobilePromoCatalogView,
  OrderSimulationView,
  SimulateOrderCommand,
} from '../../shared/models/promo-simulation.models';

/**
 * OrderSimulationController — promociones disponibles de un cliente y
 * simulación de pedido (precio + promos + bonificaciones, sin guardar
 * nada). `order.manage`. Ver doc 30, secciones 7.7 y 10; sobre de promos
 * disponibles — doc 49, sección 9.
 */
@Injectable({ providedIn: 'root' })
export class OrderSimulationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/promos`;

  /** `featuredOnly` por defecto `false`: en mostrador se ven todas (doc 49, sección 9.1). */
  available(customerId: number, salesChannelId: number, featuredOnly = false) {
    let params = new HttpParams()
      .set('customerId', customerId)
      .set('salesChannelId', salesChannelId);
    if (featuredOnly) params = params.set('featuredOnly', true);
    return this.http.get<MobilePromoCatalogView>(`${this.base}/available`, { params });
  }

  simulateOrder(cmd: SimulateOrderCommand) {
    return this.http.post<OrderSimulationView>(`${this.base}/simulate-order`, cmd);
  }
}
