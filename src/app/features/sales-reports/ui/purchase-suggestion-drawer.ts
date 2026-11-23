import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { PurchaseSuggestionRow } from '../domain/purchase-suggestion.models';
import {
  STOCK_LEVEL_COLOR_VAR,
  STOCK_LEVEL_LABEL,
  StockLevel,
  consumptionText,
  coverageText,
  erpStockMissingText,
  isErpStockStale,
  purchaseFormulaText,
  trendColorVar,
  trendText,
} from '../domain/purchase-suggestion.format';
import { dateTimeText } from '../../assignments/assignment-format';

/**
 * Panel lateral de un producto — doc 94, sección 5.5: datos más grandes, la
 * ventana usada, la fórmula aplicada y un enlace a Marcas por mes.
 */
@Component({
  selector: 'app-purchase-suggestion-drawer',
  imports: [RouterLink, CdkTrapFocus],
  template: `
    <div class="psd-backdrop" (click)="requestClose.emit()"></div>
    <aside
      class="psd-panel"
      cdkTrapFocus
      cdkTrapFocusAutoCapture="true"
      role="dialog"
      aria-modal="true"
    >
      <header class="psd-head">
        <div>
          <p class="psd-code">{{ row().productCode }}</p>
          <h2 class="psd-name">{{ row().productName }}</h2>
          <span class="psd-level" [style.color]="levelColorVar()">
            <span class="psd-level-dot" [style.background]="levelColorVar()"></span>
            {{ levelLabel() }}
          </span>
        </div>
        <button type="button" class="psd-close" aria-label="Cerrar" (click)="requestClose.emit()">
          <span class="material-icons" aria-hidden="true">close</span>
        </button>
      </header>

      <div class="psd-body">
        <div class="psd-stats">
          <div class="psd-stat">
            <span class="psd-stat-label">Consumo/día</span>
            <span class="psd-stat-value">{{ consumptionText(row().consumptionPerDay) }}</span>
          </div>
          <div class="psd-stat">
            <span class="psd-stat-label">Consumo/semana</span>
            <span class="psd-stat-value">{{ consumptionText(row().consumptionPerWeek) }}</span>
          </div>
          <div class="psd-stat">
            <span class="psd-stat-label">Stock ERP</span>
            <span class="psd-stat-value">{{ row().erpStock }}</span>
          </div>
          <div class="psd-stat">
            <span class="psd-stat-label">Cobertura</span>
            <span class="psd-stat-value">{{ coverageText(row().coverageDays) }}</span>
          </div>
          <div class="psd-stat">
            <span class="psd-stat-label">Tendencia</span>
            <span class="psd-stat-value" [style.color]="trendColorVar(row().trendPercent)">{{
              trendText(row().trendPercent)
            }}</span>
          </div>
          <div class="psd-stat">
            <span class="psd-stat-label">Promedio semanal anterior</span>
            <span class="psd-stat-value">{{ consumptionText(row().previousWeeklyAverage) }}</span>
          </div>
        </div>

        <p class="psd-stock-age">
          @if (row().erpStockAt) {
            Stock subido el {{ dateTimeText(row().erpStockAt) }}
            @if (stale()) {
              <span class="psd-stale">· hace más de 24 h</span>
            }
          } @else {
            {{ erpStockMissingText(row().erpStockAt) }}
          }
        </p>

        <div class="psd-formula-box">
          <span class="psd-formula-label">Sugerido con {{ targetDays() }} días a cubrir</span>
          <p class="psd-formula">{{ formulaText() }}</p>
        </div>

        <p class="psd-cost">
          Costo estimado:
          <strong>{{
            row().estimatedCost != null
              ? 'S/ ' + row().estimatedCost!.toFixed(2)
              : 'Sin costo de compra registrado'
          }}</strong>
        </p>

        <p class="psd-window">
          Ventana usada para el consumo: {{ windowFrom() }} – {{ windowTo() }}
        </p>

        <a class="psd-link" [routerLink]="['/reportes-ventas/marcas-por-mes', row().brandId]">
          Ver {{ row().brandName }} en Marcas por mes →
        </a>
      </div>
    </aside>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 60;
      }
      .psd-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(10, 8, 8, 0.45);
      }
      .psd-panel {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(420px, 100%);
        background: var(--surface);
        box-shadow: var(--elev-dialog);
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }
      .psd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 20px 22px;
        border-bottom: var(--border-hair);
        flex: none;
      }
      .psd-code {
        margin: 0 0 2px;
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .psd-name {
        margin: 0;
        font-size: 18px;
        font-weight: 800;
        color: var(--ink);
      }
      .psd-level {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        font-size: 12px;
        font-weight: 800;
      }
      .psd-level-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .psd-close {
        flex: none;
        appearance: none;
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border: none;
        background: transparent;
        color: var(--ink-muted);
        cursor: pointer;
      }
      .psd-close:hover {
        color: var(--ink);
        background: var(--faint);
      }
      .psd-body {
        padding: 20px 22px 28px;
      }
      .psd-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .psd-stat {
        display: grid;
        gap: 2px;
      }
      .psd-stat-label {
        font-size: 11px;
        color: var(--ink-muted);
      }
      .psd-stat-value {
        font-size: 16px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .psd-stock-age {
        margin: 14px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .psd-stale {
        color: var(--status-warn);
      }
      .psd-formula-box {
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: var(--radius-card);
        background: var(--surface-sunk);
        border: 1px solid var(--hairline);
      }
      .psd-formula-label {
        font-size: 10px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .psd-formula {
        margin: 6px 0 0;
        font-size: 13px;
        font-family: ui-monospace, monospace;
        color: var(--ink);
        word-break: break-word;
      }
      .psd-cost {
        margin: 14px 0 0;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .psd-cost strong {
        color: var(--ink);
      }
      .psd-window {
        margin: 6px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .psd-link {
        display: inline-block;
        margin-top: 16px;
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
        text-decoration: none;
      }
      .psd-link:hover {
        text-decoration: underline;
      }

      @media (max-width: 599px) {
        .psd-panel {
          width: 100%;
        }
      }
    `,
  ],
})
export class PurchaseSuggestionDrawer {
  row = input.required<PurchaseSuggestionRow>();
  targetDays = input.required<number>();
  level = input.required<StockLevel>();
  windowFrom = input.required<string>();
  windowTo = input.required<string>();

  requestClose = output<void>();

  protected consumptionText = consumptionText;
  protected coverageText = coverageText;
  protected trendText = trendText;
  protected trendColorVar = trendColorVar;
  protected erpStockMissingText = erpStockMissingText;
  protected dateTimeText = dateTimeText;

  protected levelColorVar = computed(() => `var(${STOCK_LEVEL_COLOR_VAR[this.level()]})`);
  protected levelLabel = computed(() => STOCK_LEVEL_LABEL[this.level()]);
  protected stale = computed(() => isErpStockStale(this.row().erpStockAt));
  protected formulaText = computed(() => purchaseFormulaText(this.row(), this.targetDays()));
}
