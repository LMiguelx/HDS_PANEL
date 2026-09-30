import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { SalesReportAdminService } from './sales-report-admin';
import { ProductSalesReport } from '../../shared/models/sales-report.models';
import { orderStatusName } from '../orders/order-format';
import { dateTimeText } from '../assignments/assignment-format';
import { quantityText } from './sales-report-format';
import { formatSoles } from '../../shared/pipes/money';

/**
 * Marcas y productos, paso 3 — GET /orders/reports/product-sales/{id}. Los
 * KPI son siempre del rango completo; solo la tabla de pedidos se pagina.
 */
@Component({
  selector: 'app-product-sales-detail',
  imports: [RouterLink, UiButton, UiStatus, UiEmpty],
  template: `
    <section class="psd-page">
      @if (loading()) {
        <div class="psd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el producto"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (report(); as r) {
        <div class="psd-head">
          <div>
            <p class="psd-eyebrow">{{ r.productCode }} · {{ r.brandName }}</p>
            <h1>{{ r.productName }}</h1>
            <p class="psd-meta">{{ r.from }} — {{ r.to }}</p>
          </div>
          <button
            uiButton
            variant="secondary"
            [routerLink]="['/reportes-ventas/marcas-productos']"
            [queryParams]="{ brandId: brandIdParam(), from: r.from, to: r.to }"
          >
            Volver a la marca
          </button>
        </div>

        <div class="psd-kpi-row">
          <div class="psd-kpi">
            <span class="psd-kpi-value">{{ r.orderCount }}</span>
            <span class="psd-kpi-label">Pedidos</span>
          </div>
          <div class="psd-kpi">
            <span class="psd-kpi-value">{{ quantityText(r.quantity) }}</span>
            <span class="psd-kpi-label">Unidades</span>
          </div>
          <div class="psd-kpi">
            <span class="psd-kpi-value">{{ formatSoles(r.grossAmount) }}</span>
            <span class="psd-kpi-label">Bruto</span>
          </div>
          <div class="psd-kpi">
            <span class="psd-kpi-value">{{ formatSoles(r.discountAmount) }}</span>
            <span class="psd-kpi-label">Descuento</span>
          </div>
          <div class="psd-kpi psd-kpi-highlight">
            <span class="psd-kpi-value">{{ formatSoles(r.netAmount) }}</span>
            <span class="psd-kpi-label">Neto</span>
          </div>
        </div>

        @if (r.orders.content.length === 0) {
          <ui-empty title="Sin pedidos" body="No hay pedidos para mostrar en esta página." />
        } @else {
          <table class="ui-table-grid psd-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Estado</th>
                <th>Cantidad</th>
                <th>Bruto</th>
                <th>Descuento</th>
                <th>Neto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of r.orders.content; track o.orderId) {
                <tr>
                  <td class="psd-muted">{{ dateTimeText(o.orderDate) }}</td>
                  <td>{{ o.customerName }}</td>
                  <td class="psd-muted">{{ o.salespersonName }}</td>
                  <td><ui-status [label]="orderStatusName(o.statusCode)" /></td>
                  <td class="psd-muted">{{ quantityText(o.quantity) }}</td>
                  <td class="psd-muted">{{ formatSoles(o.grossAmount) }}</td>
                  <td class="psd-muted">{{ formatSoles(o.discountAmount) }}</td>
                  <td class="psd-cell-strong">{{ formatSoles(o.netAmount) }}</td>
                  <td class="psd-row-action">
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      [routerLink]="['/pedidos/detalle', o.orderId]"
                    >
                      Ver pedido
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="psd-pager">
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() === 0"
              (click)="prevPage()"
            >
              Anterior
            </button>
            <span class="psd-pager-label">
              Página {{ page() + 1 }} de {{ r.orders.totalPages || 1 }}
            </span>
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() + 1 >= r.orders.totalPages"
              (click)="nextPage()"
            >
              Siguiente
            </button>
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .psd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .psd-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .psd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .psd-eyebrow {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 4px 0 4px;
        color: var(--ink);
      }
      .psd-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .psd-kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
        gap: 14px;
        margin-top: 20px;
      }
      .psd-kpi {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .psd-kpi-highlight {
        border: 2px solid var(--divider);
      }
      .psd-kpi-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .psd-kpi-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .psd-table {
        width: 100%;
        margin-top: 24px;
      }
      .psd-cell-strong {
        font-weight: 800;
      }
      .psd-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .psd-row-action {
        text-align: right;
      }
      .psd-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .psd-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 767px) {
        .psd-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class ProductSalesDetailPage {
  private reportSvc = inject(SalesReportAdminService);

  productId = input('', { alias: 'productId' });
  fromParam = input('', { alias: 'from' });
  toParam = input('', { alias: 'to' });
  brandIdParam = input('', { alias: 'brandId' });

  protected orderStatusName = orderStatusName;
  protected dateTimeText = dateTimeText;
  protected quantityText = quantityText;
  protected formatSoles = formatSoles;

  protected report = signal<ProductSalesReport | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected page = signal(0);

  private loadEffect = effect(() => {
    if (this.productId() && this.fromParam() && this.toParam()) this.load();
  });

  load() {
    const productId = Number(this.productId());
    if (!productId || !this.fromParam() || !this.toParam()) return;
    this.loading.set(true);
    this.error.set(false);
    this.reportSvc
      .productSales(productId, this.fromParam(), this.toParam(), this.page())
      .subscribe({
        next: (result) => {
          this.report.set(result);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  protected prevPage() {
    if (this.page() === 0) return;
    this.page.update((p) => p - 1);
    this.load();
  }
  protected nextPage() {
    this.page.update((p) => p + 1);
    this.load();
  }
}
