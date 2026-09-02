import { Component, model } from '@angular/core';

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

const CYCLE_WEEKS: number[] = [1, 2, 3, 4];

/**
 * Selector de días de la semana (ISO 1-7) y semanas del ciclo (1-4) como
 * chips, para crear/completar el horario de una asignación. Ambos son
 * opcionales: dejarlos vacíos es una asignación con horario incompleto
 * (aparece en hasGap / pending-schedule) — el control lo permite a propósito.
 */
@Component({
  selector: 'app-schedule-picker',
  template: `
    <div class="sched-group">
      <span class="sched-label">Días de la semana</span>
      <div class="sched-chips">
        @for (day of weekdays; track day.value) {
          <button
            type="button"
            class="sched-chip"
            [class.on]="weekdaysValue().includes(day.value)"
            (click)="toggleWeekday(day.value)"
          >
            {{ day.label }}
          </button>
        }
      </div>
      <span class="sched-hint">Sin días marcados = horario incompleto por ahora.</span>
    </div>

    <div class="sched-group">
      <span class="sched-label">Semanas del ciclo</span>
      <div class="sched-chips">
        @for (week of cycleWeeks; track week) {
          <button
            type="button"
            class="sched-chip"
            [class.on]="weeksOfCycleValue().includes(week)"
            (click)="toggleWeek(week)"
          >
            Semana {{ week }}
          </button>
        }
      </div>
      <span class="sched-hint">Sin semanas marcadas = aplica todas las semanas del ciclo.</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: grid;
        gap: 16px;
      }
      .sched-group {
        display: grid;
        gap: 6px;
      }
      .sched-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .sched-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .sched-chip {
        appearance: none;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        border: 1px solid var(--divider);
        background: transparent;
        color: var(--ink);
        min-height: 36px;
        padding: 0 14px;
      }
      .sched-chip:hover {
        background: var(--faint);
      }
      .sched-chip.on {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--on-accent);
      }
      .sched-hint {
        font-size: 12px;
        color: var(--ink-muted);
      }
    `,
  ],
})
export class SchedulePicker {
  protected weekdays = WEEKDAYS;
  protected cycleWeeks = CYCLE_WEEKS;

  weekdaysValue = model<number[]>([]);
  weeksOfCycleValue = model<number[]>([]);

  protected toggleWeekday(value: number) {
    const current = this.weekdaysValue();
    this.weekdaysValue.set(
      current.includes(value)
        ? current.filter((d) => d !== value)
        : [...current, value].sort((a, b) => a - b),
    );
  }

  protected toggleWeek(value: number) {
    const current = this.weeksOfCycleValue();
    this.weeksOfCycleValue.set(
      current.includes(value)
        ? current.filter((w) => w !== value)
        : [...current, value].sort((a, b) => a - b),
    );
  }
}
