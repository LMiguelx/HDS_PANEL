import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  ApplicationView,
  CreatePromoCommand,
  PendingChoiceView,
  PendingCountView,
  PromoDetail,
  PromoPageResponse,
  ResolveChoiceCommand,
  TargetReachView,
  TargetsCommand,
  UpdatePromoBasicsCommand,
  UpdatePromoCommand,
} from './promo.types';
import {
  PromoReachComparison,
  PromoReachOrderRow,
  PromoReachView,
  ReachChoiceStatus,
} from './promo-reach.models';

export interface ReachFilters {
  from?: string;
  to?: string;
  salespersonId?: number;
}

export interface ReachOrdersFilters extends ReachFilters {
  choiceStatus?: ReachChoiceStatus;
  page?: number;
  size?: number;
}

export interface ReachSummaryFilters {
  from?: string;
  to?: string;
  brandId?: number;
  name?: string;
}

export interface PromoListFilters {
  name?: string;
  status?: string;
  brandId?: number;
  channelId?: number;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class PromoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/promos`;

  list(filters: PromoListFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<PromoPageResponse>(this.base, { params });
  }

  detail(id: number) {
    return this.http.get<PromoDetail>(`${this.base}/${id}`);
  }

  update(id: number, cmd: UpdatePromoCommand) {
    return this.http.put<PromoDetail>(`${this.base}/${id}`, cmd);
  }

  /** Edición básica (nombre, fecha de fin, prioridad) — doc 44, sección 7.3. Siempre permitida. */
  updateBasics(id: number, cmd: UpdatePromoBasicsCommand) {
    return this.http.patch<PromoDetail>(`${this.base}/${id}/basics`, cmd);
  }

  remove(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Activa una promoción creada apagada. */
  approve(id: number) {
    return this.http.post<void>(`${this.base}/${id}/approve`, {});
  }

  deactivate(id: number) {
    return this.http.post<void>(`${this.base}/${id}/deactivate`, {});
  }

  /** Apunta la promo a segmentos/clientes. */
  setTargets(id: number, targets: TargetsCommand) {
    return this.http.put<void>(`${this.base}/${id}/targets`, targets);
  }

  /** Cuántos clientes alcanza un targeting antes de guardarlo. */
  previewTargets(targets: TargetsCommand) {
    return this.http.post<TargetReachView>(`${this.base}/targets/preview`, targets);
  }

  /** Crea la promo (nace apagada). */
  create(cmd: CreatePromoCommand) {
    return this.http.post<PromoDetail>(this.base, cmd);
  }

  pendingChoices() {
    return this.http.get<PendingChoiceView[]>(`${this.base}/pending-choices`);
  }

  pendingCount() {
    return this.http.get<PendingCountView>(`${this.base}/pending-choices/count`);
  }

  resolveChoice(promoApplicationId: number, cmd: ResolveChoiceCommand) {
    return this.http.post<void>(`${this.base}/pending-choices/${promoApplicationId}/resolve`, cmd);
  }

  /** No otorgar un premio pendiente — doc 47, sección 9.4. `promo.resolve_choice`. */
  declineChoice(promoApplicationId: number) {
    return this.http.post<void>(`${this.base}/pending-choices/${promoApplicationId}/decline`, {});
  }

  /** Qué promociones se aplicaron a un pedido — doc 30, sección 9.2. `order.view_all`. */
  applicationsByOrder(orderId: number) {
    return this.http.get<ApplicationView[]>(`${this.base}/applications/by-order/${orderId}`);
  }

  /** Resumen de alcance de una promoción — doc 47, sección 10.1. `promo.create`. */
  reach(promoId: number, filters: ReachFilters = {}) {
    return this.http.get<PromoReachView>(`${this.base}/${promoId}/reach`, {
      params: this.toParams(filters),
    });
  }

  /** Pedidos del alcance, paginados — doc 47, sección 10.2. `promo.create`. */
  reachOrders(promoId: number, filters: ReachOrdersFilters = {}) {
    return this.http.get<PageResponse<PromoReachOrderRow>>(`${this.base}/${promoId}/reach/orders`, {
      params: this.toParams(filters),
    });
  }

  /** Comparar promociones en un rango — doc 47, sección 11.1. `promo.create`. */
  reachSummary(filters: ReachSummaryFilters = {}) {
    return this.http.get<PromoReachComparison>(`${this.base}/reach-summary`, {
      params: this.toParams(filters),
    });
  }

  private toParams(filters: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
