import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { UiField, UiFieldOption } from '../../../shared/ui/field/field';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { DeliveryAdminService } from '../delivery-admin';
import { ReturnReasonStore } from '../return-reason-store';
import { ReturnView } from '../../../shared/models/delivery.models';
import { formatSoles } from '../../../shared/pipes/money';
import { dateTimeText } from '../../assignments/assignment-format';

/**
 * Devoluciones de un comprobante (GET /returns/by-invoice/{invoiceId}) —
 * reutilizado tal cual en el detalle de factura y en el diálogo de
 * devoluciones desde la planilla. Si viene vacío se muestra estado vacío,
 * nunca se oculta la sección completa. El filtro de motivo usa el catálogo
 * cacheado (ReturnReasonStore), no los nombres ya presentes en las filas.
 */
@Component({
  selector: 'app-returns-section',
  imports: [UiField, UiEmpty],
  template: `
    @if (loading()) {
      <div class="rs-skeleton" role="status" aria-label="Cargando devoluciones"></div>
    } @else if (returns().length === 0) {
      <ui-empty
        title="Sin devoluciones"
        body="Este comprobante no tiene devoluciones registradas."
      />
    } @else {
      @if (reasonOptions().length > 1) {
        <ui-field label="Motivo" type="select" [(value)]="reasonFilter" class="rs-filter" />
      }
      <div class="rs-list">
        @for (r of filtered(); track r.returnId) {
          <div class="rs-row">
            <div class="rs-row-head">
              <span class="rs-row-product">{{ r.productName }}</span>
              <span class="rs-row-amount">{{ formatSoles(r.amount) }}</span>
            </div>
            <div class="rs-row-meta">
              {{ r.reasonName }} · {{ r.quantity }} unid. · {{ dateTimeText(r.registeredAt) }}
            </div>
            @if (r.salespersonNotified) {
              <span class="rs-badge">Vendedor notificado</span>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .rs-skeleton {
        height: 100px;
        background: var(--faint);
      }
      .rs-filter {
        max-width: 260px;
        margin-bottom: 12px;
      }
      .rs-list {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
      }
      .rs-row {
        background: var(--bg);
        padding: 10px 12px;
        display: grid;
        gap: 2px;
      }
      .rs-row-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .rs-row-product {
        font-weight: 800;
        color: var(--ink);
      }
      .rs-row-amount {
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .rs-row-meta {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .rs-badge {
        font-size: 11px;
        font-weight: 800;
        color: var(--st-vigente);
      }
    `,
  ],
})
export class ReturnsSection {
  invoiceId = input.required<string>();

  private deliverySvc = inject(DeliveryAdminService);
  private reasonStore = inject(ReturnReasonStore);

  protected formatSoles = formatSoles;
  protected dateTimeText = dateTimeText;

  protected returns = signal<ReturnView[]>([]);
  protected loading = signal(true);
  protected reasonFilter = signal('');

  protected reasonOptions = computed<UiFieldOption[]>(() => {
    const catalog = this.reasonStore.reasons();
    if (catalog.length === 0) return [];
    return [
      { value: '', label: 'Todos los motivos' },
      ...catalog.map((r) => ({ value: String(r.returnReasonId), label: r.name })),
    ];
  });

  protected filtered = computed(() => {
    const filterId = this.reasonFilter();
    return filterId
      ? this.returns().filter((r) => String(r.returnReasonId) === filterId)
      : this.returns();
  });

  private loadEffect = effect(() => {
    const id = this.invoiceId();
    if (id) this.load(id);
  });

  constructor() {
    this.reasonStore.ensureLoaded();
  }

  private load(invoiceId: string) {
    this.loading.set(true);
    this.deliverySvc.returnsByInvoice(invoiceId).subscribe({
      next: (list) => {
        this.returns.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
