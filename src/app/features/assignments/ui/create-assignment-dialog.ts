import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { map } from 'rxjs/operators';
import { UiButton } from '../../../shared/ui/button/button';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { LookupService, toUiLookup } from '../../promos/lookup';
import { CustomerService } from '../../customers/customer';
import { AssignmentAdminService } from '../assignment-admin';
import { SchedulePicker } from './schedule-picker';
import { CustomerSalesAssignment } from '../../../shared/models/customer.models';
import {
  dateText,
  scheduleSummaryText,
  weekdaysText,
  weeksOfCycleText,
} from '../assignment-format';

export interface CreateAssignmentDialogData {
  /** Cuando viene de una fila/ficha ya elegida, el cliente queda fijo (no editable). */
  fixedCustomer?: { id: number; name: string; code?: string | null };
}

type AssignCase = 'assign' | 'replace' | 'same';

/**
 * Asignación manual de un cliente a un vendedor (`POST /api/admin/assignments`)
 * — doc 33, sección 6. Se abre desde el listado (cliente libre), desde
 * "Cambiar vendedor" de una fila o desde la ficha del cliente (cliente fijo
 * en ambos casos). Siempre empieza hoy — no se elige fecha.
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

      @if (effectiveCustomerId()) {
        <div class="cad-situation">
          <span class="cad-situation-label">Situación actual</span>
          @if (situationLoading()) {
            <span class="cad-muted">Cargando…</span>
          } @else if (currentAssignment(); as ca) {
            <span class="cad-situation-value"
              >{{ ca.salespersonCode }} {{ ca.salespersonName }} · desde
              {{ dateText(ca.effectiveFrom) }}</span
            >
            <span class="cad-muted">
              @if (!ca.weekdays.length || !ca.weeksOfCycle.length) {
                {{ weekdaysText(ca.weekdays) }} · {{ weeksOfCycleText(ca.weeksOfCycle) }} ·
                <span class="cad-warn">horario incompleto</span>
              } @else {
                {{ scheduleSummaryText(ca.weekdays, ca.weeksOfCycle) }}
              }
            </span>
          } @else {
            <span class="cad-muted">Sin vendedor asignado</span>
          }
        </div>
      }

      <ui-typeahead
        label="Vendedor nuevo"
        [clearOnPick]="false"
        [search]="userSearch"
        [selected]="vendor()"
        (picked)="vendor.set($event)"
      />

      <app-schedule-picker
        [(weekdaysValue)]="weekdays"
        [(weeksOfCycleValue)]="weeksOfCycle"
        [weekdaysError]="weekdaysError()"
        [weeksError]="weeksError()"
      />

      @if (assignCase() === 'replace' && currentAssignment(); as ca) {
        <div class="cad-banner cad-banner-warn">
          Desde hoy este cliente deja la cartera de {{ ca.salespersonName }} y pasa a
          {{ vendor()?.name }}.
        </div>
      } @else if (assignCase() === 'same') {
        <div class="cad-banner">Ya es su vendedor: solo se actualizará el horario.</div>
      }

      @if (error()) {
        <div class="cad-error">{{ error() }}</div>
      }

      <div class="cad-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button
          uiButton
          variant="primary"
          [disabled]="!canSubmit()"
          [loading]="saving()"
          (click)="submit()"
        >
          {{ submitLabel() }}
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
      .cad-situation {
        display: grid;
        gap: 4px;
        border: 1px solid var(--hairline);
        padding: 12px 14px;
      }
      .cad-situation-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        color: var(--ink-muted);
      }
      .cad-situation-value {
        font-weight: 700;
        color: var(--ink);
        font-size: 14px;
      }
      .cad-muted {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .cad-warn {
        color: var(--st-pendiente);
        font-weight: 700;
      }
      .cad-banner {
        padding: 10px 14px;
        font-size: 13px;
        border: 1px solid var(--hairline);
        background: var(--faint);
        color: var(--ink);
      }
      .cad-banner-warn {
        border-color: var(--st-pendiente);
        background: color-mix(in srgb, var(--st-pendiente) 10%, transparent);
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
  private customerSvc = inject(CustomerService);
  private assignmentSvc = inject(AssignmentAdminService);
  private toast = inject(ToastService);

  protected dateText = dateText;
  protected weekdaysText = weekdaysText;
  protected weeksOfCycleText = weeksOfCycleText;
  protected scheduleSummaryText = scheduleSummaryText;

  protected customer = signal<UiLookupItem | null>(null);
  protected vendor = signal<UiLookupItem | null>(null);
  protected weekdays = signal<number[]>([]);
  protected weeksOfCycle = signal<number[]>([]);
  protected saving = signal(false);
  protected error = signal('');
  protected weekdaysError = signal('');
  protected weeksError = signal('');

  protected currentAssignment = signal<CustomerSalesAssignment | null>(null);
  protected situationLoading = signal(false);

  protected customerSearch = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));
  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  protected effectiveCustomerId = computed(
    () => this.data.fixedCustomer?.id ?? this.customer()?.id,
  );

  protected assignCase = computed<AssignCase>(() => {
    const vendorId = this.vendor()?.id;
    const currentId = this.currentAssignment()?.salespersonId;
    if (currentId == null) return 'assign';
    return vendorId != null && vendorId === currentId ? 'same' : 'replace';
  });

  protected submitLabel = computed(() => {
    switch (this.assignCase()) {
      case 'same':
        return 'Guardar horario';
      case 'replace':
        return 'Reemplazar vendedor';
      default:
        return 'Asignar';
    }
  });

  protected canSubmit = computed(
    () =>
      !this.saving() &&
      !!this.effectiveCustomerId() &&
      !!this.vendor() &&
      this.weekdays().length > 0 &&
      this.weeksOfCycle().length > 0,
  );

  private loadSituationEffect = effect(() => {
    const customerId = this.effectiveCustomerId();
    untracked(() => this.loadSituation(customerId));
  });

  private loadSituation(customerId: number | undefined) {
    this.currentAssignment.set(null);
    if (!customerId) return;
    this.situationLoading.set(true);
    this.customerSvc.detail(customerId).subscribe({
      next: (detail) => {
        this.situationLoading.set(false);
        this.currentAssignment.set(detail.salesAssignment);
        if (detail.salesAssignment) {
          this.weekdays.set([...detail.salesAssignment.weekdays]);
          this.weeksOfCycle.set([...detail.salesAssignment.weeksOfCycle]);
        }
      },
      error: () => this.situationLoading.set(false),
    });
  }

  protected submit() {
    const customerId = this.effectiveCustomerId();
    const userId = this.vendor()?.id;
    this.weekdaysError.set(this.weekdays().length === 0 ? 'Elige al menos un día de visita' : '');
    this.weeksError.set(
      this.weeksOfCycle().length === 0 ? 'Elige al menos una semana del ciclo' : '',
    );
    if (
      !customerId ||
      !userId ||
      this.weekdays().length === 0 ||
      this.weeksOfCycle().length === 0
    ) {
      return;
    }
    const assignCase = this.assignCase();
    const vendorName = this.vendor()?.name ?? '';
    const previousName = this.currentAssignment()?.salespersonName ?? '';
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
          if (assignCase === 'same') {
            this.toast.success('Horario actualizado');
          } else if (assignCase === 'replace') {
            this.toast.success(`El cliente pasó de ${previousName} a ${vendorName}`);
          } else {
            this.toast.success(`Cliente asignado a ${vendorName}`);
          }
          this.ref.close(true);
        },
        error: (err) => {
          this.saving.set(false);
          const fieldErrors = err?.error?.errors;
          if (fieldErrors?.weekdays) this.weekdaysError.set(fieldErrors.weekdays);
          if (fieldErrors?.weeksOfCycle) this.weeksError.set(fieldErrors.weeksOfCycle);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(detalle || 'No pudimos guardar la asignación.');
        },
      });
  }
}
