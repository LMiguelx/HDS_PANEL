import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PriceRow, UpsertPriceCommand } from '../../shared/models/price.models';

// Puede venir número u objeto → el componente lo maneja de forma defensiva.
export interface PriceResolution {
  unitPrice: number;
}

@Injectable({ providedIn: 'root' })
export class PriceAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/prices`;

  byProduct(productId: number) {
    return this.http.get<PriceRow[]>(`${this.base}/by-product/${productId}`);
  }
  upsert(cmd: UpsertPriceCommand) {
    return this.http.put<PriceRow>(this.base, cmd);
  }
  remove(priceId: number) {
    return this.http.delete<void>(`${this.base}/${priceId}`);
  }
  resolve(productId: number, paymentConditionId: number, customerTypeId: number, quantity: number) {
    return this.http.get<PriceResolution | number>(`${this.base}/resolve`, {
      params: { productId, paymentConditionId, customerTypeId, quantity },
    });
  }
}
