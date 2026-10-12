import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { AssignmentModuleTabs } from './ui/module-tabs';
import { ScheduleDialog } from './ui/schedule-dialog';
import { AssignmentAdminService } from './assignment-admin';
import { IncompleteScheduleView } from '../../shared/models/assignment-admin.models';

/**
 * Asignaciones vigentes con weekdays y/o weeksOfCycle sin completar — el
 * motivo por el que un cliente asignado igual no aparece en ningún DayPlan.
 * No confundir con huérfanos: acá el cliente sí tiene vendedor, le falta el
 * horario. Pagina sin total (SliceResponse/hasNext): es una cola de trabajo
 * que se encoge mientras el supervisor la resuelve.
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
      <p class="aps-banner">
        Estos clientes no aparecen en la ruta de ningún vendedor hasta que completes su horario.
      </p>

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
                <td class="aps-cell-strong">
                  {{ item.customerName }}
                  <div class="aps-muted">{{ item.customerCode }}</div>
                </td>
                <td>{{ item.userName }}</td>
                <td class="aps-muted">
                  @if (!item.hasWeekdays) {
                    <span class="aps-badge">Faltan días</span>
                  }
                  @if (!item.hasWeeksOfCycle) {
                    <span class="aps-badge">Faltan semanas</span>
                  }
                </td>
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
              <div class="aps-muted">{{ item.customerCode }} · Vendedor: {{ item.userName }}</div>
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

      @if (!loading() && !error() && items().length > 0) {
        <div class="aps-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="aps-pager-label">Página {{ page() + 1 }}</span>
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="!hasNext()"
            (click)="nextPage()"
          >
            Siguiente
          </button>
        </div>
      }
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
      .aps-banner {
        margin: 16px 0 0;
        padding: 12px 16px;
        border: 1px solid var(--hairline);
        background: var(--faint);
        font-size: 13px;
        color: var(--ink-muted);
      }
      .aps-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 800;
        color: var(--st-pendiente);
        white-space: nowrap;
        margin-right: 8px;
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
      .aps-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .aps-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
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
  protected page = signal(0);
  protected hasNext = signal(false);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  protected countText(): string {
    const n = this.items().length;
    if (n === 0) return 'Sin pendientes en esta página.';
    return n === 1
      ? '1 asignación con horario incompleto'
      : `${n} asignaciones con horario incompleto`;
  }

  protected missingText(item: IncompleteScheduleView): string {
    const missing: string[] = [];
    if (!item.hasWeekdays) missing.push('días de la semana');
    if (!item.hasWeeksOfCycle) missing.push('semanas del ciclo');
    return missing.join(' y ') || '—';
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.load();
  }
  protected nextPage() {
    if (!this.hasNext()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.assignmentSvc.pendingSchedule({ page: this.page(), size: 20 }).subscribe({
      next: (result) => {
        this.items.set(result.content ?? []);
        this.hasNext.set(result.hasNext);
        this.loading.set(false);
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
      .subscribe((saved) => {
        // Al completar una fila, la página actual puede quedar corta —
        // recargar la misma página trae el siguiente pendiente hacia arriba.
        if (saved) this.load();
      });
  }
}
