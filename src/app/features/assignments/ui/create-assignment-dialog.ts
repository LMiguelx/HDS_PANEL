import { Component, inject, signal } from '@angular/core';
import { map } from 'rxjs/operators';
import { UiButton } from '../../../shared/ui/button/button';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { LookupService, toUiLookup } from '../../promos/lookup';
import { AssignmentAdminService } from '../assignment-admin';
import { SchedulePicker } from './schedule-picker';

export interface CreateAssignmentDialogData {
  /** Cuando viene de un huérfano ya elegido, el cliente queda fijo (no editable). */
  fixedCustomer?: { id: number; name: string; code?: string | null };
}

/**
 * Asignación manual de un cliente a un vendedor (`POST /api/admin/assignments`).
 * Se abre desde el listado (cliente libre) o desde Huérfanos (cliente fijo).
 * Siempre empieza hoy — no se elige fecha (sección 5.2 del doc): si el
 * cliente ya tenía vendedor, esa asignación se cierra sola con fecha de ayer.
 */
@Component({
  selector: 'app-create-assignment-dialog',
  imports: [UiButton, UiTypeahead, SchedulePicker],
  template: `
    <div class="cad">
      <h2 class="cad-title">Asignar cliente a vendedor</h2>

      @if (data.fixedCustomer; as customer) {
        <div class="cad-fixed-customer">
          <span class="cad-fixed-label">Cliente</span>
          <span class="cad-fixed-value">
            {{ customer.name }}
            @if (customer.code) {
              <span class="cad-fixed-code">· {{ customer.code }}</span>
            }
          </span>
        </div>
      } @else {
        <ui-typeahead
          label="Cliente — busca por nombre"
          [clearOnPick]="false"
          [search]="customerSearch"
          [selected]="customer()"
          (picked)="customer.set($event)"
        />
      }

      <ui-typeahead
        label="Vendedor — busca por nombre"
        [clearOnPick]="false"
        [search]="userSearch"
        [selected]="vendor()"
        (picked)="vendor.set($event)"
      />

      <p class="cad-hint">
        El cliente pasa a este vendedor desde hoy. Si tenía otro, deja de estar en su cartera.
      </p>

      <app-schedule-picker [(weekdaysValue)]="weekdays" [(weeksOfCycleValue)]="weeksOfCycle" />

      @if (error()) {
        <div class="cad-error">{{ error() }}</div>
      }

      <div class="cad-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Guardar asignación
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
      .cad {
        display: grid;
        gap: 16px;
      }
      .cad-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .cad-fixed-customer {
        display: grid;
        gap: 4px;
        border: 1px solid var(--hairline);
        background: var(--faint);
        padding: 12px 14px;
      }
      .cad-fixed-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        color: var(--ink-muted);
      }
      .cad-fixed-value {
        font-weight: 800;
        color: var(--ink);
      }
      .cad-fixed-code {
        font-weight: 400;
        color: var(--ink-muted);
      }
      .cad-hint {
        margin: 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .cad-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .cad-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class CreateAssignmentDialog {
  protected data = inject<CreateAssignmentDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private lookupSvc = inject(LookupService);
  private assignmentSvc = inject(AssignmentAdminService);

  protected customer = signal<UiLookupItem | null>(null);
  protected vendor = signal<UiLookupItem | null>(null);
  protected weekdays = signal<number[]>([]);
  protected weeksOfCycle = signal<number[]>([]);
  protected saving = signal(false);
  protected error = signal('');
  private warnedGap = signal(false);

  protected customerSearch = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));
  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  protected submit() {
    const customerId = this.data.fixedCustomer?.id ?? this.customer()?.id;
    const userId = this.vendor()?.id;
    if (!customerId || !userId) {
      this.error.set('Completa cliente y vendedor.');
      return;
    }
    if ((this.weekdays().length === 0 || this.weeksOfCycle().length === 0) && !this.warnedGap()) {
      this.warnedGap.set(true);
      this.error.set(
        'Sin días o sin semanas, el cliente no aparecerá en ningún plan hasta que completes el horario. Presiona "Guardar asignación" de nuevo para confirmar.',
      );
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.assignmentSvc
      .create({
        customerId,
        userId,
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
            detalle ? `No pudimos guardar: ${detalle}` : 'No pudimos guardar la asignación.',
          );
        },
      });
  }
}
