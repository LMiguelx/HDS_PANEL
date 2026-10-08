import {
  DestroyRef,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiInfoTip } from '../../shared/ui/info-tip/info-tip';
import { InventoryModuleTabs } from './ui/module-tabs';
import { InventoryAdminService } from './inventory-admin';
import { ProductAdminService } from '../catalog/product-admin';
import { ToastService } from '../../core/ui/toast';
import { AuthService } from '../../core/auth/auth';
import {
  ReconciliationResultFilter,
  StockReconciliationDetail,
  StockReconciliationSummary,
  StockReconciliationView,
  WarehouseView,
} from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';
import {
  BADGE_TONE_VAR,
  RECONCILIATION_RESULT_OPTIONS,
  failureReasonText,
  movementReference,
  reconciliationResultLabel,
  reconciliationResultTone,
  toProductLookup,
} from './inventory-format';

const AUTO_REFRESH_MS = 60_000;

const LEGEND: { tone: string; label: string }[] = [
  { tone: '--st-vigente', label: 'Cuadró' },
  { tone: '--st-open', label: 'Entró stock' },
  { tone: '--st-mismatch', label: 'Sobraba / Fallida / Sin respaldo' },
  { tone: '--st-in-route', label: 'En cola' },
];

type NumericSummaryKey =
  | 'pendingUploads'
  | 'failedCount'
  | 'matchedCount'
  | 'increasedCount'
  | 'decreasedCount'
  | 'shortfallCount';

interface SummaryCard {
  key: NumericSummaryKey;
  label: string;
  tip: string;
  tone: string;
  result?: ReconciliationResultFilter | '';
}

const CARDS: SummaryCard[] = [
  {
    key: 'pendingUploads',
    label: 'En cola',
    tip: 'Subidas del ERP que todavía no se procesaron. Se procesan solas cada minuto; usa "Procesar ahora" si no quieres esperar.',
    tone: '--st-in-route',
  },
  {
    key: 'failedCount',
    label: 'Fallidas',
    tip: 'Subidas que no se pudieron procesar (de cualquier fecha). El stock no cambió. Reintenta cada una desde su fila.',
    tone: '--st-mismatch',
    result: 'FAILED',
  },
  {
    key: 'matchedCount',
    label: 'Cuadraron',
    tip: 'El stock del sistema ya coincidía con el del ERP: no hizo falta ajustar nada.',
    tone: '--st-vigente',
    result: 'MATCHED',
  },
  {
    key: 'increasedCount',
    label: 'Entró stock',
    tip: 'El sistema tenía menos que el ERP y se le sumó. Casi siempre es mercadería que llegó: no es un problema.',
    tone: '--st-open',
    result: 'INCREASED',
  },
  {
    key: 'decreasedCount',
    label: 'Sobraba',
    tip: 'El sistema tenía más que el ERP y se le restó. Es la alarma principal: revisa el detalle para ver qué lo causó (un ajuste manual, un adelanto mal retirado).',
    tone: '--st-mismatch',
    result: 'DECREASED',
  },
  {
    key: 'shortfallCount',
    label: 'Ventas sin respaldo',
    tip: 'Hay pedidos tomados por más unidades de las que el ERP tiene. El stock del sistema queda en 0: revisa esos pedidos.',
    tone: '--st-mismatch',
    result: 'SHORTFALL',
  },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Cuadre con el ERP — doc 35, sección 8. El ERP informa su stock real y el
 * sistema se alinea solo, cada minuto; esta pantalla es donde supervisión
 * ve ese resultado, entiende la causa de una diferencia y reintenta lo que
 * falló. Reintentar / Procesar ahora solo con `stock.advance`.
 *
 * Una misma ruta sirve para el listado (`/inventario/cuadre`) y el detalle
 * de una subida (`/inventario/cuadre/:uploadId`) — `uploadId` decide cuál
 * de las dos vistas se pinta.
 */
@Component({
  selector: 'app-stock-reconciliation',
  imports: [RouterLink, UiButton, UiField, UiTypeahead, UiEmpty, UiInfoTip, InventoryModuleTabs],
  template: `
    <app-inventory-module-tabs />
    <section class="sr-page">
      @if (uploadId()) {
        <!-- ───────────── Detalle de un cuadre ───────────── -->
        <button uiButton variant="ghost" size="sm" routerLink="/inventario/cuadre" class="sr-back">
          ← Volver al listado
        </button>

        @if (detailLoading()) {
          <div class="sr-skeleton" role="status" aria-label="Cargando"></div>
        } @else if (detailError()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar el cuadre"
            actionLabel="Reintentar"
            (action)="loadDetail()"
          />
        } @else if (detail(); as d) {
          <div class="sr-detail-head">
            <div>
              <h1>{{ d.reconciliation.productName }}</h1>
              <p class="sr-muted">
                {{ d.reconciliation.productCode }} · {{ d.reconciliation.warehouseName }}
              </p>
              <p class="sr-muted">
                Subida del ERP: {{ dateTimeText(d.reconciliation.uploadedAt) }} · Procesado:
                {{ dateTimeText(d.reconciliation.processedAt) }}
              </p>
            </div>
            <span class="sr-badge" [style.color]="'var(' + toneOf(d.reconciliation) + ')'">
              {{ resultLabel(d.reconciliation) }}
            </span>
          </div>

          @if (d.reconciliation.statusCode === 'FAILED') {
            <div class="sr-fail-box">
              {{ failureText(d.reconciliation.failureCode) }}
              @if (canManage()) {
                <button
                  uiButton
                  variant="secondary"
                  size="sm"
                  [loading]="retrying()"
                  (click)="retry(d.reconciliation)"
                >
                  Reintentar
                </button>
              }
            </div>
          } @else {
            <div class="sr-breakdown">
              <div class="sr-breakdown-col">
                <div class="sr-breakdown-row">
                  <span>El ERP informó</span><strong>{{ d.reconciliation.erpQuantity }}</strong>
                </div>
                <div class="sr-breakdown-row">
                  <span>Pedidos sin descontar</span
                  ><strong>{{ d.reconciliation.committedQuantity }}</strong>
                </div>
                <div class="sr-breakdown-row">
                  <span>Adelantos pendientes</span
                  ><strong>{{ d.reconciliation.advanceBeforeQuantity }}</strong>
                </div>
                <div class="sr-breakdown-row">
                  <span>Adelantos cubiertos</span
                  ><strong>{{ d.reconciliation.advanceCoveredQuantity }}</strong>
                </div>
              </div>
              <div class="sr-breakdown-col">
                <div class="sr-breakdown-row">
                  <span>Stock del sistema antes</span
                  ><strong>{{ d.reconciliation.stockBefore }}</strong>
                </div>
                <div class="sr-breakdown-row">
                  <span>Ajuste aplicado</span>
                  <strong
                    [class.sr-positive]="(d.reconciliation.appliedDelta ?? 0) > 0"
                    [class.sr-negative]="(d.reconciliation.appliedDelta ?? 0) < 0"
                  >
                    {{ (d.reconciliation.appliedDelta ?? 0) > 0 ? '+' : ''
                    }}{{ d.reconciliation.appliedDelta }}
                  </strong>
                </div>
                <div class="sr-breakdown-row">
                  <span>Stock del sistema después</span
                  ><strong>{{ d.reconciliation.stockAfter }}</strong>
                </div>
                <div class="sr-breakdown-row">
                  <span>Ventas sin respaldo</span>
                  <strong [class.sr-negative]="(d.reconciliation.shortfall ?? 0) > 0">{{
                    d.reconciliation.shortfall
                  }}</strong>
                </div>
              </div>
            </div>
          }

          <h2 class="sr-section-title">
            {{
              d.previousProcessedAt
                ? 'Qué movió el stock desde el cuadre anterior (' +
                  dateTimeText(d.previousProcessedAt) +
                  ')'
                : 'Qué movió el stock antes de este cuadre'
            }}
          </h2>

          @if (d.movements.length === 0) {
            <ui-empty
              title="Sin movimientos registrados"
              body="La diferencia viene de un cambio en el stock del ERP — suele ser mercadería que llegó."
            />
          } @else {
            <table class="ui-table-grid sr-movements-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Origen</th>
                  <th>Nota</th>
                  <th>Hecho por</th>
                </tr>
              </thead>
              <tbody>
                @for (m of d.movements; track m.stockMovementId) {
                  <tr [class.sr-movement-cause]="highlightAsCause(d, m.movementTypeCode)">
                    <td class="sr-muted">{{ dateTimeText(m.createdAt) }}</td>
                    <td>{{ m.movementTypeName }}</td>
                    <td
                      [class.sr-positive]="m.quantity > 0"
                      [class.sr-negative]="m.quantity < 0"
                      class="sr-qty"
                    >
                      {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                    </td>
                    <td>
                      @if (ref(m).route) {
                        <a [routerLink]="ref(m).route" class="sr-link">{{ ref(m).text }}</a>
                      } @else {
                        <span class="sr-muted">{{ ref(m).text }}</span>
                      }
                    </td>
                    <td class="sr-muted">{{ m.note || '—' }}</td>
                    <td class="sr-muted">{{ m.createdByName || 'Automático' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <button
            uiButton
            variant="ghost"
            size="sm"
            [routerLink]="['/inventario/kardex', d.reconciliation.productId]"
            [queryParams]="{ warehouseId: d.reconciliation.warehouseId }"
          >
            Ver kardex completo
          </button>
        }
      } @else {
        <!-- ───────────── Listado de cuadres ───────────── -->
        <div class="sr-head">
          <div>
            <h1>Cuadre con el ERP</h1>
            <p class="sr-sub">
              El ERP informa su stock real y el sistema se alinea solo, cada minuto.
              <span
                uiInfoTip="Esta pantalla no calcula nada: muestra lo que ya procesó el servidor. Actualiza o procesa ahora para traer lo más reciente."
              ></span>
            </p>
          </div>
          <div class="sr-head-actions">
            @if (canManage() && summary()?.pendingUploads) {
              <button uiButton variant="secondary" [loading]="processing()" (click)="processNow()">
                Procesar ahora
              </button>
            }
            <button uiButton variant="ghost" (click)="refresh()" [loading]="loadingSummary()">
              ↻ Actualizar
            </button>
          </div>
        </div>

        <p class="sr-status-line">{{ statusLine() }}</p>

        @if (summary(); as s) {
          <div class="sr-cards">
            @for (c of cards; track c.key) {
              <button
                type="button"
                class="sr-card"
                [class.sr-card-clickable]="!!c.result || c.key === 'failedCount'"
                [disabled]="!c.result && c.key !== 'failedCount'"
                (click)="applyCardFilter(c)"
              >
                <div class="sr-card-top">
                  <span
                    class="sr-card-value"
                    [style.color]="s[c.key] > 0 ? 'var(' + c.tone + ')' : 'var(--ink)'"
                  >
                    {{ s[c.key] }}
                  </span>
                  <span [uiInfoTip]="c.tip"></span>
                </div>
                <span class="sr-card-label">{{ c.label }}</span>
              </button>
            }
          </div>

          @if (s.failedCount === 0 && s.decreasedCount === 0 && s.shortfallCount === 0) {
            <p class="sr-all-good">✓ Todo cuadra con el ERP en este período.</p>
          }

          <div class="sr-legend">
            @for (l of legend; track l.label) {
              <span class="sr-legend-item">
                <span class="sr-legend-dot" [style.background]="'var(' + l.tone + ')'"></span>
                {{ l.label }}
              </span>
            }
          </div>
        }

        <div class="sr-filters">
          <ui-field
            label="Almacén"
            type="select"
            [(value)]="filterWarehouseId"
            [options]="filterWarehouseOptions()"
          />
          <ui-typeahead
            label="Producto"
            placeholder="Buscar por nombre"
            [clearOnPick]="false"
            [search]="productSearch"
            [(selected)]="filterProduct"
          />
          <ui-field
            label="Resultado"
            type="select"
            [(value)]="filterResult"
            [options]="resultOptions"
          />
          <ui-field label="Desde" type="date" [(value)]="filterFrom" />
          <ui-field label="Hasta" type="date" [(value)]="filterTo" />
        </div>
        @if (dateRangeError()) {
          <div class="sr-error">{{ dateRangeError() }}</div>
        }

        @if (loading()) {
          <div class="sr-skeleton" role="status" aria-label="Cargando"></div>
        } @else if (error()) {
          <ui-empty
            variant="error"
            title="No pudimos cargar el cuadre"
            actionLabel="Reintentar"
            (action)="load()"
          />
        } @else if (rows().length === 0) {
          <ui-empty
            variant="al-dia"
            eyebrow="Al día"
            title="Todo cuadra con el ERP en este período"
          />
        } @else {
          <table class="ui-table-grid sr-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Almacén</th>
                <th>ERP</th>
                <th>Comprom.</th>
                <th>Adelantos</th>
                <th>Antes</th>
                <th>Ajuste</th>
                <th>Después</th>
                <th>Resultado</th>
                <th>Procesado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.uploadId) {
                <tr class="sr-row" (click)="openDetail(row)">
                  <td class="sr-cell-strong">
                    {{ row.productName }}
                    <div class="sr-muted">{{ row.productCode }}</div>
                  </td>
                  <td class="sr-muted">{{ row.warehouseName }}</td>
                  <td class="sr-muted">{{ row.erpQuantity ?? '—' }}</td>
                  <td class="sr-muted">{{ row.committedQuantity ?? '—' }}</td>
                  <td class="sr-muted">
                    {{ row.advanceBeforeQuantity ?? '—' }}
                    @if ((row.advanceCoveredQuantity ?? 0) > 0) {
                      <div>cubierto {{ row.advanceCoveredQuantity }}</div>
                    }
                  </td>
                  <td class="sr-muted">{{ row.stockBefore ?? '—' }}</td>
                  <td
                    [class.sr-positive]="(row.appliedDelta ?? 0) > 0"
                    [class.sr-negative]="(row.appliedDelta ?? 0) < 0"
                    class="sr-qty"
                  >
                    @if (row.appliedDelta != null) {
                      {{ row.appliedDelta > 0 ? '+' : '' }}{{ row.appliedDelta }}
                    } @else {
                      —
                    }
                  </td>
                  <td class="sr-muted">{{ row.stockAfter ?? '—' }}</td>
                  <td>
                    <span class="sr-badge" [style.color]="'var(' + toneOf(row) + ')'">{{
                      resultLabel(row)
                    }}</span>
                    @if ((row.shortfall ?? 0) > 0) {
                      <div class="sr-badge sr-badge-sub">Sin respaldo: {{ row.shortfall }}</div>
                    }
                  </td>
                  <td class="sr-muted">{{ dateTimeText(row.processedAt) }}</td>
                  <td (click)="$event.stopPropagation()">
                    @if (row.statusCode === 'FAILED' && canManage()) {
                      <button
                        uiButton
                        variant="ghost"
                        size="sm"
                        [loading]="retryingId() === row.uploadId"
                        (click)="retryFromList(row)"
                      >
                        Reintentar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="sr-pager">
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() === 0"
              (click)="prevPage()"
            >
              Anterior
            </button>
            <span class="sr-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() + 1 >= totalPages()"
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
      .sr-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .sr-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
        margin-top: 20px;
      }
      .sr-head-actions {
        display: flex;
        gap: 10px;
      }
      .sr-sub {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        color: var(--ink-muted);
        font-size: 13px;
        max-width: 560px;
      }
      .sr-status-line {
        margin: 12px 0 16px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .sr-cards {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 10px;
        margin-bottom: 10px;
      }
      .sr-card {
        appearance: none;
        text-align: left;
        border: 1px solid var(--hairline);
        background: var(--bg);
        padding: 12px 14px;
        display: grid;
        gap: 6px;
        cursor: default;
        font-family: var(--font-sans);
      }
      .sr-card-clickable {
        cursor: pointer;
      }
      .sr-card-clickable:hover {
        border-color: var(--accent);
      }
      .sr-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .sr-card-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        font-variant-numeric: var(--tnum);
      }
      .sr-card-label {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .sr-all-good {
        font-size: 13px;
        color: var(--st-vigente);
        font-weight: 700;
        margin: 0 0 12px;
      }
      .sr-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: var(--border-hair);
      }
      .sr-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .sr-legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
      }
      .sr-filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr));
        gap: 12px;
        padding-bottom: 16px;
        margin-bottom: 16px;
        border-bottom: var(--border-hair);
      }
      .sr-error {
        color: var(--accent-ink);
        font-size: 13px;
        margin-bottom: 12px;
      }
      .sr-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .sr-table {
        width: 100%;
      }
      .sr-row {
        cursor: pointer;
      }
      .sr-row:hover {
        background: var(--faint);
      }
      .sr-cell-strong {
        font-weight: 800;
      }
      .sr-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .sr-qty {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .sr-positive {
        color: var(--st-open);
      }
      .sr-negative {
        color: var(--st-mismatch);
      }
      .sr-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
        white-space: nowrap;
      }
      .sr-badge-sub {
        color: var(--st-mismatch);
        margin-top: 2px;
      }
      .sr-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 20px;
      }
      .sr-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      /* Detalle */
      .sr-back {
        margin: 16px 0;
      }
      .sr-detail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .sr-fail-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid var(--st-mismatch);
        background: color-mix(in srgb, var(--st-mismatch) 8%, transparent);
        padding: 12px 14px;
        margin: 16px 0;
        font-size: 13px;
      }
      .sr-breakdown {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 32px;
        margin: 16px 0 24px;
        border: 1px solid var(--hairline);
        padding: 16px;
      }
      .sr-breakdown-col {
        display: grid;
        gap: 8px;
      }
      .sr-breakdown-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .sr-breakdown-row strong {
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .sr-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0 0 12px;
        color: var(--ink);
      }
      .sr-movements-table {
        width: 100%;
        margin-bottom: 16px;
      }
      .sr-movement-cause {
        background: color-mix(in srgb, var(--st-mismatch) 8%, transparent);
      }
      .sr-link {
        font-size: 13px;
        color: var(--accent-ink);
      }

      @media (max-width: 1100px) {
        .sr-cards {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 767px) {
        .sr-page {
          padding: var(--sp-4);
        }
        .sr-cards {
          grid-template-columns: repeat(2, 1fr);
        }
        .sr-breakdown {
          grid-template-columns: 1fr;
        }
        .sr-table {
          display: block;
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class StockReconciliationPage {
  private inventorySvc = inject(InventoryAdminService);
  private productSvc = inject(ProductAdminService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  uploadId = input('', { alias: 'uploadId' });

  protected dateTimeText = dateTimeText;
  protected cards = CARDS;
  protected legend = LEGEND;
  protected resultOptions = RECONCILIATION_RESULT_OPTIONS;
  protected canManage = computed(() => this.auth.hasAny('stock.advance'));
  protected resultLabel = reconciliationResultLabel;
  protected toneOf = (row: StockReconciliationView) =>
    BADGE_TONE_VAR[reconciliationResultTone(row)];
  protected failureText = failureReasonText;
  protected ref = (m: { referenceTable: string | null; referenceId: string | null }) =>
    movementReference(m.referenceTable, m.referenceId);

  protected warehouses = signal<WarehouseView[]>([]);

  // Resumen
  protected summary = signal<StockReconciliationSummary | null>(null);
  protected loadingSummary = signal(true);
  protected processing = signal(false);

  // Filtros del listado
  protected filterWarehouseId = signal('');
  protected filterProduct = signal<UiLookupItem | null>(null);
  protected filterResult = signal<ReconciliationResultFilter | ''>('');
  protected filterFrom = signal(todayIso());
  protected filterTo = signal(todayIso());

  protected rows = signal<StockReconciliationView[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected loading = signal(true);
  protected error = signal(false);
  protected retryingId = signal<number | null>(null);

  // Detalle
  protected detail = signal<StockReconciliationDetail | null>(null);
  protected detailLoading = signal(false);
  protected detailError = signal(false);
  protected retrying = signal(false);

  protected filterWarehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todos' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  protected productSearch = (q: string): Observable<UiLookupItem[]> => {
    const warehouseId = Number(this.filterWarehouseId());
    if (!warehouseId) return of<UiLookupItem[]>([]);
    return this.productSvc
      .list({ warehouseId, q, page: 0, size: 20 })
      .pipe(map((page) => (page.content ?? []).map(toProductLookup)));
  };

  protected dateRangeError = computed(() => {
    if (!this.filterFrom() || !this.filterTo()) return '';
    if (this.filterFrom() > this.filterTo())
      return 'La fecha inicial no puede ser posterior a la final.';
    const days =
      (new Date(this.filterTo()).getTime() - new Date(this.filterFrom()).getTime()) / 86400000;
    if (days > 31) return 'El resumen admite como máximo 31 días.';
    return '';
  });

  protected statusLine = computed(() => {
    const s = this.summary();
    if (!s) return '';
    if (!s.lastUploadAt) return 'El ERP todavía no ha subido stock.';
    return `Última subida del ERP: ${dateTimeText(s.lastUploadAt)} · Último cuadre: ${s.lastProcessedAt ? dateTimeText(s.lastProcessedAt) : '—'}`;
  });

  private refreshEffect = effect(() => {
    this.uploadId();
    untracked(() => {
      if (this.uploadId()) this.loadDetail();
      else {
        this.loadSummary();
        this.load();
      }
    });
  });

  private summaryEffect = effect(() => {
    this.filterWarehouseId();
    this.filterFrom();
    this.filterTo();
    untracked(() => {
      if (this.uploadId() || this.dateRangeError()) return;
      this.loadSummary();
    });
  });

  private filtersEffect = effect(() => {
    this.filterWarehouseId();
    this.filterProduct();
    this.filterResult();
    this.filterFrom();
    this.filterTo();
    untracked(() => {
      if (this.uploadId() || this.dateRangeError()) return;
      this.page.set(0);
      this.load();
    });
  });

  constructor() {
    this.inventorySvc.warehouses().subscribe((list) => this.warehouses.set(list));

    const qpProductId = this.route.snapshot.queryParamMap.get('productId');
    const qpWarehouseId = this.route.snapshot.queryParamMap.get('warehouseId');
    if (qpWarehouseId) this.filterWarehouseId.set(qpWarehouseId);
    if (qpProductId) {
      this.filterProduct.set({ id: Number(qpProductId), name: `Producto #${qpProductId}` });
      this.filterResult.set('');
    }

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !this.uploadId()) {
        this.loadSummary();
        this.load();
      }
    }, AUTO_REFRESH_MS);
    this.destroyRef.onDestroy(() => clearInterval(interval));
  }

  protected refresh() {
    this.loadSummary();
    this.load();
  }

  protected applyCardFilter(card: SummaryCard) {
    if (card.key === 'failedCount') {
      this.filterResult.set('FAILED');
      this.filterFrom.set('');
      this.filterTo.set('');
    } else if (card.result) {
      this.filterResult.set(card.result);
    }
  }

  loadSummary() {
    this.loadingSummary.set(true);
    this.inventorySvc
      .reconciliationSummary({
        warehouseId: this.filterWarehouseId() ? Number(this.filterWarehouseId()) : undefined,
        from: this.filterFrom() || undefined,
        to: this.filterTo() || undefined,
      })
      .subscribe({
        next: (s) => {
          this.summary.set(s);
          this.loadingSummary.set(false);
        },
        error: () => this.loadingSummary.set(false),
      });
  }

  load() {
    if (this.dateRangeError()) return;
    this.loading.set(true);
    this.error.set(false);
    this.inventorySvc
      .reconciliations({
        warehouseId: this.filterWarehouseId() ? Number(this.filterWarehouseId()) : undefined,
        productId: this.filterProduct()?.id,
        result: this.filterResult() || undefined,
        from: this.filterFrom() || undefined,
        to: this.filterTo() || undefined,
        page: this.page(),
        size: 20,
      })
      .subscribe({
        next: (result) => {
          this.rows.set(result.content ?? []);
          this.totalElements.set(result.totalElements ?? 0);
          this.totalPages.set(result.totalPages ?? 0);
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
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  protected openDetail(row: StockReconciliationView) {
    this.router.navigate(['/inventario/cuadre', row.uploadId]);
  }

  protected retryFromList(row: StockReconciliationView) {
    this.retryingId.set(row.uploadId);
    this.inventorySvc.retryReconciliation(row.uploadId).subscribe({
      next: (updated) => {
        this.retryingId.set(null);
        this.rows.update((rows) =>
          rows.map((r) => (r.uploadId === updated.uploadId ? updated : r)),
        );
        this.toast.success(updated.statusCode === 'APPLIED' ? 'Subida procesada' : 'Sigue fallida');
        this.loadSummary();
      },
      error: () => {
        this.retryingId.set(null);
        this.toast.error('No pudimos reintentar la subida.');
      },
    });
  }

  loadDetail() {
    const id = Number(this.uploadId());
    if (!id) return;
    this.detailLoading.set(true);
    this.detailError.set(false);
    this.inventorySvc.reconciliationDetail(id).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.detailError.set(true);
      },
    });
  }

  protected retry(row: StockReconciliationView) {
    this.retrying.set(true);
    this.inventorySvc.retryReconciliation(row.uploadId).subscribe({
      next: () => {
        this.retrying.set(false);
        this.toast.success('Reintento enviado');
        this.loadDetail();
      },
      error: () => {
        this.retrying.set(false);
        this.toast.error('No pudimos reintentar la subida.');
      },
    });
  }

  protected highlightAsCause(d: StockReconciliationDetail, movementTypeCode: string): boolean {
    return (
      reconciliationResultTone(d.reconciliation) === 'red' &&
      (movementTypeCode === 'MANUAL_ADJUSTMENT' || movementTypeCode === 'ADVANCE_IN')
    );
  }

  protected processNow() {
    this.processing.set(true);
    this.inventorySvc.processReconciliations().subscribe({
      next: (result) => {
        this.processing.set(false);
        this.toast.success(
          result.processed === 0
            ? 'No había subidas en cola'
            : `${result.processed} subidas procesadas`,
        );
        this.loadSummary();
        this.load();
      },
      error: () => {
        this.processing.set(false);
        this.toast.error('No pudimos procesar la cola.');
      },
    });
  }
}
