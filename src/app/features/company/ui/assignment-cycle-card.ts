import { Component, computed, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UiCard } from '../../../shared/ui/card/card';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UiStepper, UiStep } from '../../../shared/ui/stepper/stepper';
import { UiDialogService } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { CompanyAdminService } from '../company-admin';
import { CycleInfoView } from '../../../shared/models/assignment-cycle.models';
import { dateText } from '../../assignments/assignment-format';
import { CycleAnchorDialog } from './cycle-anchor-dialog';

/** Tarjeta "Ciclo de asignaciones" — doc 65, sección 3.3. `config.edit`. */
@Component({
  selector: 'app-assignment-cycle-card',
  imports: [UiButton, UiCard, UiEmpty, UiStepper],
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

        <ui-stepper [steps]="steps()" />

        <div class="acc-kv">
          <div class="acc-kv-item">
            <span class="acc-kv-label">Ciclo actual</span>
            <span class="acc-kv-value"
              >{{ dateText(i.cycleStartDate) }} – {{ dateText(i.cycleEndDate) }}</span
            >
          </div>
          <div class="acc-kv-item">
            <span class="acc-kv-label">Fecha ancla</span>
            <span class="acc-kv-value">{{ dateText(i.anchorDate) }}</span>
          </div>
        </div>

        <div class="acc-anchor-row">
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
      .acc-kv {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--sp-4) var(--sp-5);
      }
      .acc-kv-item {
        display: grid;
        gap: 2px;
      }
      .acc-kv-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
        font-weight: 800;
      }
      .acc-kv-value {
        font-size: var(--fs-body);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .acc-anchor-row {
        display: flex;
        justify-content: flex-start;
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

  protected steps = computed<UiStep[]>(() => {
    const current = this.info()?.currentWeekOfCycle ?? 1;
    return [1, 2, 3, 4].map((week) => ({
      label: `Semana ${week}`,
      state: week < current ? 'complete' : week === current ? 'current' : 'upcoming',
    }));
  });

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
