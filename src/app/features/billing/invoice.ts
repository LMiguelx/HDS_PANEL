import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  AutoMatchResult,
  ImportResult,
  InvoiceDetail,
  InvoiceSummary,
  MatchCommand,
  PromoApplicationView,
} from '../../shared/models/invoice.models';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/invoices`;

  unmatched(page = 0, size = 20) {
    return this.http.get<PageResponse<InvoiceSummary>>(`${this.base}/unmatched`, {
      params: { page, size },
    });
  }
  detail(invoiceId: string) {
    return this.http.get<InvoiceDetail>(`${this.base}/${encodeURIComponent(invoiceId)}`);
  }
  byCustomer(customerId: number) {
    return this.http.get<InvoiceSummary[]>(`${this.base}/by-customer/${customerId}`);
  }

  /** Facturas conciliadas sin planilla asignada, para armar un batch (delivery.settle). */
  readyForBatch(branchId?: number, issueDate?: string, page = 0, size = 50) {
    const params: Record<string, string | number> = { page, size };
    if (branchId) params['branchId'] = branchId;
    if (issueDate) params['issueDate'] = issueDate;
    return this.http.get<PageResponse<InvoiceSummary>>(`${this.base}/ready-for-batch`, {
      params,
    });
  }

  /** Importa un lote de facturas del ERP (product.sync). Idempotente. */
  importInvoices(payload: unknown) {
    return this.http.post<ImportResult>(`${this.base}/import`, payload);
  }
  /** Conciliación automática (invoice.reconcile). */
  autoMatch() {
    return this.http.post<AutoMatchResult>(`${this.base}/auto-match`, {});
  }

  match(invoiceId: string, cmd: MatchCommand) {
    return this.http.post<void>(`${this.base}/${encodeURIComponent(invoiceId)}/match`, cmd);
  }
  mismatch(invoiceId: string) {
    return this.http.post<void>(`${this.base}/${encodeURIComponent(invoiceId)}/mismatch`, {});
  }
  unmatch(invoiceId: string) {
    return this.http.post<void>(`${this.base}/${encodeURIComponent(invoiceId)}/unmatch`, {});
  }

  /** Bonificaciones que el motor aplicó al pedido, para cotejar contra la factura. */
  promoApplications(orderId: number) {
    return this.http.get<PromoApplicationView[]>(
      `${environment.apiUrl}/promos/applications/by-order/${orderId}`,
    );
  }
}
