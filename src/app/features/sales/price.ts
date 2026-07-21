import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PriceResolution {
  unitPrice: number;
}

@Injectable({ providedIn: 'root' })
export class PriceService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/prices`;

  resolve(productId: number, paymentConditionId: number, customerTypeId: number, quantity: number) {
    return this.http.get<PriceResolution | number>(`${this.base}/resolve`, {
      params: { productId, paymentConditionId, customerTypeId, quantity },
    });
  }
}
