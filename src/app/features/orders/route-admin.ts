import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RouteView } from '../../shared/models/counter-order.models';

/**
 * Jornada de mostrador (RouteController, /api/routes) — mismo mecanismo de
 * "ruta" del vendedor, sin ubicación. Sin ella no se pueden registrar
 * pedidos de mostrador. `order.manage`.
 */
@Injectable({ providedIn: 'root' })
export class RouteAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/routes`;

  /** Cualquier respuesta no exitosa se trata como "sin jornada" (sección 6 del doc). */
  today() {
    return this.http.get<RouteView>(`${this.base}/today`);
  }

  /** El body es obligatorio aunque vaya vacío: el panel no envía ubicación. */
  start() {
    return this.http.post<RouteView>(`${this.base}/start`, {});
  }

  end() {
    return this.http.post<RouteView>(`${this.base}/end`, {});
  }
}
