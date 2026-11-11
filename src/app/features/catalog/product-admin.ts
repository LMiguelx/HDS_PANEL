import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../shared/models/api.models';
import {
  CreateProductCommand,
  ProductCreatedResult,
  ProductListFilters,
  ProductView,
  UpdateProductCommand,
} from '../../shared/models/catalog.models';

/**
 * Lectura (GET) sin permiso especial; alta/edición/activación requieren
 * `product.edit` (ProductController, /api/catalog/products).
 */
@Injectable({ providedIn: 'root' })
export class ProductAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/catalog/products`;

  private paramsFrom(filters: ProductListFilters): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  list(filters: ProductListFilters) {
    return this.http.get<PageResponse<ProductView>>(this.base, {
      params: this.paramsFrom(filters),
    });
  }

  detail(productId: number, warehouseId: number) {
    return this.http.get<ProductView>(`${this.base}/${productId}`, {
      params: { warehouseId },
    });
  }

  /** Productos activos sin ninguna fila de precio configurada. */
  withoutPrices(warehouseId: number, page = 0, size = 20) {
    return this.http.get<PageResponse<ProductView>>(`${this.base}/without-prices`, {
      params: { warehouseId, page, size },
    });
  }

  create(cmd: CreateProductCommand) {
    return this.http.post<ProductCreatedResult>(this.base, cmd);
  }

  update(productId: number, cmd: UpdateProductCommand) {
    return this.http.patch<void>(`${this.base}/${productId}`, cmd);
  }

  activate(productId: number) {
    return this.http.post<void>(`${this.base}/${productId}/activate`, {});
  }

  deactivate(productId: number) {
    return this.http.post<void>(`${this.base}/${productId}/deactivate`, {});
  }
}
