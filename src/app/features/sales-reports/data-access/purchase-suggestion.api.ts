import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { PurchaseSuggestionReport } from '../domain/purchase-suggestion.models';

/**
 * "Sugerido de compra" — doc 94, sección 2.1. `brandId` sin enviar = solo
 * los productos que hay que pedir de todas las marcas; `coverageDays` sin
 * enviar = 15 (lo decide el backend).
 */
@Injectable({ providedIn: 'root' })
export class PurchaseSuggestionApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/logistics`;

  report(brandId?: number, coverageDays?: number) {
    let params = new HttpParams();
    if (brandId) params = params.set('brandId', brandId);
    if (coverageDays) params = params.set('coverageDays', coverageDays);
    return this.http.get<PurchaseSuggestionReport>(`${this.base}/purchase-suggestion`, {
      params,
    });
  }
}
