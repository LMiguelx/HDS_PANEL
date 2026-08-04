import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  Brand,
  CustomerType,
  DocumentType,
  Family,
  PaymentCondition,
  Product,
  SalesChannel,
} from '../../shared/models/catalog.models';

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
  documentTypes() {
    return this.http.get<DocumentType[]>(`${this.base}/document-types`);
  }
  customerTypes() {
    return this.http.get<CustomerType[]>(`${this.base}/customer-types`);
  }
  salesChannels() {
    return this.http.get<SalesChannel[]>(`${this.base}/sales-channels`);
  }
}
