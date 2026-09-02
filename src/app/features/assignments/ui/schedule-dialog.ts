import { Component, inject, signal } from '@angular/core';
import { UiButton } from '../../../shared/ui/button/button';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { AssignmentAdminService } from '../assignment-admin';
import { SchedulePicker } from './schedule-picker';

export interface ScheduleDialogData {
  assignmentId: number;
  customerName: string;
  weekdays: number[];
  weeksOfCycle: number[];
}

/**
 * Completa o edita `weekdays`/`weeksOfCycle` de una asignación vigente
 * (`PATCH /api/admin/assignments/{id}/schedule`). Se abre desde el listado
 * y desde "Horario incompleto".
 */
@Component({
  selector: 'app-schedule-dialog',
  imports: [UiButton, SchedulePicker],
  template: `
    <div class="sd">
      <h2 class="sd-title">Horario de la asignación</h2>
      <p class="sd-sub">{{ data.customerName }}</p>

      <app-schedule-picker [(weekdaysValue)]="weekdays" [(weeksOfCycleValue)]="weeksOfCycle" />

      @if (error()) {
        <div class="sd-error">{{ error() }}</div>
      }

      <div class="sd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Guardar horario
        </button>
      </div>
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px;',
  },
  styles: [
    `
      .sd {
        display: grid;
        gap: 16px;
      }
      .sd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .sd-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .sd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .sd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class ScheduleDialog {
  protected data = inject<ScheduleDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private assignmentSvc = inject(AssignmentAdminService);

  protected weekdays = signal<number[]>([...this.data.weekdays]);
  protected weeksOfCycle = signal<number[]>([...this.data.weeksOfCycle]);
  protected saving = signal(false);
  protected error = signal('');

  protected submit() {
    this.saving.set(true);
    this.error.set('');
    this.assignmentSvc
      .updateSchedule(this.data.assignmentId, {
        weekdays: this.weekdays(),
        weeksOfCycle: this.weeksOfCycle(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.ref.close(true);
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(
            detalle
              ? `No pudimos guardar el horario: ${detalle}`
              : 'No pudimos guardar el horario.',
          );
        },
      });
  }
}
