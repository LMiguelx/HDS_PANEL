import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiStatus } from '../../shared/ui/status/status';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiExportMenu } from '../../shared/ui/export-menu/export-menu';
import { SalesReportAdminService } from './sales-report-admin';
import { ProductOrderRow, ProductSalesReport } from '../../shared/models/sales-report.models';
import { orderStatusName } from '../orders/order-format';
import { dateText, dateTimeText } from '../assignments/assignment-format';
import { quantityText } from './sales-report-format';
import { formatSoles } from '../../shared/pipes/money';
import { TableExporter } from '../../shared/utils/export/table-exporter.service';
import { ExportFormat, ExportTable } from '../../shared/utils/export/export.models';
import { exportFileName } from '../../shared/utils/export/export-file-name';
import { productSalesColumns } from './domain/product-sales.columns';
import { ToastService } from '../../core/ui/toast';

const EXPORT_PAGE_SIZE = 1000;
const EXPORT_MAX_ROWS = 50000;

/**
 * Marcas y productos, paso 3 — GET /orders/reports/product-sales/{id}. Los
 * KPI son siempre del rango completo; solo la tabla de pedidos se pagina.
 */
@Component({
  selector: 'app-product-sales-detail',
  imports: [RouterLink, UiButton, UiStatus, UiEmpty, UiExportMenu],
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
            <p class="psd-meta">
              {{ dateText(r.from) }} — {{ dateText(r.to) }}
              @if (r.salespersonName) {
                · vendido por {{ r.salespersonName }}
              }
            </p>
          </div>
          <div class="psd-head-actions">
            <ui-export-menu
              [disabled]="!canExport()"
              [busy]="exporting()"
              [progressText]="exportProgressText()"
              (export)="onExport($event)"
            />
            <button
              uiButton
              variant="secondary"
              [routerLink]="['/reportes-ventas/marcas-productos']"
              [queryParams]="{
                brandId: brandIdParam(),
                from: r.from,
                to: r.to,
                salespersonId: salespersonIdParam() || undefined,
              }"
            >
              Volver a la marca
            </button>
          </div>
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
      .psd-head-actions {
        display: flex;
        gap: 10px;
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
  private exporter = inject(TableExporter);
  private toast = inject(ToastService);

  productId = input('', { alias: 'productId' });
  fromParam = input('', { alias: 'from' });
  toParam = input('', { alias: 'to' });
  brandIdParam = input('', { alias: 'brandId' });
  salespersonIdParam = input('', { alias: 'salespersonId' });

  protected orderStatusName = orderStatusName;
  protected dateText = dateText;
  protected dateTimeText = dateTimeText;
  protected quantityText = quantityText;
  protected formatSoles = formatSoles;
  protected columns = computed(() => productSalesColumns({ includeOrderId: true }));

  protected report = signal<ProductSalesReport | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected page = signal(0);

  protected exporting = signal(false);
  protected exportProgressText = signal('');
  protected canExport = computed(
    () => !this.loading() && !this.error() && (this.report()?.orderCount ?? 0) > 0,
  );
  private activeExport: { cancelled: boolean } | null = null;

  private loadEffect = effect(() => {
    if (this.productId() && this.fromParam() && this.toParam()) this.load();
  });

  /** Un filtro distinto invalida cualquier exportación en curso — sección 7.4. */
  private cancelExportOnFilterChangeEffect = effect(() => {
    this.productId();
    this.fromParam();
    this.toParam();
    this.salespersonIdParam();
    untracked(() => this.cancelExport());
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelExport());
  }

  load() {
    const productId = Number(this.productId());
    if (!productId || !this.fromParam() || !this.toParam()) return;
    this.loading.set(true);
    this.error.set(false);
    const salespersonId = this.salespersonIdParam() ? Number(this.salespersonIdParam()) : undefined;
    this.reportSvc
      .productSales(productId, this.fromParam(), this.toParam(), this.page(), 20, salespersonId)
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

  /**
   * Exporta TODOS los pedidos del rango (no solo la página en pantalla):
   * trae páginas de 1000 en secuencia hasta agotar el reporte, con un tope
   * de seguridad de {@link EXPORT_MAX_ROWS} filas — sección 7.4. Se
   * cancela sola si cambian los filtros o se sale de la pantalla.
   */
  protected async onExport(format: ExportFormat) {
    const r = this.report();
    if (!r || this.exporting()) return;
    const productId = Number(this.productId());
    if (!productId) return;
    const salespersonId = this.salespersonIdParam() ? Number(this.salespersonIdParam()) : undefined;

    const token = { cancelled: false };
    this.activeExport = token;
    this.exporting.set(true);
    this.exportProgressText.set('');

    try {
      const rows: ProductOrderRow[] = [];
      let pageIndex = 0;
      let totalPages = 1;
      let totalElements = 0;
      do {
        const page = await firstValueFrom(
          this.reportSvc.productSales(
            productId,
            this.fromParam(),
            this.toParam(),
            pageIndex,
            EXPORT_PAGE_SIZE,
            salespersonId,
          ),
        );
        if (token.cancelled) return;

        rows.push(...page.orders.content);
        totalPages = page.orders.totalPages || 1;
        totalElements = page.orders.totalElements;
        if (rows.length > EXPORT_MAX_ROWS) {
          throw new Error(
            `El reporte tiene más de ${EXPORT_MAX_ROWS.toLocaleString('es-PE')} pedidos. Acota el rango de fechas para exportarlo.`,
          );
        }
        pageIndex++;
        if (pageIndex < totalPages) {
          this.exportProgressText.set(`Exportando… ${rows.length} de ${totalElements}`);
        }
      } while (pageIndex < totalPages);

      if (token.cancelled) return;
      const table = this.buildTable(r, rows);
      await this.exporter.export(table, format);
      if (token.cancelled) return;
      this.toast.success(`Archivo descargado: ${table.fileName}.${format}`);
    } catch (err) {
      if (!token.cancelled) {
        const message =
          err instanceof Error ? err.message : 'No pudimos generar el archivo. Intenta de nuevo.';
        this.toast.error(message);
      }
    } finally {
      if (this.activeExport === token) {
        this.activeExport = null;
        this.exporting.set(false);
        this.exportProgressText.set('');
      }
    }
  }

  private cancelExport() {
    if (this.activeExport) this.activeExport.cancelled = true;
    this.activeExport = null;
    this.exporting.set(false);
    this.exportProgressText.set('');
  }

  private buildTable(r: ProductSalesReport, rows: ProductOrderRow[]): ExportTable<ProductOrderRow> {
    return {
      title: 'Detalle del producto',
      subtitle: r.salespersonName
        ? `${r.productName} — vendido por ${r.salespersonName}`
        : r.productName,
      filters: [
        { label: 'Producto', value: `${r.productCode} · ${r.productName}` },
        { label: 'Marca', value: r.brandName },
        { label: 'Desde', value: dateText(r.from) },
        { label: 'Hasta', value: dateText(r.to) },
        { label: 'Vendedor', value: r.salespersonName ?? 'Todos' },
      ],
      columns: this.columns(),
      rows,
      totals: {
        quantity: r.quantity,
        grossAmount: r.grossAmount,
        discountAmount: r.discountAmount,
        netAmount: r.netAmount,
      },
      totalsLabel: 'Sumas',
      fileName: exportFileName(['detalle-producto', r.productCode, r.productName, r.from, r.to]),
    };
  }
}
