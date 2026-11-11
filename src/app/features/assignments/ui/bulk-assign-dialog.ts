import { Component, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs/operators';
import { UiButton } from '../../../shared/ui/button/button';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UiModal } from '../../../shared/ui/modal/modal';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { ToastService } from '../../../core/ui/toast';
import { LookupService, toUiLookup } from '../../promos/lookup';
import { AssignmentAdminService } from '../assignment-admin';
import { SchedulePicker } from './schedule-picker';
import { BulkAssignResult } from '../../../shared/models/assignment-admin.models';

export interface BulkAssignDialogData {
  customers: {
    customerId: number;
    code: string;
    businessName: string;
    salespersonId: number | null;
    salespersonName: string | null;
  }[];
}

/**
 * Asignación en lote — doc 68, sección 6.2. Los días son obligatorios; las
 * semanas llegan marcadas con las 4 (opcionales: todas desmarcadas = null,
 * que el servidor entiende como las 4). Si hay saltados en la respuesta, el
 * modal se queda abierto mostrando el resumen en vez de cerrar con un toast.
 */
@Component({
  selector: 'app-bulk-assign-dialog',
  imports: [UiButton, UiTypeahead, SchedulePicker, UiModal],
  template: `
    <ui-modal title="Asignar en lote" [subtitle]="subtitle()" (close)="ref.close(false)">
      @if (!result(); as noResult) {
        <div class="bad">
          <ui-typeahead
            label="Vendedor"
            [clearOnPick]="false"
            [search]="userSearch"
            [selected]="vendor()"
            (picked)="vendor.set($event)"
          />

          <app-schedule-picker
            [(weekdaysValue)]="weekdays"
            [(weeksOfCycleValue)]="weeksOfCycle"
            [weekdaysError]="weekdaysError()"
          />

          @if (replaceCount() > 0) {
            <div class="bad-note">
              ⓘ {{ replaceCount() }} ya {{ replaceCount() === 1 ? 'es' : 'son' }} de otro vendedor:
              se reemplazará{{ replaceCount() === 1 ? '' : 'n' }}.
            </div>
          }
          @if (sameVendorCount() > 0) {
            <div class="bad-note">
              ⓘ {{ sameVendorCount() }} ya {{ sameVendorCount() === 1 ? 'es' : 'son' }} de este
              vendedor: solo cambiará{{ sameVendorCount() === 1 ? '' : 'n' }} su horario.
            </div>
          }

          @if (error()) {
            <div class="bad-error">{{ error() }}</div>
          }
        </div>
      } @else {
        <div class="bad-summary">
          <p class="bad-summary-line">
            {{ totalApplied() }} clientes asignados a {{ vendor()?.name }}
          </p>
          @if (breakdown()) {
            <p class="bad-summary-detail">{{ breakdown() }}</p>
          }
          <h3 class="bad-summary-title">No se asignaron ({{ result()!.skipped.length }})</h3>
          <ul class="bad-skip-list">
            @for (s of result()!.skipped; track s.code) {
              <li>
                <span class="bad-skip-name">{{ s.businessName }}</span>
                <span class="bad-skip-code">{{ s.code }}</span>
                <span class="bad-skip-msg">{{ s.message }}</span>
              </li>
            }
          </ul>
        </div>
      }

      @if (!result()) {
        <ng-container modalFooter>
          <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
          <button
            uiButton
            variant="primary"
            [disabled]="!canSubmit()"
            [loading]="saving()"
            (click)="submit()"
          >
            Asignar {{ data.customers.length }} clientes
          </button>
        </ng-container>
      } @else {
        <ng-container modalFooter>
          <button uiButton variant="primary" (click)="ref.close(true)">Cerrar</button>
        </ng-container>
      }
    </ui-modal>
  `,
  styles: [
    `
      .bad {
        display: grid;
        gap: 16px;
      }
      .bad-note {
        padding: 10px 14px;
        font-size: 13px;
        border: 1px solid var(--hairline);
        background: var(--faint);
        color: var(--ink);
      }
      .bad-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .bad-summary {
        display: grid;
        gap: 4px;
      }
      .bad-summary-line {
        margin: 0;
        font-weight: 800;
        font-size: 15px;
        color: var(--ink);
      }
      .bad-summary-detail {
        margin: 0 0 16px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .bad-summary-title {
        font-size: var(--fs-h2, 14px);
        margin: 8px 0 8px;
        color: var(--ink);
      }
      .bad-skip-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
        max-height: 260px;
        overflow-y: auto;
      }
      .bad-skip-list li {
        background: var(--bg);
        padding: 10px 12px;
        display: grid;
        gap: 2px;
      }
      .bad-skip-name {
        font-weight: 700;
        color: var(--ink);
        font-size: 13px;
      }
      .bad-skip-code {
        margin-left: 6px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bad-skip-msg {
        display: block;
        font-size: 12px;
        color: var(--ink-muted);
      }
    `,
  ],
})
export class BulkAssignDialog {
  protected data = inject<BulkAssignDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private lookupSvc = inject(LookupService);
  private assignmentSvc = inject(AssignmentAdminService);
  private toast = inject(ToastService);

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q, { role: 'VENDEDOR' }).pipe(map((items) => toUiLookup(items)));

  protected vendor = signal<UiLookupItem | null>(null);
  protected weekdays = signal<number[]>([]);
  protected weeksOfCycle = signal<number[]>([1, 2, 3, 4]);
  protected saving = signal(false);
  protected error = signal('');
  protected weekdaysError = signal('');
  protected result = signal<BulkAssignResult | null>(null);

  protected subtitle = computed(() => `${this.data.customers.length} clientes seleccionados`);

  protected replaceCount = computed(() => {
    const vendorId = this.vendor()?.id;
    if (vendorId == null) return 0;
    return this.data.customers.filter(
      (c) => c.salespersonId != null && c.salespersonId !== vendorId,
    ).length;
  });
  protected sameVendorCount = computed(() => {
    const vendorId = this.vendor()?.id;
    if (vendorId == null) return 0;
    return this.data.customers.filter((c) => c.salespersonId === vendorId).length;
  });

  protected canSubmit = computed(
    () => !this.saving() && !!this.vendor() && this.weekdays().length > 0,
  );

  protected totalApplied = computed(() => {
    const r = this.result();
    if (!r) return 0;
    return r.assigned + r.replaced + r.scheduleUpdated;
  });

  protected breakdown = computed(() => {
    const r = this.result();
    if (!r) return '';
    const parts: string[] = [];
    if (r.assigned > 0) parts.push(`${r.assigned} nuevos`);
    if (r.replaced > 0) parts.push(`${r.replaced} reemplazados`);
    if (r.scheduleUpdated > 0) parts.push(`${r.scheduleUpdated} con horario actualizado`);
    return parts.length > 1 ? parts.join(' · ') : '';
  });

  protected submit() {
    this.weekdaysError.set(this.weekdays().length === 0 ? 'Elige al menos un día de visita' : '');
    const userId = this.vendor()?.id;
    if (!userId || this.weekdays().length === 0) return;
    this.saving.set(true);
    this.error.set('');
    const vendorName = this.vendor()?.name ?? '';
    this.assignmentSvc
      .bulkAssign({
        customerIds: this.data.customers.map((c) => c.customerId),
        userId,
        weekdays: this.weekdays(),
        weeksOfCycle: this.weeksOfCycle().length > 0 ? this.weeksOfCycle() : null,
      })
      .subscribe({
        next: (r: BulkAssignResult) => {
          this.saving.set(false);
          this.result.set(r);
          if (r.skipped.length === 0) {
            const total = r.assigned + r.replaced + r.scheduleUpdated;
            const detail = this.breakdown() ? ` · ${this.breakdown()}` : '';
            this.toast.success(`${total} clientes asignados a ${vendorName}${detail}`);
            this.ref.close(true);
          }
        },
        error: (err) => {
          this.saving.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(detalle || 'No pudimos asignar en lote.');
        },
      });
  }
}
