import { Injectable, inject, signal } from '@angular/core';
import { RouteAdminService } from './route-admin';
import { RouteView } from '../../shared/models/counter-order.models';

/**
 * Estado de la jornada de mostrador del supervisor, compartido entre el
 * indicador del shell y Nuevo pedido — sección 6 del doc 30. GET /today
 * responde error si no hay jornada abierta: cualquier respuesta no exitosa
 * se trata como "sin jornada" (null), no como error de carga.
 */
@Injectable({ providedIn: 'root' })
export class RouteStore {
  private routeSvc = inject(RouteAdminService);

  readonly route = signal<RouteView | null>(null);
  readonly loading = signal(true);
  readonly starting = signal(false);
  readonly ending = signal(false);

  refresh() {
    this.loading.set(true);
    this.routeSvc.today().subscribe({
      next: (r) => {
        this.route.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.route.set(null);
        this.loading.set(false);
      },
    });
  }

  start() {
    this.starting.set(true);
    this.routeSvc.start().subscribe({
      next: (r) => {
        this.route.set(r);
        this.starting.set(false);
      },
      error: () => {
        this.starting.set(false);
        this.refresh();
      },
    });
  }

  end() {
    this.ending.set(true);
    this.routeSvc.end().subscribe({
      next: (r) => {
        this.route.set(r);
        this.ending.set(false);
      },
      error: () => {
        this.ending.set(false);
        this.refresh();
      },
    });
  }
}
