import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { InventoryAdminService } from './inventory-admin';
import {
  ReconciliationResultFilter,
  StockReconciliationView,
  WarehouseView,
} from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';
import {
  BADGE_TONE_VAR,
  RECONCILIATION_RESULT_OPTIONS,
  reconciliationResultLabel,
  reconciliationResultTone,
} from './inventory-format';

const RESULT_OPTIONS = RECONCILIATION_RESULT_OPTIONS.filter((o) => o.value !== 'SHORTFALL');

/**
 * Historia de un producto — buscador de la Cuadre con el ERP (doc 56,
 * sección 9.3: "Buscar producto" no usa el listado de actualizaciones,
 * abre esta historia que ya existía en el doc 35).
 */
@Component({
  selector: 'app-stock-reconciliation-product-history',
  imports: [RouterLink, UiButton, UiField, UiEmpty],
  template: `
    <section class="eph-page">
      <button uiButton variant="ghost" size="sm" routerLink="/inventario/cuadre" class="eph-back">
        ← Actualizaciones
      </button>
      <h1>{{ productName() || 'Historia del producto' }}</h1>
      @if (productCode()) {
        <p class="eph-sub">{{ productCode() }}</p>
      }

      <div class="eph-filters">
        <ui-field
          label="Almacén"
          type="select"
          [(value)]="filterWarehouseId"
          [options]="warehouseOptions()"
        />
        <ui-field
          label="Resultado"
          type="select"
          [(value)]="filterResult"
          [options]="resultOptions"
        />
      </div>

      @if (loading()) {
        <div class="eph-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar la historia del producto"
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (rows().length === 0) {
        <ui-empty title="Sin cuadres" body="Este producto no tiene cuadres con este filtro." />
      } @else {
        <table class="ui-table-grid eph-table">
          <thead>
            <tr>
              <th>Almacén</th>
              <th>ERP</th>
              <th>Antes</th>
              <th>Ajuste</th>
              <th>Después</th>
              <th>Resultado</th>
              <th>Procesado</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.uploadId) {
              <tr class="eph-row" (click)="openDetail(row)">
                <td class="eph-muted">{{ row.warehouseName }}</td>
                <td class="eph-muted">{{ row.erpQuantity ?? '—' }}</td>
                <td class="eph-muted">{{ row.stockBefore ?? '—' }}</td>
                <td
                  class="eph-qty"
                  [class.eph-positive]="(row.appliedDelta ?? 0) > 0"
                  [class.eph-negative]="(row.appliedDelta ?? 0) < 0"
                >
                  @if (row.appliedDelta != null) {
                    {{ row.appliedDelta > 0 ? '+' : '' }}{{ row.appliedDelta }}
                  } @else {
                    —
                  }
                </td>
                <td class="eph-muted">{{ row.stockAfter ?? '—' }}</td>
                <td>
                  <span class="eph-badge" [style.color]="'var(' + toneOf(row) + ')'">{{
                    resultLabel(row)
                  }}</span>
                </td>
                <td class="eph-muted">{{ dateTimeText(row.processedAt) }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="eph-pager">
          <button
            uiButton
            variant="secondary"
            size="sm"
            [disabled]="page() === 0"
            (click)="prevPage()"
          >
            Anterior
          </button>
          <span class="eph-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
    </section>
  `,
  styles: [
    `
      .eph-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .eph-back {
        margin-bottom: 12px;
      }
      h1 {
        font: var(--fw-h1, var(--fw-display)) var(--fs-h1, var(--fs-display)) /
          var(--lh-h1, var(--lh-display)) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .eph-sub {
        margin: 0 0 16px;
        color: var(--ink-muted);
        font-size: 13px;
      }
      .eph-filters {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
        gap: 12px;
        padding-bottom: 16px;
        margin-bottom: 16px;
        border-bottom: var(--border-hair);
      }
      .eph-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .eph-table {
        width: 100%;
      }
      .eph-row {
        cursor: pointer;
      }
      .eph-row:hover {
        background: var(--faint);
      }
      .eph-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .eph-qty {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .eph-positive {
        color: var(--st-open);
      }
      .eph-negative {
        color: var(--st-mismatch);
      }
      .eph-badge {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: var(--ls-label);
      }
      .eph-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 20px;
      }
      .eph-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 767px) {
        .eph-page {
          padding: var(--sp-4);
        }
        .eph-table {
          display: block;
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class StockReconciliationProductHistoryPage {
  private inventorySvc = inject(InventoryAdminService);
  private router = inject(Router);

  productId = input.required<string>();

  protected dateTimeText = dateTimeText;
  protected resultOptions = RESULT_OPTIONS;
  protected resultLabel = reconciliationResultLabel;
  protected toneOf = (row: StockReconciliationView) =>
    BADGE_TONE_VAR[reconciliationResultTone(row)];

  protected warehouses = signal<WarehouseView[]>([]);
  protected filterWarehouseId = signal('');
  protected filterResult = signal<ReconciliationResultFilter | ''>('');

  protected rows = signal<StockReconciliationView[]>([]);
  protected page = signal(0);
  protected totalPages = signal(0);
  protected loading = signal(true);
  protected error = signal(false);

  protected productName = computed(() => this.rows()[0]?.productName ?? '');
  protected productCode = computed(() => this.rows()[0]?.productCode ?? '');

  protected warehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todos' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  private filtersEffect = effect(() => {
    this.filterWarehouseId();
    this.filterResult();
    untracked(() => {
      this.page.set(0);
      this.load();
    });
  });

  constructor() {
    this.inventorySvc.warehouses().subscribe((list) => this.warehouses.set(list));
  }

  load() {
    const productId = Number(this.productId());
    if (!productId) return;
    this.loading.set(true);
    this.error.set(false);
    this.inventorySvc
      .reconciliations({
        productId,
        warehouseId: this.filterWarehouseId() ? Number(this.filterWarehouseId()) : undefined,
        result: this.filterResult() || undefined,
        page: this.page(),
        size: 20,
      })
      .subscribe({
        next: (result) => {
          this.rows.set(result.content ?? []);
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
}
