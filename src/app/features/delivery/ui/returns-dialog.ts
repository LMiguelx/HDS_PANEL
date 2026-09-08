import { Component, computed, inject, signal } from '@angular/core';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { UI_DIALOG_DATA, UiDialogRef } from '../../../shared/ui/dialog/dialog';
import { DeliveryAdminService } from '../delivery-admin';
import { ReturnView } from '../../../shared/models/delivery.models';
import { formatSoles } from '../../../shared/pipes/money';
import { dateTimeText } from '../../assignments/assignment-format';

export interface ReturnsDialogData {
  invoiceId: string;
  customerName: string;
}

/** Devoluciones registradas sobre un comprobante — solo lectura (sin endpoint de creación en este panel). */
@Component({
  selector: 'app-returns-dialog',
  imports: [UiField, UiEmpty],
  template: `
    <div class="rd">
      <h2 class="rd-title">Devoluciones</h2>
      <p class="rd-sub">{{ data.customerName }} · {{ data.invoiceId }}</p>

      @if (loading()) {
        <div class="rd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (returns().length === 0) {
        <ui-empty
          title="Sin devoluciones"
          body="Este comprobante no tiene devoluciones registradas."
        />
      } @else {
        @if (reasonOptions().length > 2) {
          <ui-field
            label="Motivo"
            type="select"
            [(value)]="reasonFilter"
            [options]="reasonOptions()"
          />
        }
        <div class="rd-list">
          @for (r of filtered(); track r.returnId) {
            <div class="rd-row">
              <div class="rd-row-head">
                <span class="rd-row-product">{{ r.productName }}</span>
                <span class="rd-row-amount">{{ formatSoles(r.amount) }}</span>
              </div>
              <div class="rd-row-meta">
                {{ r.reasonName }} · {{ r.quantity }} unid. · {{ dateTimeText(r.registeredAt) }}
              </div>
              @if (r.salespersonNotified) {
                <span class="rd-badge">Vendedor notificado</span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  host: {
    style:
      'display:block; background:var(--bg); border:2px solid var(--divider); box-shadow:var(--elev-dialog); padding:24px; max-height:80vh; overflow-y:auto;',
  },
  styles: [
    `
      .rd {
        display: grid;
        gap: 16px;
      }
      .rd-title {
        font-size: 20px;
        margin: 0;
        color: var(--ink);
      }
      .rd-sub {
        margin: -8px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .rd-skeleton {
        height: 100px;
        background: var(--faint);
      }
      .rd-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .rd-row {
        background: var(--bg);
        padding: 10px 12px;
        display: grid;
        gap: 2px;
      }
      .rd-row-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .rd-row-product {
        font-weight: 800;
        color: var(--ink);
      }
      .rd-row-amount {
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .rd-row-meta {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .rd-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-vigente);
      }
    `,
  ],
})
export class ReturnsDialog {
  protected data = inject<ReturnsDialogData>(UI_DIALOG_DATA);
  protected ref = inject(UiDialogRef<void>);
  private deliverySvc = inject(DeliveryAdminService);

  protected formatSoles = formatSoles;
  protected dateTimeText = dateTimeText;

  protected returns = signal<ReturnView[]>([]);
  protected loading = signal(true);
  protected reasonFilter = signal('');

  protected reasonOptions = computed<UiFieldOption[]>(() => {
    const names = Array.from(new Set(this.returns().map((r) => r.reasonName)));
    return [
      { value: '', label: 'Todos los motivos' },
      ...names.map((n) => ({ value: n, label: n })),
    ];
  });

  protected filtered = computed(() => {
    const filter = this.reasonFilter();
    return filter ? this.returns().filter((r) => r.reasonName === filter) : this.returns();
  });

  constructor() {
    this.deliverySvc.returnsByInvoice(this.data.invoiceId).subscribe((list) => {
      this.returns.set(list);
      this.loading.set(false);
    });
  }
}
