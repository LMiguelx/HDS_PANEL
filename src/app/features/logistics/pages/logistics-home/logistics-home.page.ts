import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, fromEvent, interval, merge, of } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../../../../core/auth/auth';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiCard } from '../../../../shared/ui/card/card';
import { UiLineChart, LineChartSeries } from '../../../../shared/ui/line-chart/line-chart';
import { LogisticsApi } from '../../data-access/logistics.api';
import { LogisticsDashboardView } from '../../domain/logistics.models';
import {
  batchesNotReadyLevel,
  erpStockDetailText,
  erpStockLevel,
  erpStockTimeText,
  negativeProductsLevel,
  receiptsInReviewLevel,
  receiptsNotTakenLevel,
  relativeTimeText,
  shortDateTimeText,
} from '../../domain/logistics.format';
import { LogisticsAlertCard } from '../../ui/alert-card';
import { LogisticsPickingDayCard } from '../../ui/picking-day-card';
import { LogisticsShortfallCard } from '../../ui/shortfall-card';
import { LogisticsReturnsDayCard } from '../../ui/returns-day-card';
import { SalesReportAdminService } from '../../../sales-reports';
import { BrandMonthlyReport } from '../../../../shared/models/sales-report.models';
import { formatSoles } from '../../../../shared/pipes/money';

const MONTH_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];
const CHART_COLOR_VARS = [
  '--chart-series-1',
  '--chart-series-2',
  '--chart-series-3',
  '--chart-series-4',
  '--chart-series-5',
  '--chart-series-6',
];
const REFRESH_MS = 300_000; // 5 min — doc 93, sección 2.8

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Inicio de logística — doc 93, sección 2. Dos llamadas independientes
 * (avisos/picking/devoluciones y gráfico de marcas); cada una resuelve sus
 * estados por separado, para que una no tumbe a la otra.
 */
@Component({
  selector: 'app-logistics-home',
  imports: [
    RouterLink,
    UiButton,
    UiEmpty,
    UiCard,
    UiLineChart,
    LogisticsAlertCard,
    LogisticsPickingDayCard,
    LogisticsShortfallCard,
    LogisticsReturnsDayCard,
  ],
  template: `
    <section class="lgh-page">
      <div class="lgh-head">
        <div>
          <h1>{{ greeting() }}{{ user()?.fullName ? ', ' + user()?.fullName : '' }}</h1>
          <p class="lgh-sub">Resumen del día de un vistazo</p>
        </div>
        <div class="lgh-head-right">
          @if (data(); as d) {
            <span class="lgh-warehouse">{{ d.warehouseName }} · {{ dateDisplay(d.date) }}</span>
          }
          @if (updatedAt(); as u) {
            <span class="lgh-updated">Actualizado {{ relativeTimeText(u.toISOString()) }}</span>
          }
          <button
            uiButton
            variant="ghost"
            size="sm"
            [loading]="refreshing()"
            (click)="refreshNow()"
          >
            <span class="material-icons" aria-hidden="true">refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      @if (dashboardLoading() && !data()) {
        <div class="lgh-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (dashboardError() && !data()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el Inicio de logística"
          actionLabel="Reintentar"
          (action)="loadDashboard()"
        />
      } @else if (data(); as d) {
        @if (hasAnyAlert(d)) {
          <div class="lgh-block">
            <h2 class="lgh-block-title">Avisos importantes</h2>
            <p class="lgh-block-sub">Lo que necesita tu atención hoy · haz clic para resolverlo</p>
            <div class="lgh-alerts-grid">
              @if (d.alerts.batchesNotReady != null) {
                <app-logistics-alert-card
                  [value]="d.alerts.batchesNotReady"
                  label="Planillas que no pueden salir"
                  detail="Picking sin cerrar"
                  icon="local_shipping"
                  [level]="batchesNotReadyLevel(d.alerts.batchesNotReady)"
                  [route]="['/reparto/picking']"
                  [queryParams]="{ date: d.date, onlyPending: 'true' }"
                />
              }
              @if (d.alerts.negativeProducts != null) {
                <app-logistics-alert-card
                  [value]="d.alerts.negativeProducts"
                  label="Productos en negativo"
                  detail="Ventas de hoy sin stock del ERP"
                  icon="trending_down"
                  [level]="negativeProductsLevel(d.alerts.negativeProducts)"
                  [route]="['/reportes-ventas/validacion-stock']"
                  [queryParams]="{
                    tab: 'negativos',
                    date: d.date,
                    warehouseId: String(d.warehouseId),
                  }"
                />
              }
              @if (d.alerts.receiptsInReview; as a) {
                <app-logistics-alert-card
                  [value]="a.count"
                  label="Entregas por revisar"
                  [detail]="'La más antigua: ' + relativeTimeText(a.oldestAt)"
                  icon="visibility"
                  [level]="receiptsInReviewLevel(a)"
                  [route]="['/recepcion-mercaderia/entregas']"
                  [queryParams]="{ statusCode: 'IN_REVIEW' }"
                />
              }
              @if (d.alerts.receiptsNotTakenByErp; as a) {
                <app-logistics-alert-card
                  [value]="a.count"
                  label="Entregas sin tomar por el ERP"
                  [detail]="'Confirmada ' + relativeTimeText(a.oldestAt)"
                  icon="schedule"
                  [level]="receiptsNotTakenLevel(a)"
                  [route]="['/recepcion-mercaderia/entregas']"
                  [queryParams]="{ statusCode: 'CONFIRMED', erpTaken: 'false' }"
                />
              }
              @if (d.alerts.erpStock; as a) {
                <app-logistics-alert-card
                  [value]="erpStockTimeText(a)"
                  label="Stock del ERP"
                  [detail]="erpStockDetailText(a)"
                  icon="dns"
                  [level]="erpStockLevel(a)"
                  [route]="['/inventario/cuadre']"
                />
              }
            </div>
          </div>
        }

        <div class="lgh-main-grid" [class.lgh-grid-single]="!d.picking && !canSeeBrandChart()">
          @if (d.picking; as p) {
            <div class="lgh-side-col">
              <app-logistics-picking-day-card [picking]="p" />
              <app-logistics-shortfall-card [picking]="p" />
            </div>
          }

          @if (canSeeBrandChart()) {
            <ui-card class="lgh-chart-col">
              <div class="lgh-chart-head">
                <div>
                  <h2 class="lgh-block-title">Marcas más vendidas · {{ currentYear }}</h2>
                  <p class="lgh-block-sub">Las 3 marcas con mayor venta neta, mes a mes</p>
                </div>
                <a routerLink="/reportes-ventas/marcas-por-mes" class="lgh-chart-link"
                  >Ver reporte completo →</a
                >
              </div>
              @if (brandLoading() && !brandReport()) {
                <div class="lgh-chart-skeleton" role="status" aria-label="Cargando"></div>
              } @else if (brandError() && !brandReport()) {
                <ui-empty
                  variant="error"
                  title="No pudimos cargar las marcas más vendidas"
                  actionLabel="Reintentar"
                  (action)="loadBrandChart()"
                />
              } @else if (brandReport(); as r) {
                @if (r.brands.length === 0) {
                  <ui-empty title="Sin ventas registradas en {{ r.year }}" />
                } @else {
                  <ui-line-chart
                    [series]="chartSeries()"
                    [height]="230"
                    [valueFormatter]="formatSoles"
                    [legend]="false"
                  />
                  <table class="ui-table-grid lgh-legend-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Marca</th>
                        <th>Venta del año</th>
                        <th>Participación</th>
                        <th>Mes pico</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (b of r.brands; track b.brandId) {
                        <tr
                          class="lgh-legend-row"
                          [routerLink]="['/reportes-ventas/marcas-por-mes', b.brandId]"
                        >
                          <td>{{ b.rank }}</td>
                          <td class="lgh-legend-brand">
                            <span
                              class="lgh-legend-dot"
                              [style.background]="'var(' + colorVarFor(b.rank) + ')'"
                            ></span>
                            {{ b.brandName }}
                          </td>
                          <td class="lgh-num">{{ formatSoles(b.totalNet) }}</td>
                          <td class="lgh-num">{{ b.share }}%</td>
                          <td class="lgh-muted">
                            @if (b.peakMonth) {
                              {{ MONTH_SHORT[b.peakMonth - 1] }} ·
                              {{ formatSoles(b.peakNetAmount ?? 0) }}
                            } @else {
                              —
                            }
                          </td>
                          <td class="lgh-muted">›</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              }
            </ui-card>
          }
        </div>

        @if (d.returns; as r) {
          <app-logistics-returns-day-card [returns]="r" class="lgh-returns-full" />
        }
      }
    </section>
  `,
  styles: [
    `
      .lgh-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .lgh-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .lgh-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .lgh-head-right {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .lgh-warehouse {
        font-size: var(--fs-label, 11px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .lgh-updated {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .lgh-skeleton {
        height: 420px;
        background: var(--faint);
        margin-top: 18px;
      }
      .lgh-block {
        margin-top: 20px;
      }
      .lgh-block-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .lgh-block-sub {
        margin: 2px 0 12px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .lgh-alerts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 12px;
      }
      .lgh-main-grid {
        display: grid;
        grid-template-columns: 330px 1fr;
        gap: var(--sp-6);
        margin-top: 24px;
        align-items: stretch;
      }
      /* sección 2.1: "la columna izquierda ocupa el ancho" sin el gráfico de marcas. */
      .lgh-main-grid.lgh-grid-single {
        grid-template-columns: 1fr;
      }
      .lgh-side-col {
        display: grid;
        gap: var(--sp-5);
        align-content: start;
      }
      .lgh-chart-col {
        display: block;
        min-width: 0;
      }
      .lgh-chart-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .lgh-returns-full {
        display: block;
        margin-top: var(--sp-6);
      }
      .lgh-chart-link {
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
        text-decoration: none;
        white-space: nowrap;
      }
      .lgh-chart-link:hover {
        text-decoration: underline;
      }
      .lgh-chart-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .lgh-legend-table {
        width: 100%;
        margin-top: 14px;
      }
      .lgh-legend-row {
        cursor: pointer;
      }
      .lgh-legend-row:hover {
        background: var(--faint);
      }
      .lgh-legend-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .lgh-legend-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: none;
      }
      .lgh-num {
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .lgh-muted {
        color: var(--ink-muted);
      }

      @media (max-width: 1200px) {
        .lgh-main-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 767px) {
        .lgh-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class LogisticsHomePage {
  private api = inject(LogisticsApi);
  private reportSvc = inject(SalesReportAdminService);
  private auth = inject(AuthService);

  readonly user = this.auth.currentUser;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly MONTH_SHORT = MONTH_SHORT;

  protected String = String;
  protected formatSoles = formatSoles;
  protected relativeTimeText = relativeTimeText;
  protected batchesNotReadyLevel = batchesNotReadyLevel;
  protected negativeProductsLevel = negativeProductsLevel;
  protected receiptsInReviewLevel = receiptsInReviewLevel;
  protected receiptsNotTakenLevel = receiptsNotTakenLevel;
  protected erpStockLevel = erpStockLevel;
  protected erpStockTimeText = erpStockTimeText;
  protected erpStockDetailText = erpStockDetailText;

  protected canSeeBrandChart = computed(() => this.auth.hasAny('order.view_all', 'report.sales'));

  protected data = signal<LogisticsDashboardView | null>(null);
  protected dashboardLoading = signal(true);
  protected dashboardError = signal(false);
  protected updatedAt = signal<Date | null>(null);
  protected refreshing = signal(false);

  protected brandReport = signal<BrandMonthlyReport | null>(null);
  protected brandLoading = signal(true);
  protected brandError = signal(false);

  private manualRefresh$ = new Subject<void>();

  protected greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  protected dateDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  protected hasAnyAlert(d: LogisticsDashboardView): boolean {
    const a = d.alerts;
    return (
      a.batchesNotReady != null ||
      a.negativeProducts != null ||
      a.receiptsInReview != null ||
      a.receiptsNotTakenByErp != null ||
      a.erpStock != null
    );
  }

  protected colorVarFor(rank: number): string {
    return CHART_COLOR_VARS[(rank - 1) % CHART_COLOR_VARS.length];
  }

  protected chartSeries = computed<LineChartSeries[]>(() => {
    const r = this.brandReport();
    if (!r) return [];
    return r.brands.map((b) => ({
      key: String(b.brandId),
      name: b.brandName,
      colorVar: this.colorVarFor(b.rank),
      peakIndex: b.peakMonth != null ? b.peakMonth - 1 : null,
      points: b.months.map((m) => ({
        label: MONTH_SHORT[m.month - 1],
        value: m.netAmount,
      })),
    }));
  });

  constructor() {
    merge(
      this.manualRefresh$,
      interval(REFRESH_MS).pipe(filter(() => document.visibilityState === 'visible')),
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible'),
      ),
    )
      .pipe(
        switchMap(() => this.fetchDashboard()),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.loadDashboard();
    if (this.canSeeBrandChart()) this.loadBrandChart();
  }

  protected refreshNow() {
    if (this.refreshing()) return;
    this.manualRefresh$.next();
  }

  loadDashboard() {
    this.fetchDashboard().subscribe();
  }

  private fetchDashboard() {
    this.refreshing.set(true);
    if (!this.data()) this.dashboardLoading.set(true);
    return this.api.dashboard().pipe(
      tap((result) => {
        this.data.set(result);
        this.dashboardError.set(false);
        this.updatedAt.set(new Date(result.generatedAt));
        this.dashboardLoading.set(false);
        this.refreshing.set(false);
      }),
      catchError(() => {
        this.dashboardLoading.set(false);
        this.dashboardError.set(true);
        this.refreshing.set(false);
        return of(null);
      }),
    );
  }

  loadBrandChart() {
    this.brandLoading.set(true);
    this.brandError.set(false);
    this.reportSvc
      .brandMonthly(this.currentYear, 3)
      .pipe(
        map((r) => r),
        catchError(() => {
          this.brandLoading.set(false);
          this.brandError.set(true);
          return of(null);
        }),
      )
      .subscribe((r) => {
        if (r) {
          this.brandReport.set(r);
          this.brandLoading.set(false);
        }
      });
  }
}
