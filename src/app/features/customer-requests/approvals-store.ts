import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CustomerRequestAdminService } from './customer-request-admin';
import {
  CreationRequestSummary,
  FieldChangeGroupView,
  RequestView,
} from '../../shared/models/customer-request.models';

/**
 * Estado compartido de la pantalla Aprobaciones (doc 39, sección 4.5): las
 * tres listas se piden en paralelo al entrar y se vuelven a pedir al
 * refrescar. Las tres pestañas leen de acá en vez de pedir cada una lo
 * suyo, para que el refresco automático (sección 4.6) actualice las tres a
 * la vez sin que cada pestaña dispare su propia llamada.
 */
@Injectable({ providedIn: 'root' })
export class ApprovalsStore {
  private svc = inject(CustomerRequestAdminService);

  readonly creationRows = signal<CreationRequestSummary[]>([]);
  readonly fieldChangeGroups = signal<FieldChangeGroupView[]>([]);
  readonly closureRows = signal<RequestView[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly lastUpdated = signal<Date | null>(null);

  private loadedOnce = false;

  loadAll() {
    this.loading.set(true);
    if (!this.loadedOnce) this.error.set(false);
    forkJoin({
      creation: this.svc.pendingCreation({ page: 0, size: 100 }),
      fieldChange: this.svc.pendingFieldChange(),
      closure: this.svc.pendingClosure({ page: 0, size: 100 }),
    }).subscribe({
      next: ({ creation, fieldChange, closure }) => {
        this.creationRows.set(creation.content ?? []);
        this.fieldChangeGroups.set(fieldChange ?? []);
        this.closureRows.set(closure.content ?? []);
        this.loading.set(false);
        this.error.set(false);
        this.lastUpdated.set(new Date());
        this.loadedOnce = true;
      },
      error: () => {
        this.loading.set(false);
        // Un refresco que falla no borra lo que ya se ve (DESIGN.md 9): solo
        // bloquea la pantalla si todavía no se había cargado nada.
        if (!this.loadedOnce) this.error.set(true);
      },
    });
  }

  /** Cada 60 s mientras la pestaña del navegador esté visible (sección 4.6). */
  startAutoRefresh(destroyRef: DestroyRef) {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') this.loadAll();
    }, 60_000);
    destroyRef.onDestroy(() => clearInterval(id));
  }
}
