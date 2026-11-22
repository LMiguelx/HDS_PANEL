import { Component, computed, input } from '@angular/core';
import { UiEmpty } from '../../../shared/ui/empty/empty';
import { ReturnsDayView } from '../domain/logistics.models';
import { formatSoles } from '../../../shared/pipes/money';

/**
 * Tarjeta 3 de "Picking y reparto" — doc 93, sección 2.6. Sin enlace: la
 * pantalla de devoluciones por planilla pide permisos de reparto que este
 * rol no tiene.
 */
@Component({
  selector: 'app-logistics-returns-day-card',
  imports: [UiEmpty],
  template: `
    <div class="lrd-card">
      <h3>Devoluciones del día</h3>
      @if (returns().invoicesWithReturns === 0) {
        <ui-empty variant="al-dia" title="Sin devoluciones registradas hoy" />
      } @else {
        <p class="lrd-figures">
          <strong>{{ returns().units }}</strong> unidades ·
          <strong>{{ formatSoles(returns().amount) }}</strong> en
          {{ returns().invoicesWithReturns }} comprobante{{
            returns().invoicesWithReturns === 1 ? '' : 's'
          }}
        </p>

        <div class="lrd-reasons">
          @for (r of returns().byReason; track r.reasonCode) {
            <div class="lrd-reason-row">
              <span class="lrd-reason-name">{{ r.reasonName }}</span>
              <span class="lrd-reason-value">{{ r.units }} u.</span>
            </div>
            <div class="lrd-reason-track">
              <div class="lrd-reason-fill" [style.width.%]="reasonPct(r.units)"></div>
            </div>
          }
        </div>

        <div class="lrd-products">
          <span class="lrd-products-title">Más devueltos</span>
          @for (p of returns().topProducts; track p.productCode) {
            <div class="lrd-product-row">
              <span class="lrd-product-code">{{ p.productCode }}</span>
              <span class="lrd-product-name" [title]="p.productName">{{ p.productName }}</span>
              <span class="lrd-product-units">{{ p.units }} u.</span>
              <span class="lrd-product-amount">{{ formatSoles(p.amount) }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .lrd-card {
        border: 1px solid var(--hairline);
        background: var(--surface);
        padding: 14px 16px;
        display: grid;
        gap: 10px;
        align-content: start;
      }
      h3 {
        margin: 0;
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        color: var(--ink);
      }
      .lrd-figures {
        margin: 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .lrd-figures strong {
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .lrd-reasons {
        display: grid;
        gap: 4px;
      }
      .lrd-reason-row {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--ink-muted);
      }
      .lrd-reason-track {
        height: 6px;
        background: var(--faint);
        margin-bottom: 6px;
      }
      .lrd-reason-fill {
        height: 100%;
        background: var(--status-danger);
      }
      .lrd-products {
        border-top: 1px dashed var(--hairline);
        padding-top: 10px;
        display: grid;
        gap: 6px;
      }
      .lrd-products-title {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .lrd-product-row {
        display: grid;
        grid-template-columns: 56px 1fr auto auto;
        gap: 8px;
        align-items: baseline;
        font-size: 12px;
      }
      .lrd-product-code {
        color: var(--ink-muted);
      }
      .lrd-product-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
      .lrd-product-units,
      .lrd-product-amount {
        font-variant-numeric: var(--tnum);
        color: var(--ink-muted);
        white-space: nowrap;
      }
    `,
  ],
})
export class LogisticsReturnsDayCard {
  returns = input.required<ReturnsDayView>();
  protected formatSoles = formatSoles;

  private maxReasonUnits = computed(() =>
    Math.max(...this.returns().byReason.map((r) => r.units), 1),
  );

  protected reasonPct(units: number): number {
    return Math.round((units / this.maxReasonUnits()) * 100);
  }
}
