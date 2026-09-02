import { Component, inject, signal } from '@angular/core';
import { map } from 'rxjs/operators';
import { UiButton } from '../../../shared/ui/button/button';
import { UiField } from '../../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../../shared/ui/typeahead/typeahead';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { LookupService, toUiLookup } from '../../promos/lookup';
import { AssignmentAdminService } from '../assignment-admin';
import { MapCustomerView } from '../../../shared/models/assignment-admin.models';
import { isVisited } from '../assignment-format';

export interface CoverageDialogData {
  absentUserId: number;
  absentUserName: string;
  /** Si ya se cargó la cartera de este vendedor (ej. desde el Mapa), se reutiliza en vez de pedirla de nuevo. */
  customers?: MapCustomerView[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cobertura puntual (`POST /api/admin/assignments/coverage`): otro vendedor
 * cubre por hoy uno o varios clientes de un vendedor ausente. No cierra ni
 * modifica la asignación real.
 */
@Component({
  selector: 'app-coverage-dialog',
  imports: [UiButton, UiField, UiTypeahead],
  template: `
    <div class="cov">
      <h2 class="cov-title">Cobertura puntual</h2>
      <p class="cov-sub">
        Ausente: <strong>{{ data.absentUserName }}</strong>
      </p>

      <ui-typeahead
        label="Vendedor que cubre — busca por nombre"
        [clearOnPick]="false"
        [search]="userSearch"
        [selected]="covering()"
        (picked)="covering.set($event)"
      />

      <ui-field label="Fecha de cobertura" type="date" [(value)]="coverageDate" />

      <div class="cov-customers">
        <span class="cov-customers-label">Clientes a cubrir</span>
        @if (loadingCustomers()) {
          <div class="cov-skeleton" role="status" aria-label="Cargando cartera"></div>
        } @else if (customers().length === 0) {
          <p class="cov-empty">Este vendedor no tiene clientes en cartera.</p>
        } @else {
          <div class="cov-customer-list">
            @for (c of customers(); track c.customerId) {
              <label class="cov-customer-row">
                <input
                  type="checkbox"
                  [checked]="selected().has(c.customerId)"
                  (change)="toggle(c.customerId)"
                />
                <span class="cov-customer-name">{{ c.customerName }}</span>
                @if (c.scheduledToday) {
                  <span class="cov-badge" [class.cov-badge-done]="isVisited(c.visitStatusCode)">
                    {{ isVisited(c.visitStatusCode) ? 'Ya visitado hoy' : 'Le tocaba hoy' }}
                  </span>
                }
              </label>
            }
          </div>
        }
      </div>

      <ui-field
        label="Motivo (opcional)"
        type="textarea"
        [rows]="2"
        [(value)]="reason"
        hint="Máximo 255 caracteres."
      />

      @if (error()) {
        <div class="cov-error">{{ error() }}</div>
      }

      <div class="cov-actions">
        <button uiButton variant="secondary" (click)="ref.close(false)">Cancelar</button>
        <button uiButton variant="primary" [loading]="saving()" (click)="submit()">
          Cubrir {{ selected().size || '' }} cliente{{ selected().size === 1 ? '' : 's' }}
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
      .cov {
        display: grid;
        gap: 16px;
        max-width: 480px;
      }
      .cov-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .cov-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .cov-customers {
        display: grid;
        gap: 6px;
      }
      .cov-customers-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .cov-skeleton {
        height: 90px;
        background: var(--faint);
      }
      .cov-empty {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .cov-customer-list {
        display: grid;
        gap: 2px;
        max-height: 220px;
        overflow-y: auto;
        border: 1px solid var(--hairline);
      }
      .cov-customer-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        min-height: var(--touch-min);
        cursor: pointer;
        font-size: 13px;
      }
      .cov-customer-row:hover {
        background: var(--faint);
      }
      .cov-customer-name {
        flex: 1;
        font-weight: 600;
        color: var(--ink);
      }
      .cov-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-pendiente);
        white-space: nowrap;
      }
      .cov-badge-done {
        color: var(--ink-muted);
      }
      .cov-error {
        color: var(--accent-ink);
        font-size: 13px;
      }
      .cov-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    `,
  ],
})
export class CoverageDialog {
  protected data = inject<CoverageDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<boolean>);
  private lookupSvc = inject(LookupService);
  private assignmentSvc = inject(AssignmentAdminService);

  protected isVisited = isVisited;

  protected covering = signal<UiLookupItem | null>(null);
  protected coverageDate = signal(todayIso());
  protected reason = signal('');
  protected customers = signal<MapCustomerView[]>(this.data.customers ?? []);
  protected loadingCustomers = signal(!this.data.customers);
  protected selected = signal<Set<number>>(
    new Set(this.defaultSelection(this.data.customers ?? [])),
  );
  protected saving = signal(false);
  protected error = signal('');

  protected userSearch = (q: string) =>
    this.lookupSvc.users(q).pipe(map((items) => toUiLookup(items)));

  constructor() {
    if (!this.data.customers) {
      this.assignmentSvc.map({ userIds: [this.data.absentUserId] }).subscribe({
        next: (rows) => {
          this.customers.set(rows);
          this.selected.set(new Set(this.defaultSelection(rows)));
          this.loadingCustomers.set(false);
        },
        error: () => this.loadingCustomers.set(false),
      });
    }
  }

  private defaultSelection(rows: MapCustomerView[]): number[] {
    return rows
      .filter((c) => c.scheduledToday && !isVisited(c.visitStatusCode))
      .map((c) => c.customerId);
  }

  protected toggle(customerId: number) {
    const next = new Set(this.selected());
    next.has(customerId) ? next.delete(customerId) : next.add(customerId);
    this.selected.set(next);
  }

  protected submit() {
    const coveringUserId = this.covering()?.id;
    const customerIds = Array.from(this.selected());
    if (!coveringUserId || customerIds.length === 0 || !this.coverageDate()) {
      this.error.set('Elige quién cubre, la fecha y al menos un cliente.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.assignmentSvc
      .coverage({
        absentUserId: this.data.absentUserId,
        coveringUserId,
        coverageDate: this.coverageDate(),
        customerIds,
        reason: this.reason() || undefined,
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
              ? `No pudimos registrar la cobertura: ${detalle}`
              : 'No pudimos registrar la cobertura.',
          );
        },
      });
  }
}
