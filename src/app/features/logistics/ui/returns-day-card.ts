import { Component, computed, input } from '@angular/core';
import { UiCard } from '../../../shared/ui/card/card';
import { ReturnsDayView } from '../domain/logistics.models';
import { formatSoles } from '../../../shared/pipes/money';

/**
 * Devoluciones del día, a todo el ancho debajo del bloque principal — doc
 * 93, sección 2.6: cifras / motivos / productos en 3 columnas, para no
 * dejar la tarjeta apretada en una columna angosta. Sin enlace: la pantalla
 * de devoluciones por planilla pide permisos de reparto que este rol no
 * tiene.
 */
@Component({
  selector: 'app-logistics-returns-day-card',
  imports: [UiCard],
  template: `
    <ui-card>
      <h3 class="lrd-title">Devoluciones del día</h3>
      @if (returns().invoicesWithReturns === 0) {
        <p class="lrd-empty">
          <span class="material-icons" aria-hidden="true">check_circle</span>
          Sin devoluciones registradas hoy
        </p>
      } @else {
        <div class="lrd-grid">
          <div class="lrd-col">
            <span class="lrd-col-title">Cifras</span>
            <span class="lrd-big-value">{{ returns().units }} unidades</span>
            <span class="lrd-big-sub">{{ formatSoles(returns().amount) }}</span>
            <span class="lrd-muted"
              >en {{ returns().invoicesWithReturns }} comprobante{{
                returns().invoicesWithReturns === 1 ? '' : 's'
              }}
              · {{ returns().productCount }} producto{{
                returns().productCount === 1 ? '' : 's'
              }}</span
            >
          </div>

          <div class="lrd-col">
            <span class="lrd-col-title">Por motivo</span>
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
          </div>

          <div class="lrd-col">
            <span class="lrd-col-title">Más devueltos</span>
            <div class="lrd-products">
              @for (p of returns().topProducts; track p.productCode) {
                <div class="lrd-product-row">
                  <span class="lrd-product-code">{{ p.productCode }}</span>
                  <span class="lrd-product-name" [title]="p.productName">{{ p.productName }}</span>
                  <span class="lrd-product-units">{{ p.units }} u.</span>
                  <span class="lrd-product-amount">{{ formatSoles(p.amount) }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </ui-card>
  `,
  styles: [
    `
      .lrd-title {
        margin: 0 0 14px;
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        color: var(--ink);
      }
      .lrd-empty {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 13px;
        color: var(--status-ok);
      }
      .lrd-empty .material-icons {
        font-size: 18px;
      }
      .lrd-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--sp-6);
      }
      .lrd-col {
        display: grid;
        gap: 6px;
        align-content: start;
        min-width: 0;
      }
      .lrd-col-title {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .lrd-big-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .lrd-big-sub {
        font-size: 15px;
        font-weight: 700;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .lrd-muted {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .lrd-reasons {
        display: grid;
        gap: 4px;
      }
      .lrd-reason-row {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
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
        display: grid;
        gap: 8px;
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

      @media (max-width: 900px) {
        .lrd-grid {
          grid-template-columns: 1fr;
        }
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
