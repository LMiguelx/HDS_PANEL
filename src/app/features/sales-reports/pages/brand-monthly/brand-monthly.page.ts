import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { UiField, UiFieldOption } from '../../../../shared/ui/field/field';
import { UiToggle } from '../../../../shared/ui/toggle/toggle';
import { UiCard } from '../../../../shared/ui/card/card';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiExportMenu } from '../../../../shared/ui/export-menu/export-menu';
import { UiLineChart, LineChartSeries } from '../../../../shared/ui/line-chart/line-chart';
import { SalesReportModuleTabs } from '../../ui/module-tabs';
import { SalesReportAdminService } from '../../sales-report-admin';
import { BrandMonthlyReport, BrandMonthlyRow } from '../../../../shared/models/sales-report.models';
import {
  MONTH_SHORT_NAMES,
  formatSolesInt,
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
const TOP_SHARE_COUNT = 5;
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
  imports: [UiField, UiToggle, UiCard, UiEmpty, UiExportMenu, UiLineChart, SalesReportModuleTabs],
  template: `
    <app-sales-report-module-tabs />
    <section class="bm-page">
      <div class="bm-toolbar">
        <ui-field label="Año" type="select" [(value)]="yearStr" [options]="yearOptions()" />
        <ui-field label="Top" type="select" [(value)]="topStr" [options]="topOptions" />
        <div class="bm-compare-wrap">
          <ui-toggle
            [label]="'Comparar con ' + (year() - 1)"
            [(checked)]="compare"
            [disabled]="report()?.previousYearTotalNet == null"
          />
          <span class="bm-compare-hint">
            {{ compare() ? 'Activado' : 'Desactivado' }} · hay datos desde ago {{ MIN_YEAR }}
          </span>
        </div>
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
              <span class="bm-kpi-label">Venta neta del año</span>
              <span class="bm-kpi-value">{{ formatSoles(r.totalNet) }}</span>
              <span class="bm-kpi-sub bm-muted">{{ dateRangeNote() }}</span>
            </div>
            <div class="bm-kpi">
              <span class="bm-kpi-label">Marcas con ventas</span>
              <span class="bm-kpi-value">{{ r.brandCount }}</span>
              <span class="bm-kpi-sub bm-muted">{{ topShareNote(r) }}</span>
            </div>
            <div class="bm-kpi">
              <span class="bm-kpi-label">Marca líder</span>
              <span class="bm-kpi-value">{{ r.brands[0].brandName }}</span>
              <span class="bm-kpi-sub bm-muted">
                {{ r.brands[0].share }}% de la venta
                @if (r.brands[0].peakMonth) {
                  · mes pico: {{ monthShortName(r.brands[0].peakMonth) }}
                }
              </span>
            </div>
          </div>

          <ui-card class="bm-chart-card">
            <div class="bm-chart-head">
              <div>
                <h2 class="bm-chart-title">Venta neta mensual por marca · {{ r.year }}</h2>
                <p class="bm-chart-sub">
                  Para ver qué marcas suben y bajan, y en qué mes comprar más
                </p>
              </div>
              <div class="bm-chart-keys">
                <span class="bm-chart-key"
                  ><span class="bm-chart-key-dot bm-chart-key-peak"></span>Mes pico de cada
                  marca</span
                >
                <span class="bm-chart-key"
                  ><span class="bm-chart-key-dot bm-chart-key-hatch"></span>Mes sin información (la
                  línea se corta, no cae a 0)</span
                >
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
                Mostrando {{ maxChartLines }} de {{ r.brands.length }} marcas · hasta
                {{ maxChartLines }} líneas a la vez
              </p>
            }
          </ui-card>

          <ui-card class="bm-table-card">
            <div class="bm-table-wrap">
              <table class="ui-table-grid bm-table">
                <thead>
                  <tr>
                    <th class="bm-th-sticky">Marca</th>
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
                  @for (b of r.brands; track b.brandId; let i = $index) {
                    <tr>
                      <td class="bm-th-sticky bm-brand-cell" (click)="openBrand(b)">
                        <span class="bm-rank">{{ b.rank }}</span>
                        <span
                          class="bm-dot"
                          [style.background]="'var(' + colorVarFor(i) + ')'"
                        ></span>
                        {{ b.brandName }}
                      </td>
                      @for (m of b.months; track m.month) {
                        <td class="bm-col-right" [class.bm-peak-cell]="m.month === b.peakMonth">
                          {{ formatSolesInt(m.netAmount) }}
                          @if (compare()) {
                            <div class="bm-compare-sub">
                              {{ formatSolesInt(m.previousYearNetAmount) }}
                            </div>
                          }
                        </td>
                      }
                      <td class="bm-col-right bm-cell-strong">{{ formatSoles(b.totalNet) }}</td>
                      <td class="bm-col-right">{{ b.share }}%</td>
                      <td class="bm-muted bm-peak-col">
                        @if (b.peakMonth) {
                          {{ monthShortName(b.peakMonth) }} ·
                          {{ formatSoles(b.peakNetAmount ?? 0) }}
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
            <p class="bm-table-footer">
              Mostrando {{ r.brands.length }} de {{ r.brandCount }} marcas con ventas.
              @if (r.brands.length < r.brandCount) {
                Cambia "Top" a "Todas" para ver el resto.
              }
            </p>
          </ui-card>
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
        gap: 20px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .bm-toolbar ui-field {
        width: 140px;
      }
      .bm-compare-wrap {
        display: grid;
        gap: 2px;
      }
      .bm-compare-hint {
        font-size: 11px;
        color: var(--ink-muted);
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
        grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }
      .bm-kpi {
        border: 1px solid var(--hairline);
        border-radius: var(--radius-card);
        background: var(--surface);
        padding: 14px 16px;
        display: grid;
        gap: 4px;
      }
      .bm-kpi-label {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
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
      .bm-kpi-sub {
        font-size: 12px;
      }
      .bm-muted {
        color: var(--ink-muted);
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
      .bm-chart-card {
        display: block;
        margin-bottom: var(--sp-6);
      }
      .bm-chart-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .bm-chart-title {
        margin: 0;
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        color: var(--ink);
      }
      .bm-chart-sub {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bm-chart-keys {
        display: grid;
        gap: 4px;
        justify-items: end;
        text-align: right;
      }
      .bm-chart-key {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--ink-muted);
        white-space: nowrap;
      }
      .bm-chart-key-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: none;
      }
      .bm-chart-key-peak {
        border: 2px solid var(--accent-ink);
      }
      .bm-chart-key-hatch {
        background: repeating-linear-gradient(
          45deg,
          var(--ink-muted),
          var(--ink-muted) 1px,
          transparent 1px,
          transparent 3px
        );
      }
      .bm-chart-note {
        margin: 10px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .bm-table-card {
        display: block;
      }
      .bm-table-wrap {
        overflow-x: auto;
        margin: -2px -2px 0;
      }
      .bm-table {
        width: 100%;
        background: var(--surface);
      }
      .bm-th-sticky {
        position: sticky;
        left: 0;
        background: var(--surface);
        z-index: 1;
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
      .bm-rank {
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
        width: 14px;
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
      .bm-peak-col {
        white-space: nowrap;
      }
      .bm-peak-cell {
        background: var(--accent-wash);
        font-weight: 800;
        outline: 1px solid var(--accent);
        outline-offset: -1px;
      }
      .bm-compare-sub {
        font-size: 10px;
        color: var(--ink-muted);
        font-weight: 400;
      }
      .bm-table-footer {
        margin: 12px 2px 0;
        font-size: 12px;
        color: var(--ink-muted);
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
  protected readonly MIN_YEAR = MIN_YEAR;
  protected formatSoles = formatSoles;
  protected formatSolesInt = formatSolesInt;
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

  protected canExport = computed(
    () => !this.loading() && !this.error() && (this.report()?.brands.length ?? 0) > 0,
  );

  protected chartSeries = computed<LineChartSeries[]>(() => {
    const r = this.report();
    if (!r) return [];
    return r.brands.slice(0, MAX_CHART_LINES).map((b, i) => ({
      key: String(b.brandId),
      name: b.brandName,
      colorVar: this.colorVarFor(i),
      peakIndex: b.peakMonth != null ? b.peakMonth - 1 : null,
      points: b.months.map((m) => ({
        label: MONTH_SHORT_NAMES[m.month - 1],
        value: m.netAmount,
        compareValue: m.previousYearNetAmount,
      })),
    }));
  });

  protected colorVarFor(index: number): string {
    return CHART_COLOR_VARS[index % CHART_COLOR_VARS.length];
  }

  /** "Enero – Nov · diciembre sin información" — doc 93, sección 0: nunca calcular esto como 0. */
  protected dateRangeNote(): string {
    const r = this.report();
    if (!r || r.brands.length === 0) return '';
    const months = r.brands[0].months;
    let lastWithData = -1;
    for (let i = 0; i < months.length; i++) {
      if (months[i].netAmount != null) lastWithData = i;
    }
    if (lastWithData < 0) return 'Sin información este año';
    const missing = months.slice(lastWithData + 1).map((m) => this.monthShortName(m.month));
    const range = `Enero – ${this.monthShortName(lastWithData + 1)}`;
    return missing.length > 0 ? `${range} · ${missing.join('/')} sin información` : range;
  }

  /** "Las 5 primeras suman 68.4% de la venta" — doc 93: participación ya viene del backend, solo se suma. */
  protected topShareNote(r: BrandMonthlyReport): string {
    const count = Math.min(TOP_SHARE_COUNT, r.brands.length);
    const sum = r.brands.slice(0, count).reduce((acc, b) => acc + b.share, 0);
    return `Las ${count} primeras suman ${Math.round(sum * 10) / 10}% de la venta`;
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
