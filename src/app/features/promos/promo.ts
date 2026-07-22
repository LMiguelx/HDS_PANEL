import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CreatePromoCommand,
  PromoCreatedResult,
  PromoDetail,
  PromoSummary,
  PromoTargets,
} from '../../shared/models/promo.models';

@Injectable({ providedIn: 'root' })
export class PromoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/promos`;

  current() {
    return this.http.get<PromoSummary[]>(`${this.base}/current`);
  }
  detail(id: number) {
    return this.http.get<PromoDetail>(`${this.base}/${id}`);
  }
  approve(id: number) {
    return this.http.post<void>(`${this.base}/${id}/approve`, {});
  }
  deactivate(id: number) {
    return this.http.post<void>(`${this.base}/${id}/deactivate`, {});
  }

  /** Crea la promo (nace apagada). */
  create(cmd: CreatePromoCommand) {
    return this.http.post<PromoCreatedResult>(this.base, cmd);
  }
  /** Apunta la promo a segmentos/clientes. */
  setTargets(id: number, targets: PromoTargets) {
    return this.http.put<void>(`${this.base}/${id}/targets`, targets);
  }
}
