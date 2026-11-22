import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { UiField, UiFieldOption } from '../../../../shared/ui/field/field';
import { UiToggle } from '../../../../shared/ui/toggle/toggle';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiExportMenu } from '../../../../shared/ui/export-menu/export-menu';
import { UiLineChart, LineChartSeries } from '../../../../shared/ui/line-chart/line-chart';
import { SalesReportModuleTabs } from '../../ui/module-tabs';
import { SalesReportAdminService } from '../../sales-report-admin';
import { BrandMonthlyReport, BrandMonthlyRow } from '../../../../shared/models/sales-report.models';
import {
  MONTH_SHORT_NAMES,
  variationPctText,
  variationTone,
} from '../../domain/brand-monthly.format';
import { brandMonthlyColumns } from '../../domain/brand-monthly.columns';
import { formatSoles } from '../../../../shared/pipes/money';
import { TableExporter } from '../../../../shared/utils/export/table-exporter.service';
import { ExportFormat, ExportTable } from '../../../../shared/utils/export/export.models';
import { exportFileName } from '../../../../shared/utils/export/export-file-name';
import { ToastService } from '../../../../core/ui/toast';

const MIN_YEAR = 2025; // doc 93, sección 0: historial desde agosto de 2025
const TOP_OPTIONS: UiFieldOption[] = [
  { value: '5', label: 'Top 5' },
  { value: '10', label: 'Top 10' },
  { value: '20', label: 'Top 20' },
  { value: '', label: 'Todas' },
];
const MAX_CHART_LINES = 10;
const CHART_COLOR_VARS = [
  '--chart-series-1',
  '--chart-series-2',
  '--chart-series-3',
  '--chart-series-4',
  '--chart-series-5',
  '--chart-series-6',
];

/** Pantalla 1 de "Marcas por mes" — doc 93, sección 3.6. */
@Component({
  selector: 'app-brand-monthly-page',
  imports: [UiField, UiToggle, UiEmpty, UiExportMenu, UiLineChart, SalesReportModuleTabs],
  template: `
    <app-sales-report-module-tabs />
    <section class="bm-page">
      <div class="bm-toolbar">
        <ui-field label="Año" type="select" [(value)]="yearStr" [options]="yearOptions()" />
        <ui-field label="Top" type="select" [(value)]="topStr" [options]="topOptions" />
        @if (report()?.previousYearTotalNet != null) {
          <ui-toggle
            [label]="'Comparar con ' + (year() - 1)"
            [(checked)]="compare"
            class="bm-compare-toggle"
          />
        }
        <ui-export-menu
          class="bm-export"
          [disabled]="!canExport()"
          [busy]="exporting()"
          (export)="onExport($event)"
        />
      </div>

      @if (loading()) {
        <div class="bm-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el reporte"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (report(); as r) {
        @if (r.brands.length === 0) {
          <ui-empty [title]="'No hay ventas registradas en ' + r.year" />
        } @else {
          <div class="bm-kpi-row">
            <div class="bm-kpi">
              <span class="bm-kpi-value">{{ formatSoles(r.totalNet) }}</span>
              <span class="bm-kpi-label">Venta neta del año</span>
              @if (compare() && r.previousYearTotalNet != null) {
                <span
                  class="bm-kpi-sub"
                  [class]="'bm-tone-' + variationTone(r.totalNet, r.previousYearTotalNet)"
                >
                  {{ variationPctText(r.totalNet, r.previousYearTotalNet) }} vs {{ year() - 1 }}
                </span>
              }
            </div>
            <div class="bm-kpi">
              <span class="bm-kpi-value">{{ r.brandCount }}</span>
              <span class="bm-kpi-label">Marcas con ventas</span>
            </div>
            <div class="bm-kpi">
              <span class="bm-kpi-value">{{ r.brands[0].brandName }}</span>
              <span class="bm-kpi-label">Marca líder · {{ r.brands[0].share }}%</span>
            </div>
          </div>

          <ui-line-chart
            [series]="chartSeries()"
            [height]="280"
            [valueFormatter]="formatSoles"
            [showCompare]="compare()"
            [compareLabel]="String(year() - 1)"
          />
          @if (r.brands.length > maxChartLines) {
            <p class="bm-chart-note">
              Mostrando las primeras {{ maxChartLines }} marcas del gráfico. Activa o desactiva
              desde la tabla.
            </p>
          }

          <div class="bm-table-wrap">
            <table class="ui-table-grid bm-table">
              <thead>
                <tr>
                  @if (r.brands.length > maxChartLines) {
                    <th class="bm-th-sticky bm-th-check"></th>
                  }
                  <th class="bm-th-sticky">#</th>
                  <th class="bm-th-sticky bm-th-brand">Marca</th>
                  @for (m of monthNames; track m) {
                    <th class="bm-col-right">{{ m }}</th>
                  }
                  <th class="bm-col-right">Total</th>
                  <th class="bm-col-right">%</th>
                  <th>Pico</th>
                  @if (compare()) {
                    <th class="bm-col-right">vs {{ year() - 1 }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (b of r.brands; track b.brandId) {
                  <tr>
                    @if (r.brands.length > maxChartLines) {
                      <td class="bm-td-sticky bm-th-check">
                        <input
                          type="checkbox"
                          [checked]="chartVisible().has(b.brandId)"
                          (change)="toggleChartVisible(b.brandId)"
                        />
                      </td>
                    }
                    <td class="bm-td-sticky">{{ b.rank }}</td>
                    <td class="bm-td-sticky bm-brand-cell" (click)="openBrand(b)">
                      <span
                        class="bm-dot"
                        [style.background]="'var(' + colorVarFor(b, r) + ')'"
                      ></span>
                      {{ b.brandName }}
                    </td>
                    @for (m of b.months; track m.month) {
                      <td class="bm-col-right" [class.bm-peak-cell]="m.month === b.peakMonth">
                        {{ m.netAmount != null ? formatSoles(m.netAmount) : '—' }}
                        @if (compare()) {
                          <div class="bm-compare-sub">
                            {{
                              m.previousYearNetAmount != null
                                ? formatSoles(m.previousYearNetAmount)
                                : '—'
                            }}
                          </div>
                        }
                      </td>
                    }
                    <td class="bm-col-right bm-cell-strong">{{ formatSoles(b.totalNet) }}</td>
                    <td class="bm-col-right">{{ b.share }}%</td>
                    <td class="bm-muted">
                      @if (b.peakMonth) {
                        {{ monthShortName(b.peakMonth) }} · {{ formatSoles(b.peakNetAmount ?? 0) }}
                      } @else {
                        —
                      }
                    </td>
                    @if (compare()) {
                      <td
                        class="bm-col-right"
                        [class]="'bm-tone-' + variationTone(b.totalNet, b.previousYearTotalNet)"
                      >
                        {{ variationPctText(b.totalNet, b.previousYearTotalNet) }}
                      </td>
                    }
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
      .bm-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .bm-toolbar {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .bm-toolbar ui-field {
        width: 140px;
      }
      .bm-compare-toggle {
        margin-bottom: 10px;
      }
      .bm-export {
        margin-left: auto;
      }
      .bm-skeleton {
        height: 320px;
        background: var(--faint);
      }
      .bm-kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }
      .bm-kpi {
        border: 1px solid var(--hairline);
        padding: 14px 16px;
        display: grid;
        gap: 4px;
      }
      .bm-kpi-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
        font-variant-numeric: var(--tnum);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bm-kpi-label {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bm-kpi-sub {
        font-size: 12px;
        font-weight: 700;
      }
      .bm-tone-pos {
        color: var(--status-ok);
      }
      .bm-tone-neg {
        color: var(--status-danger);
      }
      .bm-tone-neutral {
        color: var(--ink-muted);
      }
      .bm-chart-note {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bm-table-wrap {
        overflow-x: auto;
        margin-top: 20px;
      }
      .bm-table {
        width: 100%;
      }
      .bm-th-sticky,
      .bm-td-sticky {
        position: sticky;
        left: 0;
        background: var(--surface);
        z-index: 1;
      }
      .bm-th-check {
        left: 0;
        width: 28px;
      }
      thead .bm-th-sticky {
        z-index: 2;
      }
      .bm-brand-cell {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        white-space: nowrap;
      }
      .bm-brand-cell:hover {
        text-decoration: underline;
      }
      .bm-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: none;
      }
      .bm-col-right {
        text-align: right;
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .bm-cell-strong {
        font-weight: 800;
      }
      .bm-muted {
        color: var(--ink-muted);
        font-size: 13px;
        white-space: nowrap;
      }
      .bm-peak-cell {
        background: var(--accent-wash);
        font-weight: 800;
      }
      .bm-compare-sub {
        font-size: 10px;
        color: var(--ink-muted);
        font-weight: 400;
      }

      @media (max-width: 767px) {
        .bm-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class BrandMonthlyPage {
  private reportSvc = inject(SalesReportAdminService);
  private exporter = inject(TableExporter);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected String = String;
  protected formatSoles = formatSoles;
  protected variationPctText = variationPctText;
  protected variationTone = variationTone;
  protected monthNames = MONTH_SHORT_NAMES;
  protected monthShortName = (m: number) => MONTH_SHORT_NAMES[m - 1];
  protected maxChartLines = MAX_CHART_LINES;
  protected topOptions = TOP_OPTIONS;

  protected yearStr = signal(String(new Date().getFullYear()));
  protected topStr = signal('10');
  protected compare = signal(false);
  protected year = computed(() => Number(this.yearStr()));

  protected yearOptions = computed<UiFieldOption[]>(() => {
    const currentYear = new Date().getFullYear();
    const years: UiFieldOption[] = [];
    for (let y = currentYear; y >= MIN_YEAR; y--) {
      years.push({ value: String(y), label: String(y) });
    }
    return years;
  });

  protected report = signal<BrandMonthlyReport | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected exporting = signal(false);

  protected chartVisible = signal<Set<number>>(new Set());

  protected canExport = computed(
    () => !this.loading() && !this.error() && (this.report()?.brands.length ?? 0) > 0,
  );

  protected chartSeries = computed<LineChartSeries[]>(() => {
    const r = this.report();
    if (!r) return [];
    const visible =
      r.brands.length > this.maxChartLines
        ? r.brands.filter((b) => this.chartVisible().has(b.brandId))
        : r.brands;
    return visible.map((b) => ({
      key: String(b.brandId),
      name: b.brandName,
      colorVar: this.colorVarFor(b, r),
      peakIndex: b.peakMonth != null ? b.peakMonth - 1 : null,
      points: b.months.map((m) => ({
        label: MONTH_SHORT_NAMES[m.month - 1],
        value: m.netAmount,
        compareValue: m.previousYearNetAmount,
      })),
    }));
  });

  protected colorVarFor(b: BrandMonthlyRow, r: BrandMonthlyReport): string {
    const idx = r.brands.findIndex((x) => x.brandId === b.brandId);
    return CHART_COLOR_VARS[idx % CHART_COLOR_VARS.length];
  }

  protected toggleChartVisible(brandId: number) {
    this.chartVisible.update((set) => {
      const next = new Set(set);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  }

  private loadEffect = effect(() => {
    this.yearStr();
    this.topStr();
    untracked(() => this.load());
  });

  protected openBrand(b: BrandMonthlyRow) {
    this.router.navigate(['/reportes-ventas/marcas-por-mes', b.brandId], {
      queryParams: { year: this.yearStr() },
    });
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    const top = this.topStr() ? Number(this.topStr()) : undefined;
    this.reportSvc.brandMonthly(this.year(), top).subscribe({
      next: (result) => {
        this.report.set(result);
        this.loading.set(false);
        const defaultVisible = result.brands.slice(0, MAX_CHART_LINES).map((b) => b.brandId);
        this.chartVisible.set(new Set(defaultVisible));
        this.compare.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected onExport(format: ExportFormat) {
    const r = this.report();
    if (!r || this.exporting()) return;
    this.exporting.set(true);
    const table = this.buildTable(r);
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

  private buildTable(r: BrandMonthlyReport): ExportTable<BrandMonthlyRow> {
    return {
      title: 'Marcas por mes',
      subtitle: `Año ${r.year}${r.top ? ' · Top ' + r.top : ''}`,
      filters: [
        { label: 'Año', value: String(r.year) },
        { label: 'Top', value: r.top ? String(r.top) : 'Todas' },
      ],
      columns: brandMonthlyColumns(this.compare()),
      rows: r.brands,
      totals: { totalNet: r.totalNet },
      totalsLabel: 'Sumas',
      fileName: exportFileName(['marcas-por-mes', String(r.year)]),
    };
  }
}
