import { Component, inject, signal } from '@angular/core';
import { map } from 'rxjs/operators';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { LookupService, toUiLookup } from '../../promos/lookup';
import { CustomerRequestAdminService } from '../customer-request-admin';

export interface ApproveCreationDialogData {
  requestId: number;
  businessName: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

/**
 * Aprueba y materializa una solicitud de creación: hace falta el código de
 * cliente (obligatorio, máx 10). Vendedor y días son opcionales — si se
 * omiten, el cliente nace huérfano / con horario incompleto. `weeksOfCycle`
 * no forma parte de este comando (a diferencia de asignaciones), por eso no
 * se reutiliza `app-schedule-picker` acá.
 */
@Component({
  selector: 'app-approve-creation-dialog',
  imports: [UiButton, UiField, UiTypeahead],
  template: `
    <div class="acd">
      <h2 class="acd-title">Aprobar creación de cliente</h2>
      <p class="acd-sub">{{ data.businessName }}</p>

      <ui-field
        label="Código de cliente"
        [(value)]="customerCode"
        hint="Obligatorio, máximo 10 caracteres."
      />

      <ui-typeahead
        label="Vendedor (opcional)"
        [clearOnPick]="false"
        [search]="userSearch"
        [(selected)]="vendor"
      />

      <div class="acd-weekdays">
        <span class="acd-weekdays-label">Días de la semana (opcional)</span>
        <div class="acd-chips">
          @for (day of weekdays; track day.value) {
            <button
              type="button"
              class="acd-chip"
              [class.on]="weekdaysValue().includes(day.value)"
              (click)="toggleWeekday(day.value)"
            >
              {{ day.label }}
            </button>
          }
        </div>
      </div>

      @if (error()) {
        <div class="acd-error">{{ error() }}</div>
      }

      <div class="acd-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Aprobar y crear
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
      .acd {
        display: grid;
        gap: 16px;
      }
      .acd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .acd-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .acd-weekdays {
        display: grid;
        gap: 6px;
      }
      .acd-weekdays-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .acd-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .acd-chip {
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
      .acd-chip:hover {
        background: var(--faint);
      }
      .acd-chip.on {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--on-accent);
      }
      .acd-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .acd-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class ApproveCreationDialog {
  protected data = inject<ApproveCreationDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private lookupSvc = inject(LookupService);
  private requestSvc = inject(CustomerRequestAdminService);

  protected weekdays = WEEKDAYS;
  protected userSearch = (q: string) =>
    this.lookupSvc.users(q).pipe(map((items) => toUiLookup(items)));

  protected customerCode = signal('');
  protected vendor = signal<UiLookupItem | null>(null);
  protected weekdaysValue = signal<number[]>([]);
  protected saving = signal(false);
  protected error = signal('');

  protected toggleWeekday(value: number) {
    const current = this.weekdaysValue();
    this.weekdaysValue.set(
      current.includes(value)
        ? current.filter((d) => d !== value)
        : [...current, value].sort((a, b) => a - b),
    );
  }

  protected submit() {
    const customerCode = this.customerCode().trim();
    if (!customerCode || customerCode.length > 10) {
      this.error.set('El código es obligatorio y debe tener máximo 10 caracteres.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.requestSvc
      .approveCreation(this.data.requestId, {
        customerCode,
        userId: this.vendor()?.id,
        weekdays: this.weekdaysValue().length ? this.weekdaysValue() : undefined,
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
            detalle ? `No pudimos aprobar: ${detalle}` : 'No pudimos aprobar la solicitud.',
          );
        },
      });
  }
}
