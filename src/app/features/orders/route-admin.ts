import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RouteView } from '../../shared/models/counter-order.models';
import { SKIP_ERROR_TOAST } from '../../core/http/error-interceptor';

/**
 * Jornada de mostrador (RouteController, /api/routes) — mismo mecanismo de
 * "ruta" del vendedor, sin ubicación. Sin ella no se pueden registrar
 * pedidos de mostrador. `order.manage`.
 */
@Injectable({ providedIn: 'root' })
export class RouteAdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/routes`;

  /**
   * Cualquier respuesta no exitosa se trata como "sin jornada" (sección 6
   * del doc) y la pantalla ya lo explica con su propia tarjeta — se omite
   * el toast genérico de error para no duplicar el aviso.
   */
  today() {
    return this.http.get<RouteView>(`${this.base}/today`, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  /** El body es obligatorio aunque vaya vacío: el panel no envía ubicación. */
  start() {
    return this.http.post<RouteView>(`${this.base}/start`, {});
  }

  end() {
    return this.http.post<RouteView>(`${this.base}/end`, {});
  }
}
