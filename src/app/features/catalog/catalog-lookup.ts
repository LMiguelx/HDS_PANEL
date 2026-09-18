import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BrandView, FamilyView, PaymentConditionView } from '../../shared/models/catalog.models';
import { WarehouseView } from '../../shared/models/inventory.models';

/**
 * Datos de referencia sin permiso especial (cualquier autenticado) — marcas,
 * familias y condiciones de pago para poblar selectores de Catálogo/Precios.
 * `warehouses()` es la única excepción real: GET /inventory/warehouses pide
 * report.view o config.edit, pero es obligatorio para el listado de
 * productos (trae el stock real) — se pide igual y se deja que el propio
 * endpoint devuelva error si el usuario no califica.
 */
@Injectable({ providedIn: 'root' })
export class CatalogLookupService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  brands() {
    return this.http.get<BrandView[]>(`${this.api}/catalog/brands`);
  }

  families(brandId?: number) {
    let params = new HttpParams();
    if (brandId) params = params.set('brandId', String(brandId));
    return this.http.get<FamilyView[]>(`${this.api}/catalog/families`, { params });
  }

  paymentConditions() {
    return this.http.get<PaymentConditionView[]>(`${this.api}/catalog/payment-conditions`);
  }

  warehouses() {
    return this.http.get<WarehouseView[]>(`${this.api}/inventory/warehouses`);
  }
}
