import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
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

  /** Qué promociones se aplicaron a un pedido — doc 30, sección 9.2. `order.view_all`. */
  applicationsByOrder(orderId: number) {
    return this.http.get<ApplicationView[]>(`${this.base}/applications/by-order/${orderId}`);
  }
}
