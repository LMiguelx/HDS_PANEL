import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LookupItem } from './promo.types';
import { UiLookupItem } from '../../shared/ui/typeahead/typeahead';

/** `LookupItem` (campos opcionales, tal como los genera la API) → `UiLookupItem` (id requerido, forma del componente). */
export function toUiLookup(items: LookupItem[], extraInfo?: string): UiLookupItem[] {
  return items.map((i) => ({ id: i.id!, code: i.code, name: i.name ?? '', extraInfo: extraInfo ?? i.extraInfo, recent: i.recent }));
}

/**
 * Búsquedas por nombre (nunca por código) que alimentan los `ui-typeahead`
 * del módulo: producto, familia, marca, cliente, segmento, vendedor.
 */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/lookup`;

  private get(path: string, params: Record<string, string | number | boolean | undefined> = {}) {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') httpParams = httpParams.set(key, String(value));
    }
    return this.http.get<LookupItem[]>(`${this.base}/${path}`, { params: httpParams });
  }

  products(q: string, opts: { brandId?: number; limit?: number } = {}): Observable<LookupItem[]> {
    return this.get('products', { q, ...opts });
  }
  families(q: string, opts: { brandId?: number; limit?: number } = {}): Observable<LookupItem[]> {
    return this.get('families', { q, ...opts });
  }
  brands(q = '', opts: { limit?: number } = {}): Observable<LookupItem[]> {
    return this.get('brands', { q, ...opts });
  }
  customers(q: string, opts: { limit?: number } = {}): Observable<LookupItem[]> {
    return this.get('customers', { q, ...opts });
  }
  segments(q: string, opts: { limit?: number } = {}): Observable<LookupItem[]> {
    return this.get('segments', { q, ...opts });
  }
  users(q: string, opts: { role?: string; limit?: number } = {}): Observable<LookupItem[]> {
    return this.get('users', { q, ...opts });
  }
  salesChannels(): Observable<LookupItem[]> {
    return this.get('sales-channels');
  }
}
