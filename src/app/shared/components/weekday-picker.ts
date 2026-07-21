import { Component, model } from '@angular/core';

const DAYS = [
  { iso: 1, label: 'L' },
  { iso: 2, label: 'M' },
  { iso: 3, label: 'X' },
  { iso: 4, label: 'J' },
  { iso: 5, label: 'V' },
  { iso: 6, label: 'S' },
  { iso: 7, label: 'D' },
];

/** Selector de días de la semana (ISO 1=lun..7=dom). Two-way: [(value)]. */
@Component({
  selector: 'app-weekday-picker',
  template: `
    <div class="wd">
      @for (d of days; track d.iso) {
        <button
          type="button"
          [class.on]="has(d.iso)"
          (click)="toggle(d.iso)"
          [attr.aria-pressed]="has(d.iso)"
        >
          {{ d.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .wd {
        display: flex;
        gap: 6px;
      }
      button {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        cursor: pointer;
        font: inherit;
        border: 1px solid var(--mat-sys-outline);
        background: transparent;
        color: var(--mat-sys-on-surface);
      }
      button.on {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        border-color: var(--mat-sys-primary);
      }
    `,
  ],
})
export class WeekdayPickerComponent {
  readonly value = model<number[]>([]);
  readonly days = DAYS;

  has(iso: number) {
    return this.value().includes(iso);
  }

  toggle(iso: number) {
    const set = new Set(this.value());
    set.has(iso) ? set.delete(iso) : set.add(iso);
    this.value.set([...set].sort((a, b) => a - b));
  }
}
