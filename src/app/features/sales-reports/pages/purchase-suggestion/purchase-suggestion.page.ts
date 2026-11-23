import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { format, parseISO, subDays } from 'date-fns';
import { UiField, UiFieldOption } from '../../../../shared/ui/field/field';
import { UiCard } from '../../../../shared/ui/card/card';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiInfoTip } from '../../../../shared/ui/info-tip/info-tip';
import { SalesReportModuleTabs } from '../../ui/module-tabs';
import { CoverageBar } from '../../ui/coverage-bar';
import { StockLevelChip } from '../../ui/stock-level-chip';
import { PurchaseSuggestionDrawer } from '../../ui/purchase-suggestion-drawer';
import { PurchaseSuggestionApi } from '../../data-access/purchase-suggestion.api';
import { CatalogLookupService } from '../../../catalog/catalog-lookup';
import { BrandView } from '../../../../shared/models/catalog.models';
import {
  PurchaseSuggestionReport,
  PurchaseSuggestionRow,
} from '../../domain/purchase-suggestion.models';
import {
  STOCK_LEVEL_COLOR_VAR,
  STOCK_LEVEL_LABEL,
  STOCK_LEVEL_ORDER,
  StockLevel,
  consumptionText,
  coverageText,
  erpStockMissingText,
  isErpStockStale,
  stockLevel,
  suggestedMainText,
  suggestedSubText,
  trendColorVar,
  trendText,
} from '../../domain/purchase-suggestion.format';
import { purchaseSuggestionColumns } from '../../domain/purchase-suggestion.columns';
import { formatSoles } from '../../../../shared/pipes/money';
import { TableExporter } from '../../../../shared/utils/export/table-exporter.service';
import { ExportTable } from '../../../../shared/utils/export/export.models';
import { exportFileName } from '../../../../shared/utils/export/export-file-name';
import { ToastService } from '../../../../core/ui/toast';

const DAY_PRESETS = [7, 15, 30];
const DEFAULT_DAYS = 15;
const MIN_DAYS = 1;
const MAX_DAYS = 90;
const DAYS_DEBOUNCE_MS = 400;

type SortKey =
  | 'consumptionPerDay'
  | 'consumptionPerWeek'
  | 'consumptionLast4Weeks'
  | 'trendPercent'
  | 'erpStock'
  | 'coverageDays'
  | 'suggestedUnits'
  | 'estimatedCost';
type SortDir = 'asc' | 'desc';

interface TableRow extends PurchaseSuggestionRow {
  level: StockLevel;
}

const SORT_ACCESSOR: Record<SortKey, (r: TableRow) => number> = {
  consumptionPerDay: (r) => r.consumptionPerDay,
  consumptionPerWeek: (r) => r.consumptionPerWeek,
  consumptionLast4Weeks: (r) => r.consumptionLast4Weeks,
  trendPercent: (r) => r.trendPercent ?? Number.NEGATIVE_INFINITY,
  erpStock: (r) => r.erpStock,
  coverageDays: (r) => r.coverageDays ?? Number.POSITIVE_INFINITY,
  suggestedUnits: (r) => r.suggestedUnits,
  estimatedCost: (r) => r.estimatedCost ?? Number.NEGATIVE_INFINITY,
};

/** "Sugerido de compra" — doc 94. No crea órdenes: es solo análisis y exportación. */
@Component({
  selector: 'app-purchase-suggestion-page',
  imports: [
    UiField,
    UiCard,
    UiEmpty,
    UiButton,
    UiInfoTip,
    SalesReportModuleTabs,
    CoverageBar,
    StockLevelChip,
    PurchaseSuggestionDrawer,
  ],
  template: `
    <app-sales-report-module-tabs />
    <section class="psg-page">
      <header class="psg-head">
        <div class="psg-head-title">
          <h1>Sugerido de compra</h1>
          @if (report(); as r) {
            <p class="psg-sub">
              {{ subtitleText(r) }}
              <span
                uiInfoTip="Consumo = venta + bonificaciones del almacén. Tendencia: semana actual contra el promedio de las 8 semanas anteriores. Stock: la última subida del ERP. Sugerido: para cubrir los días elegidos, redondeado a paquetes completos."
              ></span>
            </p>
          }
        </div>
        <div class="psg-head-right">
          @if (report(); as r) {
            <span class="psg-warehouse">{{ r.warehouseName }}</span>
          }
          <button uiButton variant="ghost" (click)="load()" [loading]="loading()">
            ↻ Actualizar
          </button>
        </div>
      </header>

      <div class="psg-filters">
        <ui-field
          label="Marca"
          type="select"
          [(value)]="brandId"
          [options]="brandOptions()"
          [disabled]="loadingBrands()"
        />
        <div class="psg-days-field">
          <span class="psg-days-label">Días a cubrir</span>
          <div class="psg-days-row">
            @for (preset of dayPresets; track preset) {
              <button
                type="button"
                class="psg-day-pill"
                [class.active]="coverageDays() === preset"
                (click)="setCoverageDays(preset)"
              >
                {{ preset }}
              </button>
            }
            <input
              type="number"
              class="psg-days-input"
              [min]="minDays"
              [max]="maxDays"
              [value]="coverageDaysText()"
              (input)="onCoverageDaysInput($event)"
              aria-label="Días a cubrir (1 a 90)"
            />
          </div>
        </div>
        <ui-field label="Buscar" placeholder="Código o nombre" [(value)]="search" icon="search" />
        <button
          uiButton
          variant="secondary"
          class="psg-export"
          [disabled]="!canExport()"
          [loading]="exporting()"
          (click)="onExport()"
        >
          <span class="material-icons" aria-hidden="true">file_download</span>
          Exportar Excel
        </button>
      </div>

      @if (report(); as r) {
        <div class="psg-chips">
          @for (c of levelChips(); track c.level) {
            <button
              type="button"
              class="psg-chip"
              [class.active]="c.active"
              [style.background]="c.active ? c.tintBg : ''"
              [style.border-color]="c.active ? c.colorVar : ''"
              (click)="toggleLevel(c.level)"
            >
              <span class="psg-chip-dot" [style.background]="c.colorVar"></span>
              {{ c.label }} <span class="tnum">{{ c.count }}</span>
            </button>
          }
          @if (levelFilters().length > 0 || search().trim() !== '') {
            <button type="button" class="psg-clear" (click)="clearFilters()">Quitar filtros</button>
          }
        </div>

        <div class="psg-kpi-row">
          <div class="psg-kpi">
            <span class="psg-kpi-label">A pedir</span>
            <span class="psg-kpi-value"
              >{{ r.summary.toOrderCount }} de {{ r.summary.productCount }}</span
            >
          </div>
          <div class="psg-kpi">
            <span class="psg-kpi-label">Paquetes sugeridos</span>
            <span class="psg-kpi-value tnum">{{ r.summary.suggestedPackages }}</span>
          </div>
          <div class="psg-kpi">
            <span class="psg-kpi-label">Unidades sugeridas</span>
            <span class="psg-kpi-value tnum">{{ r.summary.suggestedUnits }}</span>
          </div>
          <div class="psg-kpi">
            <span class="psg-kpi-label">Costo estimado</span>
            <span class="psg-kpi-value">{{
              r.summary.estimatedCost != null ? formatSoles(r.summary.estimatedCost) : '—'
            }}</span>
            @if (r.summary.withoutCostCount > 0) {
              <span class="psg-kpi-sub"
                >{{ r.summary.withoutCostCount }} productos sin costo de compra</span
              >
            }
          </div>
        </div>
      }

      @if (loading()) {
        <div class="psg-skeleton" role="status" aria-label="Cargando">
          <div class="psg-skeleton-cards">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="psg-skeleton-card"></div>
            }
          </div>
          <div class="psg-skeleton-rows">
            @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
              <div class="psg-skeleton-row"></div>
            }
          </div>
        </div>
      } @else if (errorKind() === 'network') {
        <ui-empty
          variant="error"
          title="No pudimos cargar el sugerido de compra"
          [body]="errorMessage()"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (errorKind() === 'conflict') {
        <ui-empty variant="error" title="No pudimos aplicar el filtro" [body]="errorMessage()" />
      } @else if (report(); as r) {
        @if (r.products.length === 0) {
          @if (!brandId()) {
            <ui-empty
              [title]="
                'No hay productos para pedir con ' + r.coverageTargetDays + ' días a cubrir ✔'
              "
              body="El stock actual cubre el consumo esperado en todas las marcas."
            />
          } @else {
            <ui-empty
              [title]="
                r.brandName + ' no tiene productos con movimiento ni stock en ' + r.warehouseName
              "
            />
          }
        } @else if (sortedRows().length === 0) {
          <ui-empty
            title="Ningún producto en este estado"
            body="Los filtros de color combinados no coinciden con ningún producto de la tabla."
            actionLabel="Quitar filtros"
            (action)="clearFilters()"
          />
        } @else {
          <ui-card class="psg-table-card">
            <div class="psg-table-wrap">
              <table class="ui-table-grid psg-table">
                <thead>
                  <tr>
                    <th class="psg-th-bar"></th>
                    <th class="psg-th-sticky">Producto</th>
                    <th class="psg-col-right psg-col-secondary">
                      <button
                        type="button"
                        class="psg-sort-btn"
                        (click)="toggleSort('consumptionPerDay')"
                      >
                        Cons./día
                      </button>
                    </th>
                    <th class="psg-col-right psg-col-secondary">
                      <button
                        type="button"
                        class="psg-sort-btn"
                        (click)="toggleSort('consumptionPerWeek')"
                      >
                        Cons./sem.
                      </button>
                    </th>
                    <th class="psg-col-right psg-col-secondary psg-col-4w">
                      <button
                        type="button"
                        class="psg-sort-btn"
                        (click)="toggleSort('consumptionLast4Weeks')"
                      >
                        4 semanas
                      </button>
                    </th>
                    <th class="psg-col-right psg-col-secondary">
                      <button
                        type="button"
                        class="psg-sort-btn"
                        (click)="toggleSort('trendPercent')"
                      >
                        Tendencia
                      </button>
                    </th>
                    <th class="psg-col-right">
                      <button type="button" class="psg-sort-btn" (click)="toggleSort('erpStock')">
                        Stock ERP
                      </button>
                    </th>
                    <th class="psg-col-right">
                      <button
                        type="button"
                        class="psg-sort-btn"
                        (click)="toggleSort('coverageDays')"
                      >
                        Cobertura
                      </button>
                    </th>
                    <th class="psg-col-right">
                      <button
                        type="button"
                        class="psg-sort-btn"
                        (click)="toggleSort('suggestedUnits')"
                      >
                        Sugerido
                      </button>
                    </th>
                    <th class="psg-col-right psg-col-cost">
                      <button
                        type="button"
                        class="psg-sort-btn"
                        (click)="toggleSort('estimatedCost')"
                      >
                        Costo
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of sortedRows(); track row.productId) {
                    <tr
                      class="psg-row"
                      [title]="
                        '4 semanas: ' +
                        consumptionText(row.consumptionLast4Weeks) +
                        ' · Costo: ' +
                        (row.estimatedCost != null ? formatSoles(row.estimatedCost) : 'Sin costo')
                      "
                      (click)="openDrawer(row)"
                    >
                      <td
                        class="psg-td-bar"
                        [style.background]="'var(' + STOCK_LEVEL_COLOR_VAR[row.level] + ')'"
                      ></td>
                      <td class="psg-th-sticky psg-product-cell">
                        <div class="psg-product-name">
                          {{ row.productCode }} {{ row.productName }}
                        </div>
                        <div class="psg-product-sub">
                          {{ row.unitOfMeasure }}
                          @if (row.unitsPerPackage) {
                            · x{{ row.unitsPerPackage }}
                          }
                          ·
                          <app-stock-level-chip [level]="row.level" [dense]="true" />
                          @if (!brandId()) {
                            · {{ row.brandName }}
                          }
                        </div>
                      </td>
                      <td class="psg-col-right psg-col-secondary">
                        {{ consumptionText(row.consumptionPerDay) }}
                      </td>
                      <td class="psg-col-right psg-col-secondary">
                        {{ consumptionText(row.consumptionPerWeek) }}
                      </td>
                      <td class="psg-col-right psg-col-secondary psg-col-4w">
                        {{ consumptionText(row.consumptionLast4Weeks) }}
                      </td>
                      <td
                        class="psg-col-right psg-col-secondary"
                        [style.color]="trendColorVar(row.trendPercent)"
                        [title]="
                          'Promedio semanal anterior: ' + consumptionText(row.previousWeeklyAverage)
                        "
                      >
                        {{ trendText(row.trendPercent) }}
                      </td>
                      <td class="psg-col-right">
                        {{ row.erpStock }}
                        @if (row.erpStockAt) {
                          @if (isErpStockStale(row.erpStockAt)) {
                            <span
                              class="material-icons psg-stale-icon"
                              [title]="'Stock subido el ' + row.erpStockAt"
                              aria-hidden="true"
                              >schedule</span
                            >
                          }
                        } @else {
                          <div class="psg-no-erp">{{ erpStockMissingText(row.erpStockAt) }}</div>
                        }
                      </td>
                      <td class="psg-col-right psg-coverage-cell">
                        {{ coverageText(row.coverageDays) }}
                        <app-coverage-bar
                          [coverageDays]="row.coverageDays"
                          [targetDays]="r.coverageTargetDays"
                          [level]="row.level"
                        />
                      </td>
                      <td class="psg-col-right psg-suggested-cell">
                        <div class="psg-suggested-main">
                          {{ suggestedMainText(row.suggestedUnits, row.suggestedPackages) }}
                        </div>
                        @if (suggestedSubText(row.suggestedUnits, row.suggestedPackages); as sub) {
                          <div class="psg-suggested-sub">{{ sub }}</div>
                        }
                      </td>
                      <td class="psg-col-right psg-col-cost">
                        @if (row.suggestedUnits > 0 && row.estimatedCost == null) {
                          <span class="psg-no-cost">Sin costo</span>
                        } @else {
                          {{ row.estimatedCost != null ? formatSoles(row.estimatedCost) : '—' }}
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (sortKey(); as key) {
              <button type="button" class="psg-reset-sort" (click)="resetSort()">
                Orden sugerido (quitar orden por {{ key }})
              </button>
            }
            <p class="psg-table-footer">
              A 1366 px, pasa el mouse sobre una fila para ver "4 semanas" y "Costo".
            </p>
          </ui-card>
        }
      }

      @if (selectedRow(); as row) {
        <app-purchase-suggestion-drawer
          [row]="row"
          [targetDays]="report()!.coverageTargetDays"
          [level]="row.level"
          [windowFrom]="report()!.windowFrom"
          [windowTo]="report()!.windowTo"
          (requestClose)="closeDrawer()"
        />
      }
    </section>
  `,
  styles: [
    `
      .psg-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .psg-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }
      .psg-head h1 {
        margin: 0;
        font: var(--fw-h1, 800) var(--fs-h1, 22px) / 1.2 var(--font-sans);
        color: var(--ink);
      }
      .psg-sub {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .psg-head-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .psg-warehouse {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
        background: var(--faint);
        padding: 6px 10px;
        border-radius: var(--radius-pill);
      }
      .psg-filters {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .psg-filters ui-field {
        width: 220px;
      }
      .psg-days-field {
        display: grid;
        gap: 6px;
      }
      .psg-days-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink);
      }
      .psg-days-row {
        display: flex;
        gap: 6px;
      }
      .psg-day-pill {
        appearance: none;
        min-height: var(--touch-min);
        min-width: 44px;
        padding: 0 12px;
        border: 1px solid var(--divider);
        background: var(--surface);
        color: var(--ink);
        font-weight: 800;
        cursor: pointer;
        border-radius: var(--radius-control, 0);
      }
      .psg-day-pill.active {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--on-accent);
      }
      .psg-days-input {
        width: 70px;
        min-height: var(--touch-min);
        border: 1px solid var(--divider);
        background: var(--surface-sunk);
        color: var(--ink);
        border-radius: var(--radius-control, 0);
        padding: 0 10px;
        font-family: var(--font-sans);
        font-size: 14px;
      }
      .psg-export {
        margin-left: auto;
      }
      .psg-chips {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .psg-chip {
        appearance: none;
        min-height: 32px;
        padding: 0 12px;
        border-radius: var(--radius-pill);
        border: 1px solid var(--hairline);
        background: var(--surface);
        color: var(--ink);
        font-size: 12px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }
      .psg-chip-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
      }
      .psg-clear {
        appearance: none;
        border: 0;
        background: none;
        color: var(--accent-ink);
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
      }
      .psg-kpi-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }
      .psg-kpi {
        border: 1px solid var(--hairline);
        border-radius: var(--radius-card);
        background: var(--surface);
        padding: 14px 16px;
        display: grid;
        gap: 4px;
      }
      .psg-kpi-label {
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .psg-kpi-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        color: var(--ink);
      }
      .psg-kpi-sub {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .psg-skeleton-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }
      .psg-skeleton-card {
        height: 70px;
        background: var(--faint);
      }
      .psg-skeleton-rows {
        display: grid;
        gap: 6px;
      }
      .psg-skeleton-row {
        height: 40px;
        background: var(--faint);
      }
      .psg-table-card {
        display: block;
      }
      .psg-table-wrap {
        overflow: auto;
        max-height: 64vh;
        margin: -2px -2px 0;
      }
      .psg-table {
        width: 100%;
        background: var(--surface);
        border-collapse: separate;
        border-spacing: 0;
      }
      .psg-table thead th {
        position: sticky;
        top: 0;
        background: var(--surface);
        z-index: 2;
      }
      .psg-th-bar,
      .psg-td-bar {
        width: 4px;
        padding: 0 !important;
      }
      .psg-th-sticky {
        position: sticky;
        left: 4px;
        background: var(--surface);
        z-index: 1;
      }
      thead .psg-th-sticky {
        z-index: 3;
      }
      .psg-sort-btn {
        appearance: none;
        border: 0;
        background: none;
        font: inherit;
        font-weight: 700;
        color: var(--ink-muted);
        cursor: pointer;
        padding: 0;
      }
      .psg-row {
        cursor: pointer;
      }
      .psg-row:hover {
        background: var(--faint);
      }
      .psg-col-right {
        text-align: right;
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .psg-col-secondary {
        color: var(--ink-muted);
        font-size: 12px;
      }
      .psg-product-cell {
        white-space: nowrap;
      }
      .psg-product-name {
        font-weight: 800;
        color: var(--ink);
      }
      .psg-product-sub {
        margin-top: 2px;
        font-size: 11px;
        color: var(--ink-muted);
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .psg-no-erp {
        font-size: 10px;
        color: var(--ink-muted);
        white-space: nowrap;
      }
      .psg-stale-icon {
        font-size: 14px;
        color: var(--status-warn);
        vertical-align: middle;
        margin-left: 2px;
      }
      .psg-coverage-cell {
        min-width: 90px;
      }
      .psg-coverage-cell app-coverage-bar {
        display: block;
        margin-top: 4px;
      }
      .psg-suggested-cell {
        min-width: 90px;
      }
      .psg-suggested-main {
        font-size: 15px;
        font-weight: 800;
        color: var(--ink);
      }
      .psg-suggested-sub {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .psg-no-cost {
        color: var(--ink-muted);
        font-weight: 400;
      }
      .psg-reset-sort {
        appearance: none;
        border: 0;
        background: none;
        color: var(--accent-ink);
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
        margin: 10px 2px 0;
      }
      .psg-table-footer {
        margin: 8px 2px 0;
        font-size: 11px;
        color: var(--ink-muted);
      }

      /* Doc 94, sección 7: a 1366 px la tabla debe caber sin scroll
         horizontal — "4 semanas" y "Costo" son las primeras en ocultarse
         (quedan disponibles en el tooltip de la fila). */
      @media (max-width: 1550px) {
        .psg-col-4w,
        .psg-col-cost {
          display: none;
        }
      }

      @media (max-width: 767px) {
        .psg-page {
          padding: var(--sp-4);
        }
        .psg-filters ui-field {
          width: 100%;
        }
      }
    `,
  ],
})
export class PurchaseSuggestionPage {
  private api = inject(PurchaseSuggestionApi);
  private catalogSvc = inject(CatalogLookupService);
  private exporter = inject(TableExporter);
  private toast = inject(ToastService);
  private router = inject(Router);

  /** "Marca y días a cubrir van en la URL" — doc 94, sección 5.3. */
  brandIdParam = input('', { alias: 'brandId' });
  daysParam = input('', { alias: 'days' });

  protected dayPresets = DAY_PRESETS;
  protected minDays = MIN_DAYS;
  protected maxDays = MAX_DAYS;
  protected STOCK_LEVEL_COLOR_VAR = STOCK_LEVEL_COLOR_VAR;
  protected formatSoles = formatSoles;
  protected consumptionText = consumptionText;
  protected coverageText = coverageText;
  protected trendText = trendText;
  protected trendColorVar = trendColorVar;
  protected suggestedMainText = suggestedMainText;
  protected suggestedSubText = suggestedSubText;
  protected erpStockMissingText = erpStockMissingText;
  protected isErpStockStale = (at: string | null) => isErpStockStale(at);

  protected brands = signal<BrandView[]>([]);
  protected loadingBrands = signal(true);
  protected brandId = signal('');
  protected coverageDays = signal(DEFAULT_DAYS);
  protected coverageDaysText = signal(String(DEFAULT_DAYS));
  protected search = signal('');
  protected levelFilters = signal<StockLevel[]>([]);
  protected sortKey = signal<SortKey | null>(null);
  protected sortDir = signal<SortDir>('asc');
  protected selectedProductId = signal<number | null>(null);

  protected report = signal<PurchaseSuggestionReport | null>(null);
  protected loading = signal(true);
  protected errorKind = signal<'none' | 'network' | 'conflict'>('none');
  protected errorMessage = signal('');
  protected exporting = signal(false);

  private daysDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected brandOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todas las marcas' },
    ...this.brands().map((b) => ({ value: String(b.brandId), label: b.name })),
  ]);

  private rowsWithLevel = computed<TableRow[]>(() => {
    const r = this.report();
    if (!r) return [];
    return r.products.map((p) => ({ ...p, level: stockLevel(p, r.coverageTargetDays) }));
  });

  /** Con "Todas las marcas" solo aparecen Crítico y Pedir — doc 94, sección 5.3. */
  protected levelChips = computed(() => {
    const rows = this.rowsWithLevel();
    const allowed = this.brandId() ? STOCK_LEVEL_ORDER : (['CRITICAL', 'ORDER'] as StockLevel[]);
    const active = this.levelFilters();
    return allowed.map((level) => {
      const colorVar = `var(${STOCK_LEVEL_COLOR_VAR[level]})`;
      return {
        level,
        label: STOCK_LEVEL_LABEL[level],
        count: rows.filter((r) => r.level === level).length,
        active: active.includes(level),
        colorVar,
        tintBg: `color-mix(in srgb, ${colorVar} 14%, var(--surface))`,
      };
    });
  });

  private filteredRows = computed(() => {
    const rows = this.rowsWithLevel();
    const levels = this.levelFilters();
    const q = this.search().trim().toLowerCase();
    return rows.filter((r) => {
      const levelOk = levels.length === 0 || levels.includes(r.level);
      const searchOk =
        !q || r.productCode.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q);
      return levelOk && searchOk;
    });
  });

  protected sortedRows = computed(() => {
    const rows = this.filteredRows();
    const key = this.sortKey();
    if (!key) return rows;
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    const accessor = SORT_ACCESSOR[key];
    return [...rows].sort((a, b) => (accessor(a) - accessor(b)) * dir);
  });

  protected selectedRow = computed(() => {
    const id = this.selectedProductId();
    if (id == null) return null;
    return this.rowsWithLevel().find((r) => r.productId === id) ?? null;
  });

  protected canExport = computed(() => !this.loading() && this.sortedRows().length > 0);

  /** Siembra marca/días desde la URL una sola vez; vuelve a disparar si cambian por fuera (atrás/adelante). */
  private seedFromUrlEffect = effect(() => {
    const brandId = this.brandIdParam();
    const daysText = this.daysParam();
    untracked(() => {
      if (brandId) this.brandId.set(brandId);
      if (daysText) {
        const n = Number(daysText);
        if (Number.isInteger(n) && n >= MIN_DAYS && n <= MAX_DAYS) {
          this.coverageDays.set(n);
          this.coverageDaysText.set(String(n));
        }
      }
    });
  });

  private loadEffect = effect(() => {
    const brandId = this.brandId();
    const days = this.coverageDays();
    untracked(() => {
      this.router.navigate([], {
        queryParams: { brandId: brandId || null, days: days !== DEFAULT_DAYS ? days : null },
        replaceUrl: true,
      });
      this.load();
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

  protected setCoverageDays(n: number) {
    if (this.daysDebounceTimer) clearTimeout(this.daysDebounceTimer);
    this.coverageDaysText.set(String(n));
    this.coverageDays.set(n);
  }

  protected onCoverageDaysInput(ev: Event) {
    const value = (ev.target as HTMLInputElement).value;
    this.coverageDaysText.set(value);
    if (this.daysDebounceTimer) clearTimeout(this.daysDebounceTimer);
    this.daysDebounceTimer = setTimeout(() => {
      const n = Number(value);
      if (Number.isInteger(n) && n >= MIN_DAYS && n <= MAX_DAYS) {
        this.coverageDays.set(n);
      }
    }, DAYS_DEBOUNCE_MS);
  }

  protected toggleLevel(level: StockLevel) {
    const cur = this.levelFilters();
    this.levelFilters.set(cur.includes(level) ? cur.filter((l) => l !== level) : [...cur, level]);
  }

  protected clearFilters() {
    this.levelFilters.set([]);
    this.search.set('');
  }

  protected toggleSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  protected resetSort() {
    this.sortKey.set(null);
  }

  protected openDrawer(row: TableRow) {
    this.selectedProductId.set(row.productId);
  }

  protected closeDrawer() {
    this.selectedProductId.set(null);
  }

  /** "Consumo de las últimas 4 semanas (26/10/2026 – 22/11/2026 · 24 días con venta)" — doc 94, sección 5.2. */
  protected subtitleText(r: PurchaseSuggestionReport): string {
    const from = format(parseISO(r.windowFrom), 'dd/MM/yyyy');
    const to = format(subDays(parseISO(r.windowTo), 1), 'dd/MM/yyyy');
    return `Consumo de las últimas 4 semanas (${from} – ${to} · ${r.sellingDays} días con venta)`;
  }

  load() {
    this.loading.set(true);
    this.errorKind.set('none');
    this.selectedProductId.set(null);
    const brandId = this.brandId() ? Number(this.brandId()) : undefined;
    this.api.report(brandId, this.coverageDays()).subscribe({
      next: (result) => {
        this.report.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const status = err?.status;
        const detail = err?.error?.detail ?? err?.error?.message;
        if (status === 404) {
          this.brandId.set('');
          this.errorKind.set('conflict');
          this.errorMessage.set(detail || 'No encontramos esa marca.');
          return;
        }
        if (status === 409) {
          this.errorKind.set('conflict');
          this.errorMessage.set(detail || 'Los días a cubrir deben estar entre 1 y 90.');
          return;
        }
        this.errorKind.set('network');
        this.errorMessage.set(detail || 'No pudimos cargar el sugerido de compra.');
      },
    });
  }

  protected onExport() {
    const r = this.report();
    if (!r || this.exporting()) return;
    this.exporting.set(true);
    const table = this.buildTable(r);
    this.exporter
      .export(table, 'xlsx')
      .then(() => {
        this.exporting.set(false);
        this.toast.success(`Archivo descargado: ${table.fileName}.xlsx`);
      })
      .catch((err: unknown) => {
        this.exporting.set(false);
        const message =
          err instanceof Error ? err.message : 'No pudimos generar el archivo. Intenta de nuevo.';
        this.toast.error(message);
      });
  }

  private buildTable(r: PurchaseSuggestionReport): ExportTable<PurchaseSuggestionRow> {
    const rows = this.sortedRows();
    const totals = {
      suggestedPackages: rows.reduce((sum, row) => sum + (row.suggestedPackages ?? 0), 0),
      suggestedUnits: rows.reduce((sum, row) => sum + row.suggestedUnits, 0),
      estimatedCost: rows.some((row) => row.estimatedCost != null)
        ? rows.reduce((sum, row) => sum + (row.estimatedCost ?? 0), 0)
        : null,
    };
    return {
      title: 'Sugerido de compra',
      subtitle: this.subtitleText(r),
      filters: [
        { label: 'Marca', value: r.brandName ?? 'Todas las marcas' },
        { label: 'Días a cubrir', value: String(r.coverageTargetDays) },
        { label: 'Almacén', value: r.warehouseName },
        { label: 'Generado', value: r.generatedAt },
      ],
      columns: purchaseSuggestionColumns(r.coverageTargetDays),
      rows,
      totals,
      totalsLabel: 'Sumas',
      fileName: exportFileName([
        'sugerido-compra',
        r.brandName ?? 'todas',
        `${r.coverageTargetDays}d`,
        format(new Date(), 'yyyy-MM-dd'),
      ]),
    };
  }
}
