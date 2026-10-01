import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { ToastService } from '../../core/ui/toast';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { CreateAssignmentDialog } from './ui/create-assignment-dialog';
import { AssignmentAdminService } from './assignment-admin';
import { AssignmentAlertStore } from './assignment-alerts';
import { OrphanCustomerView } from '../../shared/models/assignment-admin.models';
import { dateTimeText } from './assignment-format';

/** Clientes activos sin vendedor asignado (GET /orphans), ordenados por antigüedad. */
@Component({
  selector: 'app-assignment-orphans',
  imports: [UiButton, UiTable, UiEmpty, AssignmentModuleTabs],
  template: `
    <app-assignment-module-tabs />
    <section class="orp-page">
      <div class="orp-head">
        <div>
          <h1>Clientes sin vendedor</h1>
          <p class="orp-sub">{{ countText() }}</p>
        </div>
        <div class="orp-head-actions">
          <button uiButton variant="secondary" (click)="viewOnMap()">Ver en mapa</button>
          <button
            uiButton
            variant="primary"
            [loading]="autoAssigning()"
            [disabled]="orphans().length === 0"
            (click)="runAutoAssign()"
          >
            Reparto automático
          </button>
        </div>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar los clientes huérfanos."
        [empty]="!loading() && !error() && orphans().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            title="No hay clientes sin vendedor"
            body="Todos los clientes activos tienen cartera asignada por ahora."
          />
        </div>

        <table class="ui-table-grid orp-table-desktop">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Código</th>
              <th>Dirección</th>
              <th>Teléfono</th>
              <th>Sin vendedor desde</th>
              <th>Ubicación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (c of orphans(); track c.customerId) {
              <tr>
                <td class="orp-cell-strong">{{ c.customerName }}</td>
                <td class="orp-muted">{{ c.code }}</td>
                <td class="orp-muted">{{ c.address || '—' }}</td>
                <td class="orp-muted">{{ c.phone || '—' }}</td>
                <td class="orp-muted">{{ dateTimeText(c.createdAt) }}</td>
                <td>
                  @if (c.latitude == null || c.longitude == null) {
                    <span class="orp-badge">Sin GPS</span>
                  } @else {
                    <span class="orp-muted">Con ubicación</span>
                  }
                </td>
                <td class="orp-row-action">
                  <button uiButton variant="secondary" size="sm" (click)="assign(c)">
                    Asignar
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="orp-cards-mobile">
          @for (c of orphans(); track c.customerId) {
            <div class="orp-card-mobile">
              <div class="orp-card-mobile-head">
                <span class="orp-card-mobile-name">{{ c.customerName }}</span>
                @if (c.latitude == null || c.longitude == null) {
                  <span class="orp-badge">Sin GPS</span>
                }
              </div>
              <div class="orp-muted">{{ c.code }} · {{ c.address || 'Sin dirección' }}</div>
              <div class="orp-muted">Sin vendedor desde {{ dateTimeText(c.createdAt) }}</div>
              <button
                uiButton
                variant="secondary"
                size="sm"
                class="orp-card-mobile-action"
                (click)="assign(c)"
              >
                Asignar
              </button>
            </div>
          }
        </div>
      </ui-table>
    </section>
  `,
  styles: [
    `
      .orp-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .orp-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .orp-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .orp-head-actions {
        display: flex;
        gap: 10px;
      }
      .orp-cell-strong {
        font-weight: 800;
      }
      .orp-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .orp-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-pendiente);
        white-space: nowrap;
      }
      .orp-row-action {
        text-align: right;
      }
      .orp-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .orp-page {
          padding: var(--sp-4);
        }
        .orp-table-desktop {
          display: none;
        }
        .orp-cards-mobile {
          display: grid;
          gap: 10px;
          margin-top: 8px;
        }
        .orp-card-mobile {
          display: grid;
          gap: 4px;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
        }
        .orp-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .orp-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .orp-card-mobile-action {
          margin-top: 6px;
          width: fit-content;
        }
      }
    `,
  ],
})
export class AssignmentOrphansPage {
  private assignmentSvc = inject(AssignmentAdminService);
  private alerts = inject(AssignmentAlertStore);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected dateTimeText = dateTimeText;

  protected orphans = signal<OrphanCustomerView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected autoAssigning = signal(false);

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.orphans().length;
    if (n === 0) return 'Sin clientes huérfanos.';
    return n === 1 ? '1 cliente sin vendedor' : `${n} clientes sin vendedor`;
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.assignmentSvc.orphans().subscribe({
      next: (list) => {
        this.orphans.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected viewOnMap() {
    this.router.navigate(['/asignaciones/mapa'], { queryParams: { orphansOnly: 'true' } });
  }

  protected assign(customer: OrphanCustomerView) {
    this.dialog
      .open(CreateAssignmentDialog, {
        data: {
          fixedCustomer: {
            id: customer.customerId,
            name: customer.customerName,
            code: customer.code,
          },
        },
        width: '520px',
      })
      .afterClosed()
      .subscribe((created) => {
        if (created) {
          this.load();
          this.alerts.refresh();
        }
      });
  }

  protected runAutoAssign() {
    const n = this.orphans().length;
    this.dialog
      .confirm({
        title: 'Reparto automático',
        message: `Esto asignará automáticamente los ${n} clientes huérfanos según menor carga actual. ¿Continuar?`,
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
            this.load();
            this.alerts.refresh();
          },
          error: () => this.autoAssigning.set(false),
        });
      });
  }
}
