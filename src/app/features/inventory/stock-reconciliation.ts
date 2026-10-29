import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
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
import { AuthService } from '../../core/auth/auth';
import { ToastService } from '../../core/ui/toast';
import {
  ErpSyncView,
  StockReconciliationSummary,
  WarehouseView,
} from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';
import { quantityText } from '../sales-reports/sales-report-format';
import { toProductLookup } from './inventory-format';

const AUTO_REFRESH_MS = 60_000;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface SummaryCard {
  key: 'pendingUploads' | 'failedCount' | 'matchedCount' | 'increasedCount' | 'decreasedCount';
  label: string;
  tip: string;
  tone: string;
}

const CARDS: SummaryCard[] = [
  {
    key: 'pendingUploads',
    label: 'En proceso',
    tip: 'Subidas del ERP que todavía no se procesaron. Se procesan solas cada minuto; usa "Procesar ahora" si no quieres esperar.',
    tone: '--st-in-route',
  },
  {
    key: 'failedCount',
    label: 'Fallidas',
    tip: 'Subidas que no se pudieron procesar (de cualquier fecha). El stock no cambió. Reintenta cada una desde su detalle.',
    tone: '--st-mismatch',
  },
  {
    key: 'matchedCount',
    label: 'Cuadraron',
    tip: 'El stock de la app ya coincidía con el del ERP: no hizo falta ajustar nada.',
    tone: '--st-vigente',
  },
  {
    key: 'increasedCount',
    label: 'Entró mercadería',
    tip: 'La app tenía menos que el ERP y se le sumó. Casi siempre es mercadería que llegó: no es un problema.',
    tone: '--st-open',
  },
  {
    key: 'decreasedCount',
    label: 'La app tenía de más',
    tip: 'La app tenía más que el ERP y se le restó. Revisa el "Por qué" de cada producto para ver la causa.',
    tone: '--st-in-route',
  },
];

/**
 * Cuadre con el ERP — doc 56, sección 9 (reemplaza el diseño del doc 35).
 * El ERP sube todos los productos de una vez; esa tanda es una
 * "actualización del ERP" y es la unidad que ve supervisión aquí. Al abrir
 * una, solo se listan los productos con diferencia (sección 9.4). Reintentar
 * / Procesar ahora siguen siendo `stock.advance`.
 */
@Component({
  selector: 'app-stock-reconciliation',
  imports: [UiButton, UiField, UiTypeahead, UiEmpty, UiInfoTip, InventoryModuleTabs],
  template: `
    <app-inventory-module-tabs />
    <section class="esl-page">
      <div class="esl-head">
        <div>
          <h1>Cuadre con el ERP</h1>
          <p class="esl-sub">
            El ERP informa su stock real y la app se alinea sola. Cada fila es una actualización del
            ERP.
          </p>
          <p class="esl-status-line">{{ statusLine() }}</p>
        </div>
        <div class="esl-head-actions">
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

      @if (summary(); as s) {
        <div class="esl-cards">
          @for (c of cards; track c.key) {
            <div class="esl-card">
              <div class="esl-card-top">
                <span
                  class="esl-card-value"
                  [style.color]="s[c.key] > 0 ? 'var(' + c.tone + ')' : 'var(--ink)'"
                >
                  {{ s[c.key] }}
                </span>
                <span [uiInfoTip]="c.tip"></span>
              </div>
              <span class="esl-card-label">{{ c.label }}</span>
            </div>
          }
        </div>
      }

      <div class="esl-filters">
        <ui-field
          label="Almacén"
          type="select"
          [(value)]="filterWarehouseId"
          [options]="filterWarehouseOptions()"
        />
        <ui-field label="Desde" type="date" [(value)]="filterFrom" />
        <ui-field label="Hasta" type="date" [(value)]="filterTo" />
        <ui-typeahead
          label="Buscar producto"
          placeholder="Buscar por nombre"
          [clearOnPick]="true"
          [search]="productSearch"
          [(selected)]="productSearchSelected"
        />
      </div>
      @if (dateRangeError()) {
        <div class="esl-error">{{ dateRangeError() }}</div>
      }

      @if (loading()) {
        <div class="esl-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar las actualizaciones"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (syncs().length === 0) {
        <ui-empty
          variant="al-dia"
          eyebrow="Al día"
          title="El ERP no subió stock en estas fechas."
        />
      } @else {
        <table class="ui-table-grid esl-table">
          <thead>
            <tr>
              <th>Actualización</th>
              <th>Almacén</th>
              <th>Productos</th>
              <th>Cuadraron</th>
              <th>Entró mercadería</th>
              <th>La app tenía de más</th>
              <th>Fallaron</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of syncs(); track s.firstUploadId + '-' + s.lastUploadId) {
              <tr class="esl-row" (click)="openSync(s)">
                <td class="esl-cell-strong">
                  {{ dateTimeText(s.startedAt) }}
                  @if (s.pendingCount > 0) {
                    <span class="esl-tag-amber">{{ s.pendingCount }} en proceso</span>
                  }
                </td>
                <td class="esl-muted">{{ s.warehouseName }}</td>
                <td class="esl-num">{{ s.productCount }}</td>
                <td class="esl-num">{{ s.matchedCount || '—' }}</td>
                <td class="esl-num esl-blue">{{ s.increasedCount || '—' }}</td>
                <td class="esl-num esl-amber">{{ s.decreasedCount || '—' }}</td>
                <td class="esl-num esl-red">{{ s.failedCount || '—' }}</td>
                <td class="esl-chevron">›</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: [
    `
      .esl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .esl-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
        margin-top: 20px;
      }
      .esl-head-actions {
        display: flex;
        gap: 10px;
        flex: none;
      }
      .esl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 13px;
        max-width: 560px;
      }
      .esl-status-line {
        margin: 6px 0 0;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .esl-cards {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin: 20px 0;
      }
      .esl-card {
        border: 1px solid var(--hairline);
        background: var(--bg);
        padding: 12px 14px;
        display: grid;
        gap: 6px;
      }
      .esl-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .esl-card-value {
        font-size: var(--fs-metric);
        font-weight: var(--fw-metric);
        font-variant-numeric: var(--tnum);
      }
      .esl-card-label {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .esl-filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
        gap: 12px;
        padding-bottom: 16px;
        margin-bottom: 16px;
        border-bottom: var(--border-hair);
      }
      .esl-error {
        color: var(--accent-ink);
        font-size: 13px;
        margin-bottom: 12px;
      }
      .esl-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .esl-table {
        width: 100%;
      }
      .esl-row {
        cursor: pointer;
      }
      .esl-row:hover {
        background: var(--faint);
      }
      .esl-cell-strong {
        font-weight: 800;
      }
      .esl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .esl-num {
        font-variant-numeric: var(--tnum);
        white-space: nowrap;
      }
      .esl-blue {
        color: var(--st-open);
        font-weight: 700;
      }
      .esl-amber {
        color: var(--st-in-route);
        font-weight: 700;
      }
      .esl-red {
        color: var(--st-mismatch);
        font-weight: 700;
      }
      .esl-tag-amber {
        margin-left: 8px;
        font-size: 11px;
        font-weight: 700;
        color: var(--st-in-route);
        white-space: nowrap;
      }
      .esl-chevron {
        color: var(--ink-muted);
        text-align: right;
        font-size: 18px;
      }

      @media (max-width: 1100px) {
        .esl-cards {
          grid-template-columns: repeat(3, 1fr);
        }
      }
      @media (max-width: 767px) {
        .esl-page {
          padding: var(--sp-4);
        }
        .esl-cards {
          grid-template-columns: repeat(2, 1fr);
        }
        .esl-table {
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
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastService);

  protected dateTimeText = dateTimeText;
  protected quantityText = quantityText;
  protected cards = CARDS;
  protected canManage = computed(() => this.auth.hasAny('stock.advance'));

  protected warehouses = signal<WarehouseView[]>([]);
  protected summary = signal<StockReconciliationSummary | null>(null);
  protected loadingSummary = signal(true);
  protected processing = signal(false);

  protected filterWarehouseId = signal('');
  protected filterFrom = signal(todayIso());
  protected filterTo = signal(todayIso());
  protected productSearchSelected = signal<UiLookupItem | null>(null);

  protected syncs = signal<ErpSyncView[]>([]);
  protected loading = signal(true);
  protected error = signal(false);

  protected filterWarehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todos' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  protected productSearch = (q: string): Observable<UiLookupItem[]> => {
    const warehouseId = Number(this.filterWarehouseId());
    if (!warehouseId || !q.trim()) return of<UiLookupItem[]>([]);
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
    if (days > 31) return 'El rango admite como máximo 31 días.';
    return '';
  });

  protected statusLine = computed(() => {
    const s = this.summary();
    if (!s) return '';
    if (!s.lastUploadAt) return 'El ERP todavía no ha subido stock.';
    return `Última actualización del ERP: ${dateTimeText(s.lastUploadAt)} · Último cuadre: ${s.lastProcessedAt ? dateTimeText(s.lastProcessedAt) : '—'}`;
  });

  private filtersEffect = effect(() => {
    this.filterWarehouseId();
    this.filterFrom();
    this.filterTo();
    untracked(() => {
      if (this.dateRangeError()) return;
      this.loadSummary();
      this.load();
    });
  });

  private productPickEffect = effect(() => {
    const picked = this.productSearchSelected();
    untracked(() => {
      if (picked) this.router.navigate(['/inventario/cuadre/producto', picked.id]);
    });
  });

  constructor() {
    this.inventorySvc.warehouses().subscribe((list) => this.warehouses.set(list));

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
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
      .erpSyncs({
        warehouseId: this.filterWarehouseId() ? Number(this.filterWarehouseId()) : undefined,
        from: this.filterFrom() || undefined,
        to: this.filterTo() || undefined,
      })
      .subscribe({
        next: (list) => {
          this.syncs.set(list);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  protected openSync(s: ErpSyncView) {
    this.router.navigate(['/inventario/cuadre/actualizacion'], {
      queryParams: {
        firstUploadId: s.firstUploadId,
        lastUploadId: s.lastUploadId,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouseName,
        startedAt: s.startedAt,
        productCount: s.productCount,
        matchedCount: s.matchedCount,
        increasedCount: s.increasedCount,
        decreasedCount: s.decreasedCount,
        failedCount: s.failedCount,
      },
    });
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
        this.refresh();
      },
      error: () => {
        this.processing.set(false);
        this.toast.error('No pudimos procesar la cola.');
      },
    });
  }
}
