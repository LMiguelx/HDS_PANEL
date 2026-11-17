import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BrandCountBoardRow, StockCountDetailResponse } from './domain/stock-count.models';

/**
 * StockCountController, /api/stock-counts — doc 82, sección 6. Solo
 * lectura: ni cuenta, ni toma marcas, ni libera ni finaliza.
 */
@Injectable({ providedIn: 'root' })
export class StockCountAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/stock-counts`;

  /** `report.view` (o `inventory.count`). */
  board(warehouseId: number) {
    return this.http.get<BrandCountBoardRow[]>(`${this.base}/board`, {
      params: { warehouseId: String(warehouseId) },
    });
  }

  /** `report.view` (o `inventory.count`). */
  detail(stockCountId: number) {
    return this.http.get<StockCountDetailResponse>(`${this.base}/${stockCountId}`);
  }
}
