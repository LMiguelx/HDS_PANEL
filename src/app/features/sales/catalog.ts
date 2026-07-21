import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import { Brand, Family, PaymentCondition, Product } from '../../shared/models/catalog.models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/catalog`;

  products(query = '', page = 0, size = 20, familyId?: number) {
    const params: Record<string, string | number> = { page, size };
    if (query) params['query'] = query;
    if (familyId) params['familyId'] = familyId;
    return this.http.get<PageResponse<Product>>(`${this.base}/products`, { params });
  }

  paymentConditions() {
    return this.http.get<PaymentCondition[]>(`${this.base}/payment-conditions`);
  }
  families() {
    return this.http.get<Family[]>(`${this.base}/families`);
  }
  brands() {
    return this.http.get<Brand[]>(`${this.base}/brands`);
  }
}
