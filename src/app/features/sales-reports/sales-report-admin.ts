import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  BrandSalesReport,
  ProductSalesReport,
  SalesStockReport,
  SalespersonSettlementReport,
} from '../../shared/models/sales-report.models';

/** OrderReportController, /api/orders/reports. `order.view_all`. */
@Injectable({ providedIn: 'root' })
export class SalesReportAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/orders/reports`;

  /** from/to obligatorias — máximo 31 días. Un solo día: from === to. */
  salespersonSettlement(from: string, to: string, originCode?: string) {
    let params = new HttpParams().set('from', from).set('to', to);
    if (originCode) params = params.set('originCode', originCode);
    return this.http.get<SalespersonSettlementReport>(`${this.base}/salesperson-settlement`, {
      params,
    });
  }

  /** from/to obligatorias — máximo 366 días. salespersonId filtra por quien vendió. */
  brandSales(brandId: number, from: string, to: string, salespersonId?: number) {
    let params = new HttpParams().set('brandId', brandId).set('from', from).set('to', to);
    if (salespersonId) params = params.set('salespersonId', salespersonId);
    return this.http.get<BrandSalesReport>(`${this.base}/brand-sales`, { params });
  }

  productSales(
    productId: number,
    from: string,
    to: string,
    page = 0,
    size = 20,
    salespersonId?: number,
  ) {
    let params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('page', page)
      .set('size', size);
    if (salespersonId) params = params.set('salespersonId', salespersonId);
    return this.http.get<ProductSalesReport>(`${this.base}/product-sales/${productId}`, { params });
  }

  /** from/to obligatorias — máximo 31 días. onlyIssues default true en el backend. */
  salesStock(warehouseId: number, from: string, to: string, onlyIssues?: boolean) {
    let params = new HttpParams().set('warehouseId', warehouseId).set('from', from).set('to', to);
    if (onlyIssues !== undefined) params = params.set('onlyIssues', String(onlyIssues));
    return this.http.get<SalesStockReport>(`${this.base}/sales-stock`, { params });
  }
}
