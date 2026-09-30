import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { SalesReportModuleTabs } from './ui/module-tabs';
import { SalesReportAdminService } from './sales-report-admin';
import { CatalogLookupService } from '../catalog/catalog-lookup';
import { BrandView } from '../../shared/models/catalog.models';
import { BrandSalesReport, ProductSalesRow } from '../../shared/models/sales-report.models';
import { quantityText } from './sales-report-format';
import { formatSoles } from '../../shared/pipes/money';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const TOP_PRODUCTS = 10;

/**
 * Marcas y productos, paso 2 — GET /orders/reports/brand-sales. El admin
 * elige marca + rango; ve los totales de la marca y una fila por producto.
 * No se pagina (una marca tiene decenas de productos).
 */
@Component({
  selector: 'app-brand-sales-tab',
  imports: [UiField, UiEmpty, SalesReportModuleTabs],
  template: `
    <app-sales-report-module-tabs />
    <section class="bst-page">
      <div class="bst-toolbar">
        <ui-field
          label="Marca"
          type="select"
          [(value)]="brandId"
          [options]="brandOptions()"
          [disabled]="loadingBrands()"
        />
        <ui-field label="Desde" type="date" [(value)]="from" />
        <ui-field label="Hasta" type="date" [(value)]="to" />
      </div>

      @if (!brandId()) {
        <ui-empty title="Elige una marca" body="Selecciona una marca para ver sus ventas." />
      } @else if (loading()) {
        <div class="bst-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el reporte"
          body="{{ error() }}"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (report(); as r) {
        <div class="bst-kpi-row">
          <div class="bst-kpi">
            <span class="bst-kpi-value">{{ r.orderCount }}</span>
            <span class="bst-kpi-label">Pedidos</span>
          </div>
          <div class="bst-kpi">
            <span class="bst-kpi-value">{{ formatSoles(r.grossAmount) }}</span>
            <span class="bst-kpi-label">Bruto</span>
          </div>
          <div class="bst-kpi">
            <span class="bst-kpi-value">{{ formatSoles(r.discountAmount) }}</span>
            <span class="bst-kpi-label">Descuento</span>
          </div>
          <div class="bst-kpi bst-kpi-highlight">
            <span class="bst-kpi-value">{{ formatSoles(r.netAmount) }}</span>
            <span class="bst-kpi-label">Neto</span>
          </div>
        </div>

        @if (r.products.length === 0) {
          <ui-empty
            title="Sin ventas"
            body="No hubo productos de esta marca vendidos en el rango elegido."
          />
        } @else {
          <h2 class="bst-section-title">
            Top {{ topProducts(r).length }} productos por venta neta
          </h2>
          <div class="bst-bar-chart">
            @for (p of topProducts(r); track p.productId) {
              <div class="bst-bar-row">
                <span class="bst-bar-label">{{ p.productName }}</span>
                <div class="bst-bar-track">
                  <div class="bst-bar-fill" [style.width.%]="barPct(r, p.netAmount)"></div>
                </div>
                <span class="bst-bar-value">{{ formatSoles(p.netAmount) }}</span>
              </div>
            }
          </div>

          <table class="ui-table-grid bst-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Pedidos</th>
                <th>Unidades</th>
                <th>Bruto</th>
                <th>Descuento</th>
                <th>Neto</th>
              </tr>
            </thead>
            <tbody>
              @for (p of r.products; track p.productId) {
                <tr class="bst-row" (click)="openProduct(p)">
                  <td class="bst-muted">{{ p.productCode }}</td>
                  <td>{{ p.productName }}</td>
                  <td class="bst-muted">{{ p.orderCount }}</td>
                  <td class="bst-muted">{{ quantityText(p.quantity) }}</td>
                  <td class="bst-muted">{{ formatSoles(p.grossAmount) }}</td>
                  <td class="bst-muted">{{ formatSoles(p.discountAmount) }}</td>
                  <td class="bst-cell-strong">{{ formatSoles(p.netAmount) }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" class="bst-cell-strong">Sumas</td>
                <td></td>
                <td class="bst-cell-strong">{{ quantityText(sumQuantity(r)) }}</td>
                <td class="bst-cell-strong">{{ formatSoles(sumGross(r)) }}</td>
                <td class="bst-cell-strong">{{ formatSoles(sumDiscount(r)) }}</td>
                <td class="bst-cell-strong">{{ formatSoles(sumNet(r)) }}</td>
              </tr>
            </tfoot>
          </table>
        }
      }
    </section>
  `,
  styles: [
    `
      .bst-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .bst-toolbar {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .bst-toolbar ui-field {
        width: 220px;
      }
      .bst-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .bst-kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
        gap: 14px;
      }
      .bst-kpi {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
      }
      .bst-kpi-highlight {
        border: 2px solid var(--divider);
      }
      .bst-kpi-value {
        display: block;
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .bst-kpi-label {
        display: block;
        margin-top: 4px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bst-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 24px 0 14px;
        color: var(--ink);
        border-bottom: var(--border-rule);
        padding-bottom: 8px;
      }
      .bst-bar-chart {
        display: grid;
        gap: 10px;
        margin-bottom: 24px;
      }
      .bst-bar-row {
        display: grid;
        grid-template-columns: 200px 1fr 110px;
        align-items: center;
        gap: 10px;
      }
      .bst-bar-label {
        font-size: 13px;
        color: var(--ink-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bst-bar-track {
        height: 16px;
        background: var(--faint);
      }
      .bst-bar-fill {
        height: 100%;
        background: var(--accent);
      }
      .bst-bar-value {
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .bst-table {
        width: 100%;
      }
      .bst-row {
        cursor: pointer;
      }
      .bst-row:hover {
        background: var(--faint);
      }
      .bst-cell-strong {
        font-weight: 800;
      }
      .bst-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }

      @media (max-width: 767px) {
        .bst-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class BrandSalesTab {
  private reportSvc = inject(SalesReportAdminService);
  private catalogSvc = inject(CatalogLookupService);
  private router = inject(Router);

  /** Query params opcionales para volver con la marca y el rango ya elegidos (desde el detalle de producto). */
  brandIdParam = input('', { alias: 'brandId' });
  fromParam = input('', { alias: 'from' });
  toParam = input('', { alias: 'to' });

  protected formatSoles = formatSoles;
  protected quantityText = quantityText;

  protected brands = signal<BrandView[]>([]);
  protected loadingBrands = signal(true);
  protected brandId = signal('');
  protected from = signal(firstOfMonthIso());
  protected to = signal(todayIso());

  private seedQueryParamsEffect = effect(() => {
    const brandId = this.brandIdParam();
    const from = this.fromParam();
    const to = this.toParam();
    untracked(() => {
      if (brandId) this.brandId.set(brandId);
      if (from) this.from.set(from);
      if (to) this.to.set(to);
    });
  });

  protected report = signal<BrandSalesReport | null>(null);
  protected loading = signal(false);
  protected error = signal('');

  protected brandOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: this.loadingBrands() ? 'Cargando…' : 'Selecciona una marca' },
    ...this.brands().map((b) => ({ value: String(b.brandId), label: b.name })),
  ]);

  private loadEffect = effect(() => {
    this.brandId();
    this.from();
    this.to();
    untracked(() => {
      if (this.brandId()) this.load();
    });
  });

  constructor() {
    this.catalogSvc.brands().subscribe({
      next: (list) => {
        this.brands.set(list);
        this.loadingBrands.set(false);
      },
      error: () => this.loadingBrands.set(false),
    });
  }

  protected topProducts(r: BrandSalesReport): ProductSalesRow[] {
    return [...r.products].sort((a, b) => b.netAmount - a.netAmount).slice(0, TOP_PRODUCTS);
  }

  protected barPct(r: BrandSalesReport, netAmount: number): number {
    const max = Math.max(...this.topProducts(r).map((p) => p.netAmount), 1);
    return Math.round((netAmount / max) * 100);
  }

  protected sumQuantity(r: BrandSalesReport) {
    return r.products.reduce((sum, p) => sum + p.quantity, 0);
  }
  protected sumGross(r: BrandSalesReport) {
    return r.products.reduce((sum, p) => sum + p.grossAmount, 0);
  }
  protected sumDiscount(r: BrandSalesReport) {
    return r.products.reduce((sum, p) => sum + p.discountAmount, 0);
  }
  protected sumNet(r: BrandSalesReport) {
    return r.products.reduce((sum, p) => sum + p.netAmount, 0);
  }

  load() {
    const brandId = Number(this.brandId());
    if (!brandId) return;
    this.loading.set(true);
    this.error.set('');
    this.reportSvc.brandSales(brandId, this.from(), this.to()).subscribe({
      next: (result) => {
        this.report.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const detalle = err?.error?.detail ?? err?.error?.message;
        this.error.set(detalle || 'No pudimos cargar el reporte de la marca.');
      },
    });
  }

  protected openProduct(p: ProductSalesRow) {
    this.router.navigate(['/reportes-ventas/marcas-productos/producto', p.productId], {
      queryParams: { from: this.from(), to: this.to(), brandId: this.brandId() },
    });
  }
}
