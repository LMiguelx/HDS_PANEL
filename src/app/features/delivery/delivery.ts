import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  BatchDetail,
  BatchSummary,
  CreateBatchCommand,
  CreateReturnCommand,
  MarkItemCommand,
  ReturnReasonView,
  ReturnView,
} from '../../shared/models/delivery.models';

@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/deliveries`;

  batches(date: string, page = 0, size = 20) {
    return this.http.get<PageResponse<BatchSummary>>(`${this.base}/batches`, {
      params: { date, page, size },
    });
  }
  batch(id: number) {
    return this.http.get<BatchDetail>(`${this.base}/batches/${id}`);
  }
  createBatch(cmd: CreateBatchCommand) {
    return this.http.post<BatchDetail>(`${this.base}/batches`, cmd);
  }

  // ── Ciclo de la planilla ──
  startRoute(id: number) {
    return this.http.post<void>(`${this.base}/batches/${id}/start-route`, {});
  }
  markItem(id: number, cmd: MarkItemCommand) {
    return this.http.post<void>(`${this.base}/batches/${id}/items/mark`, cmd);
  }
  settle(id: number) {
    return this.http.post<void>(`${this.base}/batches/${id}/settle`, {});
  }

  // ── Devoluciones ──
  returnReasons() {
    return this.http.get<ReturnReasonView[]>(`${this.base}/return-reasons`);
  }
  createReturn(cmd: CreateReturnCommand) {
    return this.http.post<void>(`${this.base}/returns`, cmd);
  }
  returnsByInvoice(invoiceId: string) {
    return this.http.get<ReturnView[]>(`${this.base}/returns/by-invoice/${invoiceId}`);
  }
}
