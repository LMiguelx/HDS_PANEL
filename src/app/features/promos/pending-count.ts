import { Injectable, inject, signal } from '@angular/core';
import { PromoService } from './promo';

/**
 * Conteo de premios pendientes de elección, compartido entre el badge del
 * menú (shell) y la bandeja de pendientes, para que resolver un premio
 * actualice el número en ambos sitios sin recargar la página.
 */
@Injectable({ providedIn: 'root' })
export class PendingCountStore {
  private promoSvc = inject(PromoService);

  readonly count = signal<number | null>(null);

  refresh() {
    this.promoSvc.pendingCount().subscribe({
      next: (v) => this.count.set(v.pending ?? 0),
      error: () => this.count.set(null),
    });
  }
}
