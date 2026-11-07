import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  BatchResolutionResult,
  OrderDetail,
  PendingBonusInboxView,
  ResolvePendingBonusBatchCommand,
  ResolvePendingBonusesCommand,
  SubstituteCandidateView,
} from '../../shared/models/order.models';

/**
 * OrderController, /api/orders/pending-bonuses — bandeja de bonificaciones
 * sin stock, búsqueda de sustitutos y resolución de una o varias a la vez
 * (doc 51, secciones 5 a 8). `order.manage`.
 */
@Injectable({ providedIn: 'root' })
export class PendingBonusAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/orders/pending-bonuses`;

  /** Última sede elegida en la bandeja — se recuerda mientras dure la sesión (doc 51, sección 5.3). */
  lastBranchId = signal<number | null>(null);

  inbox(branchId?: number | null) {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', String(branchId));
    return this.http.get<PendingBonusInboxView>(`${this.base}/inbox`, { params });
  }

  substitutes(opts: {
    q?: string;
    branchId?: number | null;
    minStock?: number | null;
    excludeOrderId?: number | null;
    limit?: number;
  }) {
    let params = new HttpParams();
    if (opts.q) params = params.set('q', opts.q);
    if (opts.branchId) params = params.set('branchId', String(opts.branchId));
    if (opts.minStock != null) params = params.set('minStock', String(opts.minStock));
    if (opts.excludeOrderId) params = params.set('excludeOrderId', String(opts.excludeOrderId));
    if (opts.limit) params = params.set('limit', String(opts.limit));
    return this.http.get<SubstituteCandidateView[]>(`${this.base}/substitutes`, { params });
  }

  /** Resuelve una o varias bonificaciones pendientes de UN pedido abierto — doc 51, sección 7.1. */
  resolve(orderId: number, cmd: ResolvePendingBonusesCommand) {
    return this.http.post<OrderDetail>(
      `${environment.apiUrl}/orders/${orderId}/pending-bonuses/resolve`,
      cmd,
    );
  }

  /** Misma decisión para varios pedidos de un mismo grupo — doc 51, sección 8.1. */
  resolveBatch(cmd: ResolvePendingBonusBatchCommand) {
    return this.http.post<BatchResolutionResult>(`${this.base}/resolve-batch`, cmd);
  }
}
