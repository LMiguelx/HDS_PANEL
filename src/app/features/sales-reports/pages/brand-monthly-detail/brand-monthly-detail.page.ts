import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UiField, UiFieldOption } from '../../../../shared/ui/field/field';
import { UiToggle } from '../../../../shared/ui/toggle/toggle';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiExportMenu } from '../../../../shared/ui/export-menu/export-menu';
import { UiLineChart, LineChartSeries } from '../../../../shared/ui/line-chart/line-chart';
import { SalesReportAdminService } from '../../sales-report-admin';
import {
  BrandMonthlyDetail,
  ProductMonthlyRow,
} from '../../../../shared/models/sales-report.models';
import {
  MONTH_SHORT_NAMES,
  peakText,
  variationPctText,
  variationTone,
} from '../../domain/brand-monthly.format';
import { productMonthlyColumns } from '../../domain/brand-monthly.columns';
import { formatSoles } from '../../../../shared/pipes/money';
import { TableExporter } from '../../../../shared/utils/export/table-exporter.service';
import {
  ExportColumn,
  ExportFormat,
  ExportTable,
} from '../../../../shared/utils/export/export.models';
import { exportFileName } from '../../../../shared/utils/export/export-file-name';
import { ToastService } from '../../../../core/ui/toast';

type SortDir = 1 | -1;

/** Pantalla 2 de "Marcas por mes" — doc 93, sección 3.7. */
@Component({
  selector: 'app-brand-monthly-detail-page',
  imports: [RouterLink, UiField, UiToggle, UiEmpty, UiExportMenu, UiLineChart],
  template: `
    <section class="bmd-page">
      @if (loading()) {
        <div class="bmd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar la marca"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (notFound()) {
        <ui-empty
          title="Marca no encontrada o inactiva"
          actionLabel="Volver a Marcas por mes"
          (action)="goBack()"
        />
      } @else if (detail(); as d) {
        <nav class="bmd-breadcrumb">
          <a routerLink="/reportes-ventas/marcas-por-mes">Marcas por mes</a>
          <span> › {{ d.brandName }}</span>
        </nav>

        <div class="bmd-head">
          <h1>{{ d.brandName }}</h1>
          <div class="bmd-head-right">
            <ui-field label="Año" type="select" [(value)]="yearStr" [options]="yearOptions()" />
            <ui-export-menu
              [disabled]="!canExport()"
              [busy]="exporting()"
              (export)="onExport($event)"
            />
          </div>
        </div>

        <div class="bmd-kpi-row">
          <div class="bmd-kpi">
            <span class="bmd-kpi-value">{{ formatSoles(d.totalNet) }}</span>
            <span class="bmd-kpi-label">Venta neta del año</span>
            @if (d.previousYearTotalNet != null) {
              <span
                class="bmd-kpi-sub"
                [class]="'bmd-tone-' + variationTone(d.totalNet, d.previousYearTotalNet)"
              >
                {{ variationPctText(d.totalNet, d.previousYearTotalNet) }} vs {{ year() - 1 }}
              </span>
            }
          </div>
          <div class="bmd-kpi">
            <span class="bmd-kpi-value">{{ d.totalUnits }}</span>
            <span class="bmd-kpi-label">Unidades vendidas</span>
          </div>
          <div class="bmd-kpi">
            <span class="bmd-kpi-value">{{ d.totalBonusUnits }}</span>
            <span class="bmd-kpi-label">Unidades bonificadas</span>
          </div>
          <div class="bmd-kpi">
            <span class="bmd-kpi-value">{{ peakText(d.peakMonth, d.peakNetAmount) }}</span>
            <span class="bmd-kpi-label">Mes pico</span>
          </div>
        </div>

        <ui-line-chart
          [series]="chartSeries()"
          [height]="220"
          [valueFormatter]="formatSoles"
          [showCompare]="d.previousYearTotalNet != null"
          [compareLabel]="String(year() - 1)"
        />

        @if (d.products.length === 0) {
          <ui-empty title="Sin productos" body="Esta marca no tuvo ventas en el año elegido." />
        } @else {
          <div class="bmd-toolbar">
            <ui-field label="Buscar" placeholder="Código o nombre" [(value)]="search" />
            <ui-toggle label="Mostrar en soles" [(checked)]="byAmount" />
          </div>

          <div class="bmd-table-wrap">
            <table class="ui-table-grid bmd-table">
              <thead>
                <tr>
                  <th class="bmd-th-sticky" (click)="setSort('productCode')">Código</th>
                  <th class="bmd-th-sticky bmd-th-name" (click)="setSort('productName')">
                    Producto
                  </th>
                  @for (m of monthNames; track m; let i = $index) {
                    <th class="bmd-col-right" (click)="setSort('month' + (i + 1))">{{ m }}</th>
                  }
                  <th class="bmd-col-right" (click)="setSort('totalUnits')">Unidades</th>
                  <th class="bmd-col-right" (click)="setSort('totalNet')">S/</th>
                  <th class="bmd-col-right" (click)="setSort('totalBonusUnits')">Bonif.</th>
                  <th (click)="setSort('peak')">Pico</th>
                </tr>
              </thead>
              <tbody>
                @for (p of visibleProducts(); track p.productId) {
                  <tr>
                    <td class="bmd-th-sticky bmd-muted">{{ p.productCode }}</td>
                    <td class="bmd-th-sticky bmd-th-name">{{ p.productName }}</td>
                    @for (m of p.months; track m.month) {
                      <td
                        class="bmd-col-right"
                        [class.bmd-peak-cell]="m.month === p.peakMonth"
                        [style.background]="heatBg(p, m)"
                      >
                        @if (byAmount()) {
                          {{ m.netAmount != null ? formatSoles(m.netAmount) : '—' }}
                        } @else {
                          {{ m.units != null ? m.units : '—' }}
                          @if ((m.bonusUnits ?? 0) > 0) {
                            <div class="bmd-bonus-sub">+{{ m.bonusUnits }} bonif.</div>
                          }
                        }
                      </td>
                    }
                    <td class="bmd-col-right bmd-cell-strong">{{ p.totalUnits }}</td>
                    <td class="bmd-col-right">{{ formatSoles(p.totalNet) }}</td>
                    <td class="bmd-col-right" [class.bmd-muted]="p.totalBonusUnits === 0">
                      {{ p.totalBonusUnits }}
                    </td>
                    <td class="bmd-muted">
                      @if (p.peakMonth) {
                        {{ monthShortName(p.peakMonth) }} · {{ p.peakUnits }} u.
                      } @else {
                        —
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .bmd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .bmd-skeleton {
        height: 320px;
        background: var(--faint);
      }
      .bmd-breadcrumb {
        font-size: 13px;
        color: var(--ink-muted);
        margin-bottom: 10px;
      }
      .bmd-breadcrumb a {
        color: var(--ink-muted);
        text-decoration: none;
      }
      .bmd-breadcrumb a:hover {
        text-decoration: underline;
      }
      .bmd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }
      .bmd-head-right {
        display: flex;
        align-items: flex-end;
        gap: 12px;
      }
      .bmd-head-right ui-field {
        width: 110px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .bmd-kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
        gap: 14px;
        margin: 20px 0;
      }
      .bmd-kpi {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
        display: grid;
        gap: 4px;
      }
      .bmd-kpi-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .bmd-kpi-label {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bmd-kpi-sub {
        font-size: 12px;
        font-weight: 700;
      }
      .bmd-tone-pos {
        color: var(--status-ok);
      }
      .bmd-tone-neg {
        color: var(--status-danger);
      }
      .bmd-tone-neutral {
        color: var(--ink-muted);
      }
      .bmd-toolbar {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        flex-wrap: wrap;
        margin: 24px 0 16px;
      }
      .bmd-toolbar ui-field {
        width: 220px;
      }
      .bmd-table-wrap {
        overflow-x: auto;
      }
      .bmd-table {
        width: 100%;
      }
      .bmd-table th {
        cursor: pointer;
      }
      .bmd-th-sticky {
        position: sticky;
        left: 0;
        background: var(--surface);
        z-index: 1;
      }
      thead .bmd-th-sticky {
        z-index: 2;
      }
      .bmd-th-name {
        left: 72px;
      }
      .bmd-col-right {
        text-align: right;
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .bmd-cell-strong {
        font-weight: 800;
      }
      .bmd-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .bmd-peak-cell {
        font-weight: 800;
        outline: 1px solid var(--accent);
        outline-offset: -1px;
      }
      .bmd-bonus-sub {
        font-size: 10px;
        color: var(--ink-muted);
        font-weight: 400;
      }

      @media (max-width: 767px) {
        .bmd-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class BrandMonthlyDetailPage {
  private reportSvc = inject(SalesReportAdminService);
  private exporter = inject(TableExporter);
  private toast = inject(ToastService);
  private router = inject(Router);

  brandId = input('', { alias: 'brandId' });
  yearParam = input('', { alias: 'year' });

  protected String = String;
  protected formatSoles = formatSoles;
  protected variationPctText = variationPctText;
  protected variationTone = variationTone;
  protected peakText = peakText;
  protected monthNames = MONTH_SHORT_NAMES;
  protected monthShortName = (m: number) => MONTH_SHORT_NAMES[m - 1];

  protected yearStr = signal(String(new Date().getFullYear()));
  protected year = computed(() => Number(this.yearStr()));
  protected yearOptions = computed<UiFieldOption[]>(() => {
    const currentYear = new Date().getFullYear();
    const years: UiFieldOption[] = [];
    for (let y = currentYear; y >= 2025; y--) years.push({ value: String(y), label: String(y) });
    return years;
  });

  protected search = signal('');
  protected byAmount = signal(false);
  protected sortKey = signal('totalNet');
  protected sortDir = signal<SortDir>(-1);

  protected detail = signal<BrandMonthlyDetail | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected notFound = signal(false);
  protected exporting = signal(false);

  protected canExport = computed(
    () => !this.loading() && !this.error() && (this.detail()?.products.length ?? 0) > 0,
  );

  protected chartSeries = computed<LineChartSeries[]>(() => {
    const d = this.detail();
    if (!d) return [];
    return [
      {
        key: 'brand',
        name: d.brandName,
        colorVar: '--chart-series-1',
        peakIndex: d.peakMonth != null ? d.peakMonth - 1 : null,
        points: d.months.map((m) => ({
          label: MONTH_SHORT_NAMES[m.month - 1],
          value: m.netAmount,
          compareValue: m.previousYearNetAmount,
        })),
      },
    ];
  });

  private sortedProducts = computed(() => {
    const d = this.detail();
    if (!d) return [];
    const cols = productMonthlyColumns(!this.byAmount());
    const col = cols.find((c) => c.key === this.sortKey());
    const dir = this.sortDir();
    if (!col) return d.products;
    return [...d.products].sort((a, b) => {
      const va = col.value(a, 0);
      const vb = col.value(b, 0);
      if (typeof va === 'string' || typeof vb === 'string') {
        return dir * String(va ?? '').localeCompare(String(vb ?? ''));
      }
      const na = va == null ? -Infinity : Number(va);
      const nb = vb == null ? -Infinity : Number(vb);
      return dir * (na - nb);
    });
  });

  protected visibleProducts = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.sortedProducts();
    return this.sortedProducts().filter(
      (p) => p.productCode.toLowerCase().includes(q) || p.productName.toLowerCase().includes(q),
    );
  });

  private rowMax(p: ProductMonthlyRow): number {
    const values = p.months.map((m) => (this.byAmount() ? (m.netAmount ?? 0) : (m.units ?? 0)));
    return Math.max(...values, 1);
  }

  protected heatBg(p: ProductMonthlyRow, m: ProductMonthlyRow['months'][number]): string {
    const value = this.byAmount() ? (m.netAmount ?? 0) : (m.units ?? 0);
    if (value <= 0) return '';
    const pct = Math.round((value / this.rowMax(p)) * 36);
    return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
  }

  protected setSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 1 ? -1 : 1) as SortDir);
    } else {
      this.sortKey.set(key);
      this.sortDir.set(-1);
    }
  }

  private loadEffect = effect(() => {
    this.brandId();
    this.yearStr();
    untracked(() => this.load());
  });

  private seedYearEffect = effect(() => {
    const y = this.yearParam();
    untracked(() => {
      if (y) this.yearStr.set(y);
    });
  });

  protected goBack() {
    this.router.navigate(['/reportes-ventas/marcas-por-mes']);
  }

  load() {
    const brandId = Number(this.brandId());
    if (!brandId) return;
    this.loading.set(true);
    this.error.set(false);
    this.notFound.set(false);
    this.reportSvc.brandMonthlyDetail(brandId, this.year()).subscribe({
      next: (result) => {
        this.detail.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) this.notFound.set(true);
        else this.error.set(true);
      },
    });
  }

  protected onExport(format: ExportFormat) {
    const d = this.detail();
    if (!d || this.exporting()) return;
    this.exporting.set(true);
    const table = this.buildTable(d);
    this.exporter
      .export(table, format)
      .then(() => {
        this.exporting.set(false);
        this.toast.success(`Archivo descargado: ${table.fileName}.${format}`);
      })
      .catch((err: unknown) => {
        this.exporting.set(false);
        const message =
          err instanceof Error ? err.message : 'No pudimos generar el archivo. Intenta de nuevo.';
        this.toast.error(message);
      });
  }

  private buildTable(d: BrandMonthlyDetail): ExportTable<ProductMonthlyRow> {
    const columns: ExportColumn<ProductMonthlyRow>[] = productMonthlyColumns(!this.byAmount());
    return {
      title: 'Marcas por mes — detalle',
      subtitle: `${d.brandName} — ${d.year}`,
      filters: [
        { label: 'Marca', value: d.brandName },
        { label: 'Año', value: String(d.year) },
      ],
      columns,
      rows: this.visibleProducts(),
      totals: {
        totalUnits: d.totalUnits,
        totalNet: d.totalNet,
        totalBonusUnits: d.totalBonusUnits,
      },
      totalsLabel: 'Sumas',
      fileName: exportFileName(['marcas-por-mes-detalle', d.brandName, String(d.year)]),
    };
  }
}
