import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  BrandSalesReport,
  ProductSalesReport,
  SalespersonSettlementReport,
} from '../../shared/models/sales-report.models';

/** OrderReportController, /api/orders/reports. `order.view_all`. */
@Injectable({ providedIn: 'root' })
export class SalesReportAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/orders/reports`;

  /** from/to obligatorias — máximo 31 días. Un solo día: from === to. */
  salespersonSettlement(from: string, to: string) {
    return this.http.get<SalespersonSettlementReport>(`${this.base}/salesperson-settlement`, {
      params: { from, to },
    });
  }

  /** from/to obligatorias — máximo 366 días. */
  brandSales(brandId: number, from: string, to: string) {
    return this.http.get<BrandSalesReport>(`${this.base}/brand-sales`, {
      params: { brandId, from, to },
    });
  }

  productSales(productId: number, from: string, to: string, page = 0, size = 20) {
    let params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('page', page)
      .set('size', size);
    return this.http.get<ProductSalesReport>(`${this.base}/product-sales/${productId}`, { params });
  }
}
