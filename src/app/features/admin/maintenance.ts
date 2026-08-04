import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialog } from '../../shared/components/confirm-dialog';
import { ToastService } from '../../core/ui/toast';
import { TenantService } from './tenant';
import { RecalculationResult } from '../../shared/models/tenant.models';

@Component({
  selector: 'app-maintenance',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <mat-card class="card">
      <h3>Recalcular métricas de compra</h3>
      <p class="muted">
        Dispara el recálculo que normalmente corre a las 2:30am. Alimenta el "sugerido" del vendedor
        y los segmentos automáticos. Puede tardar.
      </p>

      @if (running()) {
        <mat-progress-bar mode="indeterminate" />
        <p class="muted small">Recalculando…</p>
      } @else {
        <button mat-flat-button color="tertiary" (click)="recalculate()">
          <mat-icon>calculate</mat-icon> Recalcular métricas ahora
        </button>
      }

      @if (result(); as r) {
        <p class="ok">
          Listo: {{ r.metricRows }} filas de métricas y {{ r.summaryRows }} resúmenes actualizados.
        </p>
      }
    </mat-card>
  `,
  styles: [
    `
      .card {
        padding: var(--sp-5);
        margin-bottom: var(--sp-4);
        max-width: var(--card-w-sm);
      }
      h3 {
        margin: 0 0 8px;
        font-size: 1rem;
      }
      .small {
        font-size: 0.82rem;
      }
      .ok {
        margin-top: 12px;
        color: var(--st-delivered);
      }
    `,
  ],
})
export class MaintenancePage {
  private tenantSvc = inject(TenantService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly running = signal(false);
  readonly result = signal<RecalculationResult | null>(null);

  recalculate() {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Recalcular métricas',
          message: 'Se recalcularán las métricas de compra de todos los clientes. Puede tardar.',
          confirmText: 'Recalcular',
        },
        width: '420px',
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.running.set(true);
        this.result.set(null);
        this.tenantSvc.recalculateMetrics().subscribe({
          next: (r) => {
            this.running.set(false);
            this.result.set(r);
            this.toast.success('Métricas recalculadas');
          },
          error: () => this.running.set(false),
        });
      });
  }
}
