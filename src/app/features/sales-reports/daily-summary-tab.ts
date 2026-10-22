import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { SalesReportModuleTabs } from './ui/module-tabs';
import { OrderAdminService } from '../orders/order-admin';
import { GlobalDailyOrderSummaryView } from '../../shared/models/order.models';
import { formatSoles } from '../../shared/pipes/money';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Resumen del día — GET /orders/daily-summary?date=. Las tarjetas que antes
 * vivían en Pedidos, ahora con su propio selector de fecha (los números
 * siempre corresponden al día elegido, no "hoy" fijo).
 */
@Component({
  selector: 'app-daily-summary-tab',
  imports: [UiButton, UiField, UiEmpty, SalesReportModuleTabs],
  template: `
    <app-sales-report-module-tabs />
    <section class="dst-page">
      <div class="dst-toolbar">
        <ui-field label="Fecha" type="date" [(value)]="date" />
      </div>

      @if (loading()) {
        <div class="dst-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el resumen"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (data(); as d) {
        <div class="dst-kpi-row">
          <div class="dst-kpi">
            <span class="dst-kpi-value">{{ d.totalOrders }}</span>
            <span class="dst-kpi-label">Total de pedidos</span>
          </div>
          <div class="dst-kpi">
            <span class="dst-kpi-value">{{ formatSoles(d.totalAmount) }}</span>
            <span class="dst-kpi-label">Monto bruto</span>
          </div>
          <div class="dst-kpi">
            <span class="dst-kpi-value">{{ formatSoles(d.totalDiscountAmount) }}</span>
            <span class="dst-kpi-label">Descuento</span>
          </div>
          <div class="dst-kpi dst-kpi-highlight">
            <span class="dst-kpi-value">{{ formatSoles(d.totalNetAmount) }}</span>
            <span class="dst-kpi-label">Neto</span>
          </div>
          <div class="dst-kpi">
            <span class="dst-kpi-value">{{ d.totalBonusLines }}</span>
            <span class="dst-kpi-label">Líneas bonificadas</span>
            <span class="dst-kpi-compare">{{ d.totalBonusUnits }} unidades</span>
          </div>
        </div>

        <div class="dst-actions">
          <button uiButton variant="secondary" (click)="viewOrders()">Ver pedidos del día</button>
        </div>

        <h2 class="dst-section-title">Venta neta por marca</h2>
        @if (d.salesByBrand.length === 0) {
          <ui-empty title="Sin ventas" body="No hubo pedidos con marca vendida en este día." />
        } @else {
          <div class="dst-bar-chart">
            @for (b of sortedBrands(d); track b.brandId) {
              <div class="dst-bar-row">
                <span class="dst-bar-label">{{ b.brandName }}</span>
                <div class="dst-bar-track">
                  <div class="dst-bar-fill" [style.width.%]="barPct(d, b.netAmount)"></div>
                </div>
                <span class="dst-bar-value">{{ formatSoles(b.netAmount) }}</span>
              </div>
            }
          </div>

          <table class="ui-table-grid dst-table">
            <thead>
              <tr>
                <th>Marca</th>
                <th>Bruto</th>
                <th>Descuento</th>
                <th>Neto</th>
                <th>Unid. bonificadas</th>
              </tr>
            </thead>
            <tbody>
              @for (b of sortedBrands(d); track b.brandId) {
                <tr>
                  <td>{{ b.brandName }}</td>
                  <td class="dst-muted">{{ formatSoles(b.grossAmount) }}</td>
                  <td class="dst-muted">{{ formatSoles(b.discountAmount) }}</td>
                  <td class="dst-cell-strong">{{ formatSoles(b.netAmount) }}</td>
                  <td class="dst-muted">{{ b.bonusUnits }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </section>
  `,
  styles: [
    `
      .dst-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .dst-toolbar {
        max-width: 220px;
        margin-bottom: 20px;
      }
      .dst-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .dst-kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
        gap: 14px;
      }
      .dst-kpi {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .dst-kpi-highlight {
        border: 2px solid var(--divider);
      }
      .dst-kpi-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .dst-kpi-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .dst-kpi-compare {
        display: block;
        font-size: 11px;
        color: var(--ink-muted);
      }
      .dst-actions {
        margin: 18px 0;
      }
      .dst-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 24px 0 14px;
        color: var(--ink);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
      }
      .dst-bar-chart {
        display: grid;
        gap: 10px;
      }
      .dst-bar-row {
        display: grid;
        grid-template-columns: 160px 1fr 110px;
        align-items: center;
        gap: 10px;
      }
      .dst-bar-label {
        font-size: 13px;
        color: var(--ink-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dst-bar-track {
        height: 16px;
        background: var(--faint);
      }
      .dst-bar-fill {
        height: 100%;
        background: var(--accent);
      }
      .dst-bar-value {
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .dst-table {
        margin-top: 20px;
        width: 100%;
      }
      .dst-cell-strong {
        font-weight: 800;
      }
      .dst-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }

      @media (max-width: 767px) {
        .dst-page {
          padding: var(--sp-4);
        }
        .dst-bar-row {
          grid-template-columns: 100px 1fr 84px;
        }
      }
    `,
  ],
})
export class DailySummaryTab {
  private orderSvc = inject(OrderAdminService);
  private router = inject(Router);

  protected formatSoles = formatSoles;
  protected date = signal(todayIso());

  protected data = signal<GlobalDailyOrderSummaryView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  private loadEffect = effect(() => {
    this.date();
    untracked(() => this.load());
  });

  protected sortedBrands(d: GlobalDailyOrderSummaryView) {
    return [...d.salesByBrand].sort((a, b) => b.netAmount - a.netAmount);
  }

  protected barPct(d: GlobalDailyOrderSummaryView, netAmount: number): number {
    const max = Math.max(...d.salesByBrand.map((b) => b.netAmount), 1);
    return Math.round((netAmount / max) * 100);
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.orderSvc.dailySummary(this.date()).subscribe({
      next: (result) => {
        this.data.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected viewOrders() {
    this.router.navigate(['/pedidos'], {
      queryParams: { from: this.date(), to: this.date() },
    });
  }
}
