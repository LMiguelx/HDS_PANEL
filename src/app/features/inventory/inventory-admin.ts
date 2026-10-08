import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  BulkStockAdjustmentCommand,
  BulkStockAdjustmentResult,
  CreateStockAdvancesCommand,
  CreateStockAdvancesResult,
  KardexResponse,
  ProcessUploadsResult,
  ReleaseStockAdvanceCommand,
  StockAdvanceListFilters,
  StockAdvanceView,
  StockReconciliationDetail,
  StockReconciliationListFilters,
  StockReconciliationSummary,
  StockReconciliationView,
  WarehouseStockResponse,
  WarehouseView,
} from '../../shared/models/inventory.models';

function paramsFrom(filters: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

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

  /** stock.advance */
  createStockAdvances(cmd: CreateStockAdvancesCommand) {
    return this.http.post<CreateStockAdvancesResult>(`${this.base}/stock-advances`, cmd);
  }

  /** stock.advance o report.view */
  stockAdvances(filters: StockAdvanceListFilters = {}) {
    return this.http.get<PageResponse<StockAdvanceView>>(`${this.base}/stock-advances`, {
      params: paramsFrom({ onlyOpen: true, ...filters }),
    });
  }

  /** stock.advance — mismo endpoint para reducir (con quantity) y anular (sin quantity). */
  releaseStockAdvance(advanceId: number, cmd: ReleaseStockAdvanceCommand) {
    return this.http.post<StockAdvanceView>(
      `${this.base}/stock-advances/${advanceId}/release`,
      cmd,
    );
  }

  /** stock.advance o report.view */
  reconciliationSummary(params: { warehouseId?: number; from?: string; to?: string } = {}) {
    return this.http.get<StockReconciliationSummary>(`${this.base}/stock-reconciliations/summary`, {
      params: paramsFrom(params),
    });
  }

  /** stock.advance o report.view */
  reconciliations(filters: StockReconciliationListFilters = {}) {
    return this.http.get<PageResponse<StockReconciliationView>>(
      `${this.base}/stock-reconciliations`,
      { params: paramsFrom(filters) },
    );
  }

  /** stock.advance o report.view */
  reconciliationDetail(uploadId: number) {
    return this.http.get<StockReconciliationDetail>(
      `${this.base}/stock-reconciliations/${uploadId}`,
    );
  }

  /** stock.advance */
  retryReconciliation(uploadId: number) {
    return this.http.post<StockReconciliationView>(
      `${this.base}/stock-reconciliations/${uploadId}/retry`,
      {},
    );
  }

  /** stock.advance */
  processReconciliations() {
    return this.http.post<ProcessUploadsResult>(`${this.base}/stock-reconciliations/process`, {});
  }
}
