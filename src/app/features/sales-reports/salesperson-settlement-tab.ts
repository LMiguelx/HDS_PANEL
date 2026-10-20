import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { SalesReportModuleTabs } from './ui/module-tabs';
import { SalesReportAdminService } from './sales-report-admin';
import {
  SalespersonSettlementReport,
  SalespersonSettlementRow,
} from '../../shared/models/sales-report.models';
import { dateText, timeText } from '../assignments/assignment-format';
import { weightText } from './sales-report-format';
import { formatSoles } from '../../shared/pipes/money';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ORIGIN_FILTER_OPTIONS: UiFieldOption[] = [
  { value: '', label: 'Todos' },
  { value: 'FIELD', label: 'Campo' },
  { value: 'TELESALES', label: 'Televentas' },
  { value: 'COUNTER', label: 'Mostrador' },
];

/**
 * Liquidación de vendedores — GET /orders/reports/salesperson-settlement.
 * Un solo día (from = to) trae una fila por vendedor; un rango trae una
 * fila por vendedor y por día (máximo 31 días entre from y to). Doc 30,
 * sección 11.1: separa venta de campo y de mostrador por fila.
 */
@Component({
  selector: 'app-salesperson-settlement-tab',
  imports: [UiField, UiEmpty, SalesReportModuleTabs],
  template: `
    <app-sales-report-module-tabs />
    <section class="sst-page">
      <div class="sst-toolbar">
        <ui-field label="Desde" type="date" [(value)]="from" />
        <ui-field label="Hasta" type="date" [(value)]="to" hint='Máximo 31 días desde "Desde"' />
        <ui-field label="Origen" type="select" [(value)]="originFilter" [options]="originOptions" />
      </div>

      @if (loading()) {
        <div class="sst-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar la liquidación"
          body="{{ error() }}"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (report(); as r) {
        @if (r.rows.length === 0) {
          <ui-empty title="Sin pedidos" body="No hubo pedidos en el rango elegido." />
        } @else {
          @if (isSingleDay()) {
            <div class="sst-bar-chart">
              @for (row of sortedRows(r); track row.salespersonId) {
                <div class="sst-bar-row">
                  <span class="sst-bar-label">{{ row.salespersonName }}</span>
                  <div class="sst-bar-track">
                    @if (showFieldCols()) {
                      <div
                        class="sst-bar-fill sst-bar-fill-field"
                        [style.width.%]="barPct(r, row.fieldNetAmount)"
                      ></div>
                    }
                    @if (showTelesalesCols()) {
                      <div
                        class="sst-bar-fill sst-bar-fill-telesales"
                        [style.width.%]="barPct(r, row.telesalesNetAmount)"
                      ></div>
                    }
                    @if (showCounterCols()) {
                      <div
                        class="sst-bar-fill sst-bar-fill-counter"
                        [style.width.%]="barPct(r, row.counterNetAmount)"
                      ></div>
                    }
                  </div>
                  <span class="sst-bar-value">{{ formatSoles(row.netAmount) }}</span>
                </div>
              }
              <div class="sst-bar-legend">
                @if (showFieldCols()) {
                  <span><span class="sst-legend-dot sst-legend-field"></span> Campo</span>
                }
                @if (showTelesalesCols()) {
                  <span><span class="sst-legend-dot sst-legend-telesales"></span> Televentas</span>
                }
                @if (showCounterCols()) {
                  <span><span class="sst-legend-dot sst-legend-counter"></span> Mostrador</span>
                }
              </div>
            </div>
          }

          <div class="sst-table-wrap">
            <table class="ui-table-grid sst-table">
              <thead>
                <tr>
                  <th>Ítem</th>
                  @if (!isSingleDay()) {
                    <th>Fecha</th>
                  }
                  <th>Código</th>
                  <th>Vendedor</th>
                  @if (showFieldCols()) {
                    <th>Ped. campo</th>
                    <th>Venta campo</th>
                  }
                  @if (showTelesalesCols()) {
                    <th>Ped. televentas</th>
                    <th>Venta televentas S/</th>
                  }
                  @if (showCounterCols()) {
                    <th>Ped. mostrador</th>
                    <th>Venta mostrador</th>
                  }
                  @if (showWeightHours()) {
                    <th>Peso</th>
                  }
                  <th>Venta total</th>
                  @if (showWeightHours()) {
                    <th>Hora Inicio</th>
                    <th>Hora Fin</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of r.rows; track row.salespersonId + '-' + row.date; let i = $index) {
                  <tr class="sst-row" (click)="openOrders(row)">
                    <td class="sst-muted">{{ i + 1 }}</td>
                    @if (!isSingleDay()) {
                      <td class="sst-muted">{{ dateText(row.date) }}</td>
                    }
                    <td class="sst-muted">{{ row.salespersonCode }}</td>
                    <td>{{ row.salespersonName }}</td>
                    @if (showFieldCols()) {
                      <td class="sst-muted">{{ row.fieldOrderCount }}</td>
                      <td class="sst-muted">{{ formatSoles(row.fieldNetAmount) }}</td>
                    }
                    @if (showTelesalesCols()) {
                      <td class="sst-muted">{{ row.telesalesOrderCount }}</td>
                      <td class="sst-muted">{{ amountOrDash(row.telesalesNetAmount) }}</td>
                    }
                    @if (showCounterCols()) {
                      <td class="sst-muted">{{ row.counterOrderCount }}</td>
                      <td class="sst-muted">{{ formatSoles(row.counterNetAmount) }}</td>
                    }
                    @if (showWeightHours()) {
                      <td class="sst-muted">{{ weightText(row.weightKg) }}</td>
                    }
                    <td class="sst-cell-strong">{{ formatSoles(row.netAmount) }}</td>
                    @if (showWeightHours()) {
                      <td class="sst-muted">{{ timeText(row.firstOrderAt) }}</td>
                      <td class="sst-muted">{{ timeText(row.lastOrderAt) }}</td>
                    }
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td [attr.colspan]="isSingleDay() ? 3 : 4" class="sst-cell-strong">Sumas</td>
                  @if (showFieldCols()) {
                    <td class="sst-cell-strong">{{ r.totalFieldOrders }}</td>
                    <td class="sst-cell-strong">{{ formatSoles(r.totalFieldNetAmount) }}</td>
                  }
                  @if (showTelesalesCols()) {
                    <td class="sst-cell-strong">{{ r.totalTelesalesOrders }}</td>
                    <td class="sst-cell-strong">{{ amountOrDash(r.totalTelesalesNetAmount) }}</td>
                  }
                  @if (showCounterCols()) {
                    <td class="sst-cell-strong">{{ r.totalCounterOrders }}</td>
                    <td class="sst-cell-strong">{{ formatSoles(r.totalCounterNetAmount) }}</td>
                  }
                  @if (showWeightHours()) {
                    <td class="sst-cell-strong">{{ weightText(r.totalWeightKg) }}</td>
                  }
                  <td class="sst-cell-strong">{{ formatSoles(r.totalNetAmount) }}</td>
                  @if (showWeightHours()) {
                    <td colspan="2"></td>
                  }
                </tr>
              </tfoot>
            </table>
          </div>

          @if (r.lastOrderAt) {
            <p class="sst-footer-note">
              Último pedido registrado a las {{ timeText(r.lastOrderAt) }}
            </p>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .sst-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .sst-toolbar {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      .sst-toolbar ui-field {
        width: 200px;
      }
      .sst-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .sst-bar-chart {
        display: grid;
        gap: 10px;
        margin-bottom: 24px;
      }
      .sst-bar-row {
        display: grid;
        grid-template-columns: 180px 1fr 110px;
        align-items: center;
        gap: 10px;
      }
      .sst-bar-label {
        font-size: 13px;
        color: var(--ink-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sst-bar-track {
        height: 16px;
        background: var(--faint);
        display: flex;
      }
      .sst-bar-fill {
        height: 100%;
      }
      .sst-bar-fill-field {
        background: var(--accent);
      }
      .sst-bar-fill-telesales {
        background: var(--st-telesales);
      }
      .sst-bar-fill-counter {
        background: var(--st-counter-delivered);
      }
      .sst-bar-value {
        font-size: 13px;
        font-weight: 800;
        color: var(--ink);
        text-align: right;
        font-variant-numeric: var(--tnum);
      }
      .sst-bar-legend {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: var(--ink-muted);
        margin-top: 2px;
      }
      .sst-legend-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 5px;
      }
      .sst-legend-field {
        background: var(--accent);
      }
      .sst-legend-telesales {
        background: var(--st-telesales);
      }
      .sst-legend-counter {
        background: var(--st-counter-delivered);
      }
      .sst-table-wrap {
        overflow-x: auto;
      }
      .sst-table {
        width: 100%;
      }
      .sst-row {
        cursor: pointer;
      }
      .sst-row:hover {
        background: var(--faint);
      }
      .sst-cell-strong {
        font-weight: 800;
        white-space: nowrap;
      }
      .sst-muted {
        color: var(--ink-muted);
        font-size: 13px;
        white-space: nowrap;
      }
      .sst-footer-note {
        margin: 12px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }

      @media (max-width: 767px) {
        .sst-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class SalespersonSettlementTab {
  private reportSvc = inject(SalesReportAdminService);
  private router = inject(Router);

  protected dateText = dateText;
  protected timeText = timeText;
  protected weightText = weightText;
  protected formatSoles = formatSoles;
  protected originOptions = ORIGIN_FILTER_OPTIONS;

  protected from = signal(todayIso());
  protected to = signal(todayIso());
  protected originFilter = signal('');

  protected report = signal<SalespersonSettlementReport | null>(null);
  protected loading = signal(true);
  protected error = signal('');

  protected isSingleDay = computed(() => this.from() === this.to());

  /** Doc 42, sección 12.2: qué columnas se ocultan según el filtro de origen. */
  protected showFieldCols = computed(
    () => this.originFilter() === '' || this.originFilter() === 'FIELD',
  );
  protected showTelesalesCols = computed(
    () => this.originFilter() === '' || this.originFilter() === 'TELESALES',
  );
  protected showCounterCols = computed(
    () => this.originFilter() === '' || this.originFilter() === 'COUNTER',
  );
  protected showWeightHours = computed(() => this.originFilter() !== 'COUNTER');

  protected amountOrDash(amount: number): string {
    return amount > 0 ? this.formatSoles(amount) : '—';
  }

  private loadEffect = effect(() => {
    this.from();
    this.to();
    this.originFilter();
    untracked(() => this.load());
  });

  protected sortedRows(r: SalespersonSettlementReport) {
    return [...r.rows].sort((a, b) => b.netAmount - a.netAmount);
  }

  protected barPct(r: SalespersonSettlementReport, amount: number): number {
    const max = Math.max(...r.rows.map((row) => row.netAmount), 1);
    return Math.round((amount / max) * 100);
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.reportSvc
      .salespersonSettlement(this.from(), this.to(), this.originFilter() || undefined)
      .subscribe({
        next: (result) => {
          this.report.set(result);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.error.set(detalle || 'No pudimos cargar la liquidación de vendedores.');
        },
      });
  }

  protected openOrders(row: SalespersonSettlementRow) {
    this.router.navigate(['/pedidos'], {
      queryParams: {
        salespersonId: row.salespersonId,
        from: row.date,
        to: row.date,
        originCode: this.originFilter() || undefined,
      },
    });
  }
}
