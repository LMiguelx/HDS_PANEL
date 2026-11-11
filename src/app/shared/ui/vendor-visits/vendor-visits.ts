import { Component, computed, input, model } from '@angular/core';
import { Observable } from 'rxjs';
import { UiTypeahead, UiLookupItem } from '../typeahead/typeahead';
import {
  CYCLE_WEEKS,
  WEEKDAYS,
  visitSummaryText,
} from '../../../features/customer-requests/request-format';

/**
 * "Vendedor y visitas" — extraído de la pestaña Creación de Aprobaciones
 * (doc 39) para reusarlo también en Nuevo cliente (doc 74, sección 2.3):
 * buscador de vendedor, chips de días L-D y chips de semanas del ciclo.
 * Dos vías con `[(vendor)]`/`[(weekdays)]`/`[(weeks)]`.
 */
@Component({
  selector: 'app-vendor-visits',
  imports: [UiTypeahead],
  template: `
    <div class="vv" [class.vv-disabled]="disabled()">
      <ui-typeahead
        label="Vendedor"
        [clearOnPick]="false"
        [disabled]="disabled()"
        [search]="search()"
        [selected]="vendor()"
        (selectedChange)="vendor.set($event)"
        [hint]="vendorHint()"
      />
      <div class="vv-chip-group">
        <span class="vv-label">Días de visita *</span>
        <div class="vv-chips">
          @for (day of weekdayOptions; track day.value) {
            <button
              type="button"
              class="vv-chip"
              [class.on]="weekdays().includes(day.value)"
              [disabled]="disabled()"
              (click)="toggleWeekday(day.value)"
            >
              {{ day.label }}
            </button>
          }
        </div>
      </div>
      <div class="vv-chip-group">
        <span class="vv-label">Semanas del ciclo</span>
        <div class="vv-chips">
          @for (week of weekOptions; track week.value) {
            <button
              type="button"
              class="vv-chip"
              [class.on]="weeks().includes(week.value)"
              [disabled]="disabled()"
              (click)="toggleWeek(week.value)"
            >
              {{ week.label }}
            </button>
          }
        </div>
      </div>
      @if (summary()) {
        <p class="vv-muted">{{ summary() }}</p>
      }
      @if (disabledHint()) {
        <p class="vv-muted">{{ disabledHint() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .vv {
        display: flex;
        flex-direction: column;
        gap: var(--sp-4);
      }
      .vv-disabled {
        opacity: 0.6;
      }
      .vv-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .vv-chip-group {
        display: grid;
        gap: var(--sp-2);
      }
      .vv-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-2);
      }
      .vv-chip {
        appearance: none;
        font-family: var(--font-sans);
        font-size: var(--fs-dense);
        font-weight: 800;
        cursor: pointer;
        border: 1px solid var(--divider);
        background: transparent;
        color: var(--ink);
        min-height: 36px;
        padding: 0 var(--sp-4);
        border-radius: var(--radius-control);
      }
      .vv-chip:hover:not(:disabled) {
        background: var(--faint);
      }
      .vv-chip:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
      .vv-chip.on {
        background: var(--accent-wash);
        border-color: var(--accent);
        color: var(--accent-ink);
      }
      .vv-muted {
        margin: 0;
        font-size: var(--fs-dense, 13px);
        color: var(--ink-muted);
      }
    `,
  ],
})
export class VendorVisits {
  search = input.required<(query: string) => Observable<UiLookupItem[]>>();
  disabled = input(false);
  vendorHint = input('');
  disabledHint = input('');

  vendor = model<UiLookupItem | null>(null);
  weekdays = model<number[]>([]);
  weeks = model<number[]>([]);

  protected weekdayOptions = WEEKDAYS;
  protected weekOptions = CYCLE_WEEKS;
  protected summary = computed(() => visitSummaryText(this.weekdays(), this.weeks()));

  protected toggleWeekday(value: number) {
    this.weekdays.update((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value].sort((a, b) => a - b),
    );
  }

  protected toggleWeek(value: number) {
    this.weeks.update((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value].sort((a, b) => a - b),
    );
  }
}
