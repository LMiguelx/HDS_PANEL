import { Injectable, signal } from '@angular/core';

/**
 * Un 503 de mantenimiento (doc 38, sección 4.7/10.4) no es un error de
 * pantalla: bloquea toda la app con una página propia, sin cerrar la
 * sesión. `errorInterceptor` escribe acá; el shell lee este signal para
 * decidir si muestra su layout normal o el bloqueo de pantalla completa.
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceBlockState {
  readonly reason = signal<string | null>(null);

  block(reason: string | null) {
    this.reason.set(reason || 'Mantenimiento activo.');
  }

  clear() {
    this.reason.set(null);
  }
}
