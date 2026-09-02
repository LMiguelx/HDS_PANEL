import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiCard } from '../../shared/ui/card/card';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { AssignmentAlertStore } from './assignment-alerts';
import { AssignmentAdminService } from './assignment-admin';

/** Panel de inicio del módulo: alertas de un vistazo + accesos rápidos. */
@Component({
  selector: 'app-assignment-home',
  imports: [UiButton, UiCard, AssignmentModuleTabs],
  template: `
    <app-assignment-module-tabs />
    <section class="asg-home">
      <div class="asg-home-head">
        <h1>Asignaciones</h1>
        <p class="asg-home-sub">Cartera de clientes por vendedor, ausencias del día y cobertura.</p>
      </div>

      <div class="asg-alert-grid">
        <ui-card variant="work" [clickable]="true" (cardClick)="goTo('/asignaciones/huerfanos')">
          <div class="asg-alert-num" [class.asg-alert-zero]="alerts.orphansCount() === 0">
            {{ alerts.orphansCount() ?? '—' }}
          </div>
          <div class="asg-alert-label">Clientes sin vendedor</div>
          <div class="asg-alert-hint">Ver huérfanos y asignar</div>
        </ui-card>

        <ui-card variant="work" [clickable]="true" (cardClick)="goTo('/asignaciones/ausencias')">
          <div class="asg-alert-num" [class.asg-alert-zero]="alerts.absentVendorsCount() === 0">
            {{ alerts.absentVendorsCount() ?? '—' }}
          </div>
          <div class="asg-alert-label">Vendedores sin ruta hoy</div>
          <div class="asg-alert-hint">Ver ausencias y cubrir cartera</div>
        </ui-card>
      </div>

      <div class="asg-quick-actions">
        <button uiButton variant="primary" [loading]="autoAssigning()" (click)="runAutoAssign()">
          Reparto automático de huérfanos
        </button>
        <button uiButton variant="secondary" (click)="goTo('/asignaciones/listado')">
          Ver todas las asignaciones
        </button>
      </div>
    </section>
  `,
  styles: [
    `
      .asg-home {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .asg-home-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .asg-alert-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
        gap: 16px;
        margin-top: 28px;
      }
      .asg-alert-num {
        font-size: 42px;
        font-weight: 800;
        line-height: 1;
        font-variant-numeric: var(--tnum);
        color: var(--accent-ink);
      }
      .asg-alert-num.asg-alert-zero {
        color: var(--st-vigente);
      }
      .asg-alert-label {
        margin-top: 8px;
        font-weight: 800;
        color: var(--ink);
      }
      .asg-alert-hint {
        margin-top: 2px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .asg-quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 28px;
      }

      @media (max-width: 767px) {
        .asg-home {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class AssignmentHomePage {
  protected alerts = inject(AssignmentAlertStore);
  private assignmentSvc = inject(AssignmentAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected autoAssigning = signal(false);

  constructor() {
    this.alerts.refresh();
  }

  protected goTo(path: string) {
    this.router.navigateByUrl(path);
  }

  protected runAutoAssign() {
    const orphans = this.alerts.orphansCount() ?? 0;
    this.dialog
      .confirm({
        title: 'Reparto automático',
        message:
          orphans > 0
            ? `Esto asignará automáticamente los ${orphans} clientes huérfanos según menor carga actual. ¿Continuar?`
            : 'No hay clientes huérfanos en este momento. ¿Ejecutar igual el reparto automático?',
        confirmLabel: 'Repartir',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.autoAssigning.set(true);
        this.assignmentSvc.autoAssign().subscribe({
          next: (result) => {
            this.autoAssigning.set(false);
            this.toast.success(
              result?.assignedCount != null
                ? `Se asignaron ${result.assignedCount} clientes.`
                : 'Reparto automático ejecutado.',
            );
            this.alerts.refresh();
          },
          error: () => this.autoAssigning.set(false),
        });
      });
  }
}
