import { Injectable, inject, signal } from '@angular/core';
import { DeliveryAdminService } from './delivery-admin';
import { ReturnReasonView } from '../../shared/models/delivery.models';

/**
 * Catálogo de motivos de devolución (GET /return-reasons), cacheado: se pide
 * una sola vez al primer uso del módulo de devoluciones y se reutiliza en
 * cualquier filtro — nunca se hardcodea el catálogo en el frontend.
 */
@Injectable({ providedIn: 'root' })
export class ReturnReasonStore {
  private deliverySvc = inject(DeliveryAdminService);
  private requested = false;

  readonly reasons = signal<ReturnReasonView[]>([]);

  ensureLoaded() {
    if (this.requested) return;
    this.requested = true;
    this.deliverySvc.returnReasons().subscribe({
      next: (list) => this.reasons.set(list),
      error: () => (this.requested = false), // permite reintentar si falló
    });
  }
}
