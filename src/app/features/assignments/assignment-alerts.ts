import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AssignmentAdminService } from './assignment-admin';

/**
 * Conteo de alertas (huérfanos + vendedores sin ruta hoy), compartido entre
 * el badge del menú (shell) y el panel de inicio del módulo — mismo patrón
 * que PendingCountStore en Promociones.
 */
@Injectable({ providedIn: 'root' })
export class AssignmentAlertStore {
  private assignmentSvc = inject(AssignmentAdminService);

  readonly orphansCount = signal<number | null>(null);
  readonly absentVendorsCount = signal<number | null>(null);
  readonly count = signal<number | null>(null);

  refresh() {
    forkJoin({
      orphans: this.assignmentSvc.orphans(),
      absentVendors: this.assignmentSvc.vendorsWithoutRouteToday(),
    }).subscribe({
      next: ({ orphans, absentVendors }) => {
        this.orphansCount.set(orphans.length);
        this.absentVendorsCount.set(absentVendors.length);
        this.count.set(orphans.length + absentVendors.length);
      },
      error: () => {
        this.orphansCount.set(null);
        this.absentVendorsCount.set(null);
        this.count.set(null);
      },
    });
  }
}
