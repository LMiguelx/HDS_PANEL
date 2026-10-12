import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BrandView,
  CustomerTypeView,
  FamilyView,
  PaymentConditionView,
} from '../../shared/models/catalog.models';
import { WarehouseView } from '../../shared/models/inventory.models';
import { cacheForSession } from '../../shared/utils/cache-for-session';

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

  private customerTypesCache$: Observable<CustomerTypeView[]> | null = null;

  /**
   * Catálogo global de tipos de cliente — nuevo, doc 38 sección 4.1. Es
   * igual para todas las empresas y cambia muy poco: se memoriza para el
   * resto de la sesión en vez de pedirlo en cada diálogo de precio.
   */
  customerTypes(): Observable<CustomerTypeView[]> {
    this.customerTypesCache$ ??= cacheForSession(
      this.http.get<CustomerTypeView[]>(`${this.api}/catalog/customer-types`),
    );
    return this.customerTypesCache$;
  }

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
