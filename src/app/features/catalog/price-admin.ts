import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PriceResolved, PriceView, UpsertPriceCommand } from '../../shared/models/price.models';

/** PriceController, /api/prices. Lectura requiere `price.view`, upsert/delete `price.edit`. */
@Injectable({ providedIn: 'root' })
export class PriceAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/prices`;

  byProduct(productId: number) {
    return this.http.get<PriceView[]>(`${this.base}/by-product/${productId}`);
  }

  resolve(productId: number, paymentConditionId: number, customerTypeId: number, quantity: number) {
    return this.http.get<PriceResolved>(`${this.base}/resolve`, {
      params: { productId, paymentConditionId, customerTypeId, quantity },
    });
  }

  /** Upsert por clave natural (producto + condición de pago + tipo de cliente + cantidad mínima). */
  upsert(cmd: UpsertPriceCommand) {
    return this.http.put<PriceView>(this.base, cmd);
  }

  remove(priceId: number) {
    return this.http.delete<void>(`${this.base}/${priceId}`);
  }
}
