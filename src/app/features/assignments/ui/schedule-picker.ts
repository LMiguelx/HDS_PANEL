import { Component, input, model } from '@angular/core';

const WEEKDAYS: { value: number; label: string; fullName: string }[] = [
  { value: 1, label: 'L', fullName: 'Lunes' },
  { value: 2, label: 'M', fullName: 'Martes' },
  { value: 3, label: 'M', fullName: 'Miércoles' },
  { value: 4, label: 'J', fullName: 'Jueves' },
  { value: 5, label: 'V', fullName: 'Viernes' },
  { value: 6, label: 'S', fullName: 'Sábado' },
  { value: 7, label: 'D', fullName: 'Domingo' },
];

const CYCLE_WEEKS: number[] = [1, 2, 3, 4];

/**
 * Selector de días de la semana (ISO 1-7) y semanas del ciclo (1-4) como
 * chips, para el horario de una asignación. Días y semanas son obligatorios
 * (doc 33, sección 0): el llamador decide cuándo mostrar `weekdaysError`/
 * `weeksError` (p. ej. al intentar guardar sin marcar ninguno).
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
            [title]="day.fullName"
            [attr.aria-label]="day.fullName"
            (click)="toggleWeekday(day.value)"
          >
            {{ day.label }}
          </button>
        }
      </div>
      @if (weekdaysError()) {
        <span class="sched-error">{{ weekdaysError() }}</span>
      }
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
        <button type="button" class="sched-chip sched-chip-all" (click)="selectAllWeeks()">
          Todas
        </button>
      </div>
      @if (weeksError()) {
        <span class="sched-error">{{ weeksError() }}</span>
      }
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
      .sched-chip-all {
        color: var(--ink-muted);
        border-style: dashed;
      }
      .sched-error {
        font-size: 12px;
        font-weight: 600;
        color: var(--st-vencida, #d13b3b);
      }
    `,
  ],
})
export class SchedulePicker {
  protected weekdays = WEEKDAYS;
  protected cycleWeeks = CYCLE_WEEKS;

  weekdaysValue = model<number[]>([]);
  weeksOfCycleValue = model<number[]>([]);
  weekdaysError = input('');
  weeksError = input('');

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

  protected selectAllWeeks() {
    this.weeksOfCycleValue.set([...this.cycleWeeks]);
  }
}
