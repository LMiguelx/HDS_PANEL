import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiCard } from '../../../shared/ui/card/card';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { CompanyAdminService } from '../company-admin';
import { CycleInfoView } from '../../../shared/models/assignment-cycle.models';
import { dateText } from '../../assignments/assignment-format';
import { CycleAnchorDialog } from './cycle-anchor-dialog';

/** Tarjeta "Ciclo de asignaciones" — doc 65, sección 3.3. `config.edit`. */
@Component({
  selector: 'app-assignment-cycle-card',
  imports: [UiButton, UiCard, UiEmpty],
  template: `
    <ui-card title="Ciclo de asignaciones" class="sys-card">
      <p class="sys-help">Las visitas se programan en un ciclo de 4 semanas.</p>

      @if (loading() && !info()) {
        <div class="sys-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error() && !info()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el ciclo de asignaciones"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (info(); as i) {
        <div class="acc-week">
          <span class="acc-week-label">Semana {{ i.currentWeekOfCycle }} de 4</span>
          <span class="acc-week-range"
            >{{ dateText(i.weekStartDate) }} – {{ dateText(i.weekEndDate) }}</span
          >
        </div>

        <div class="acc-strip">
          @for (w of [1, 2, 3, 4]; track w) {
            <span class="acc-segment" [class.acc-segment-on]="w === i.currentWeekOfCycle">{{
              w
            }}</span>
          }
          <span class="acc-cycle-range"
            >Ciclo actual: {{ dateText(i.cycleStartDate) }} – {{ dateText(i.cycleEndDate) }}</span
          >
        </div>

        <div class="acc-anchor-row">
          <span class="sys-meta">Fecha ancla: {{ dateText(i.anchorDate) }}</span>
          <button uiButton variant="secondary" size="sm" (click)="openChangeAnchor()">
            Cambiar fecha ancla
          </button>
        </div>
      }
    </ui-card>
  `,
  styles: [
    `
      .acc-week {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .acc-week-label {
        font-size: 22px;
        font-weight: 800;
        color: var(--ink);
      }
      .acc-week-range {
        font-size: var(--fs-dense);
        color: var(--ink-muted);
      }
      .acc-strip {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .acc-segment {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 1px solid var(--divider);
        color: var(--ink-muted);
        font-weight: 700;
        font-size: 13px;
        border-radius: var(--radius-control);
      }
      .acc-segment-on {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--bg);
      }
      .acc-cycle-range {
        margin-left: 10px;
        font-size: var(--fs-dense);
        color: var(--ink-muted);
      }
      .acc-anchor-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-top: var(--sp-2);
        border-top: 1px solid var(--hairline);
      }
    `,
  ],
})
export class AssignmentCycleCard {
  private companySvc = inject(CompanyAdminService);
  private dialog = inject(UiDialogService);
  private toast = inject(ToastService);

  protected dateText = dateText;

  protected info = signal<CycleInfoView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.companySvc.cycleInfo().subscribe({
      next: (i) => {
        this.info.set(i);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected openChangeAnchor() {
    this.dialog
      .open<CycleAnchorDialog, void, boolean>(CycleAnchorDialog, { width: '480px' })
      .afterClosed()
      .subscribe((applied) => {
        if (!applied) return;
        this.toast.success('Fecha ancla actualizada.');
        this.load();
      });
  }
}
