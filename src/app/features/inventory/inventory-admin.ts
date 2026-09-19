import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  BulkStockAdjustmentCommand,
  BulkStockAdjustmentResult,
  KardexResponse,
  WarehouseStockResponse,
  WarehouseView,
} from '../../shared/models/inventory.models';

/**
 * InventoryController, /api/inventory. `warehouses()` sirve como selector
 * para todos los flujos que lo necesitan (kardex, stock por almacén, ajuste
 * masivo, catálogo de productos) — se pide una sola vez y se reusa.
 */
@Injectable({ providedIn: 'root' })
export class InventoryAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/inventory`;

  warehouses() {
    return this.http.get<WarehouseView[]>(`${this.base}/warehouses`);
  }

  /** report.view */
  kardex(productId: number, warehouseId: number, page = 0, size = 50) {
    return this.http.get<KardexResponse>(`${this.base}/kardex/${productId}`, {
      params: { warehouseId, page, size },
    });
  }

  /** report.view — sin paginar, foto completa del almacén. */
  warehouseStock(warehouseId: number) {
    return this.http.get<WarehouseStockResponse>(`${this.base}/warehouses/${warehouseId}/stock`);
  }

  /** config.edit — sirve tanto para 1 línea como para carga masiva. */
  bulkStockAdjustment(cmd: BulkStockAdjustmentCommand) {
    return this.http.post<BulkStockAdjustmentResult>(`${this.base}/stock-adjustments`, cmd);
  }
}
