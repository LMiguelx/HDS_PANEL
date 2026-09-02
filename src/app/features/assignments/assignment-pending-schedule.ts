import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { ScheduleDialog } from './ui/schedule-dialog';
import { AssignmentAdminService } from './assignment-admin';
import { IncompleteScheduleView } from '../../shared/models/assignment-admin.models';
import { resolveNames } from './assignment-format';

/**
 * Asignaciones vigentes con weekdays y/o weeksOfCycle sin completar — el
 * motivo por el que un cliente asignado igual no aparece en ningún DayPlan.
 * No confundir con huérfanos: acá el cliente sí tiene vendedor, le falta el
 * horario.
 */
@Component({
  selector: 'app-assignment-pending-schedule',
  imports: [UiButton, UiTable, UiEmpty, AssignmentModuleTabs],
  template: `
    <app-assignment-module-tabs />
    <section class="aps-page">
      <div class="aps-head">
        <h1>Horario incompleto</h1>
        <p class="aps-sub">{{ countText() }}</p>
      </div>

      <ui-table
        [loading]="loading()"
        [error]="error()"
        errorMessage="No pudimos cargar el horario pendiente."
        [empty]="!loading() && !error() && items().length === 0"
        (retry)="load()"
      >
        <div empty>
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            title="Todas las asignaciones tienen horario completo"
            body="No hay clientes asignados esperando días o semanas de ciclo."
          />
        </div>

        <table class="ui-table-grid aps-table-desktop">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Le falta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of items(); track item.assignmentId) {
              <tr>
                <td class="aps-cell-strong">{{ item.customerName }}</td>
                <td>{{ vendorName(item.userId) }}</td>
                <td class="aps-muted">{{ missingText(item) }}</td>
                <td class="aps-row-action">
                  <button uiButton variant="secondary" size="sm" (click)="complete(item)">
                    Completar horario
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="aps-cards-mobile">
          @for (item of items(); track item.assignmentId) {
            <div class="aps-card-mobile">
              <div class="aps-card-mobile-name">{{ item.customerName }}</div>
              <div class="aps-muted">Vendedor: {{ vendorName(item.userId) }}</div>
              <div class="aps-muted">Le falta: {{ missingText(item) }}</div>
              <button
                uiButton
                variant="secondary"
                size="sm"
                class="aps-card-mobile-action"
                (click)="complete(item)"
              >
                Completar horario
              </button>
            </div>
          }
        </div>
      </ui-table>
    </section>
  `,
  styles: [
    `
      .aps-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .aps-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .aps-cell-strong {
        font-weight: 800;
      }
      .aps-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .aps-row-action {
        text-align: right;
      }
      .aps-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .aps-page {
          padding: var(--sp-4);
        }
        .aps-table-desktop {
          display: none;
        }
        .aps-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .aps-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .aps-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
        .aps-card-mobile-action {
          margin-top: 6px;
          width: fit-content;
        }
      }
    `,
  ],
})
export class AssignmentPendingSchedulePage {
  private assignmentSvc = inject(AssignmentAdminService);
  private dialog = inject(UiDialogService);

  protected items = signal<IncompleteScheduleView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  private vendorNames = signal<Map<number, string>>(new Map());

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.items().length;
    if (n === 0) return 'Sin pendientes.';
    return n === 1
      ? '1 asignación con horario incompleto'
      : `${n} asignaciones con horario incompleto`;
  }

  protected vendorName(id: number): string {
    return this.vendorNames().get(id) ?? `Vendedor #${id}`;
  }

  protected missingText(item: IncompleteScheduleView): string {
    const missing: string[] = [];
    if (!item.hasWeekdays) missing.push('días de la semana');
    if (!item.hasWeeksOfCycle) missing.push('semanas del ciclo');
    return missing.join(' y ') || '—';
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.assignmentSvc.pendingSchedule().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
        // El DTO no trae userName (solo customerName) — se resuelve con el
        // mismo truco de GET /map que usa el listado general.
        const userIds = items.map((i) => i.userId);
        if (userIds.length > 0) {
          resolveNames(this.assignmentSvc, userIds).subscribe(({ vendors }) =>
            this.vendorNames.set(vendors),
          );
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected complete(item: IncompleteScheduleView) {
    this.dialog
      .open(ScheduleDialog, {
        data: {
          assignmentId: item.assignmentId,
          customerName: item.customerName,
          weekdays: [],
          weeksOfCycle: [],
        },
        width: '480px',
      })
      .afterClosed()
      .subscribe((saved) => saved && this.load());
  }
}
