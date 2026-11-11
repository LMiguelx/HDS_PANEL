import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { PageResponse } from '../../../shared/models/api.models';
import {
  BrandReceiptConfigRow,
  BrandReceiptContext,
  ChangeEquivalenceCommand,
  ChangeSeriesCommand,
  CreateEquivalenceCommand,
  CreateSeriesCommand,
  EquivalenceView,
  ProfileView,
  ReceiptBrandOption,
  ReceiptDetail,
  ReceiptListFilters,
  ReceiptSummary,
  SeriesView,
  UpdateReceiptCommand,
  UpsertProfileCommand,
} from '../domain/goods-receipt.models';

function params(obj: object): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== '') p = p.set(key, String(value));
  }
  return p;
}

/**
 * GoodsReceiptController, /api/goods-receipts — doc 58. Entregas leídas por
 * foto en la app de almacén: el panel las lista, revisa y configura el
 * perfil/equivalencias de cada marca. Nunca sube fotos ni mueve stock.
 */
@Injectable({ providedIn: 'root' })
export class GoodsReceiptsApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/goods-receipts`;

  /** `goods_receipt.view` o `goods_receipt.manage` — sección 6.1. */
  list(filters: ReceiptListFilters = {}) {
    return this.http.get<PageResponse<ReceiptSummary>>(this.base, { params: params(filters) });
  }

  /** Selector de marcas del filtro — sección 6.1. Trae todas, configuradas o no. */
  brandOptions() {
    return this.http.get<ReceiptBrandOption[]>(`${this.base}/brands`);
  }

  detail(receiptId: number) {
    return this.http.get<ReceiptDetail>(`${this.base}/${receiptId}`);
  }

  /** `goods_receipt.manage` o `goods_receipt.store` — sección 7.4. */
  update(receiptId: number, cmd: UpdateReceiptCommand) {
    return this.http.put<ReceiptDetail>(`${this.base}/${receiptId}`, cmd);
  }

  /** Sin body — sección 7.6. */
  confirm(receiptId: number) {
    return this.http.post<ReceiptDetail>(`${this.base}/${receiptId}/confirm`, {});
  }

  /** Sin body — sección 7.7. */
  cancel(receiptId: number) {
    return this.http.post<ReceiptDetail>(`${this.base}/${receiptId}/cancel`, {});
  }

  /** Productos de la marca para el selector de líneas — sección 7.5. */
  brandContext(brandId: number) {
    return this.http.get<BrandReceiptContext>(`${this.base}/brands/${brandId}/context`);
  }

  // ─────────────────────── Configuración por marca — sección 8 ───────────────────────

  /** `goods_receipt.config` o `goods_receipt.view` — sección 8.1. */
  configBrands() {
    return this.http.get<BrandReceiptConfigRow[]>(`${this.base}/config/brands`);
  }

  /** `goods_receipt.config` — sección 8.2. Crea el perfil si no existe. */
  upsertProfile(brandId: number, cmd: UpsertProfileCommand) {
    return this.http.put<ProfileView>(`${this.base}/config/brands/${brandId}/profile`, cmd);
  }

  /** `goods_receipt.config` o `goods_receipt.view` — sección 8.3. */
  equivalences(brandId: number, onlyActive = true) {
    return this.http.get<EquivalenceView[]>(`${this.base}/config/brands/${brandId}/equivalences`, {
      params: params({ onlyActive }),
    });
  }

  /** `goods_receipt.config` — sección 8.3. */
  createEquivalence(brandId: number, cmd: CreateEquivalenceCommand) {
    return this.http.post<EquivalenceView>(
      `${this.base}/config/brands/${brandId}/equivalences`,
      cmd,
    );
  }

  /** `goods_receipt.config` — sección 8.3. */
  changeEquivalenceProduct(equivalenceId: number, cmd: ChangeEquivalenceCommand) {
    return this.http.patch<EquivalenceView>(
      `${this.base}/config/equivalences/${equivalenceId}`,
      cmd,
    );
  }

  /** `goods_receipt.config` — sección 8.3. Sin body. */
  deactivateEquivalence(equivalenceId: number) {
    return this.http.post<EquivalenceView>(
      `${this.base}/config/equivalences/${equivalenceId}/deactivate`,
      {},
    );
  }

  // ─────────────────────── Series de documento — doc 72, sección 2.1 ───────────────────────

  /** `goods_receipt.config` o `.view`. */
  series(brandId: number, onlyActive = true) {
    return this.http.get<SeriesView[]>(`${this.base}/config/brands/${brandId}/series`, {
      params: params({ onlyActive }),
    });
  }

  /** `goods_receipt.config`. Si la serie existía desactivada, la reactiva. */
  createSeries(brandId: number, cmd: CreateSeriesCommand) {
    return this.http.post<SeriesView>(`${this.base}/config/brands/${brandId}/series`, cmd);
  }

  /** `goods_receipt.config`. */
  changeSeries(seriesId: number, cmd: ChangeSeriesCommand) {
    return this.http.patch<SeriesView>(`${this.base}/config/series/${seriesId}`, cmd);
  }

  /** `goods_receipt.config`. Sin body. */
  deactivateSeries(seriesId: number) {
    return this.http.post<SeriesView>(`${this.base}/config/series/${seriesId}/deactivate`, {});
  }

  /** `goods_receipt.config`. Sin body. */
  activateSeries(seriesId: number) {
    return this.http.post<SeriesView>(`${this.base}/config/series/${seriesId}/activate`, {});
  }
}
