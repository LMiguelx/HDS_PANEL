import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiInfoTip } from '../../shared/ui/info-tip/info-tip';
import { InventoryModuleTabs } from './ui/module-tabs';
import { InventoryAdminService } from './inventory-admin';
import { AuthService } from '../../core/auth/auth';
import { WarehouseStockItem, WarehouseView } from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';

const ADVANCES_PAGE_SIZE = 100;

/**
 * Foto completa del stock de un almacén — GET
 * /inventory/warehouses/{id}/stock, sin paginar (el frontend filtra por
 * texto/familia/marca sobre la respuesta ya traída, como indica el doc).
 * Cruza además los adelantos abiertos del almacén para mostrar cuánto de
 * cada producto todavía no llegó físicamente (doc 35, sección 5.2).
 */
@Component({
  selector: 'app-warehouse-stock',
  imports: [RouterLink, UiButton, UiField, UiTable, UiEmpty, UiInfoTip, InventoryModuleTabs],
  template: `
    <app-inventory-module-tabs />
    <section class="ws-page">
      <div class="ws-head">
        <h1>Stock por almacén</h1>
        <p class="ws-sub">
          Foto actual del almacén elegido. Clic en un producto para ver su kardex.
        </p>
      </div>

      <div class="ws-filters">
        <ui-field
          label="Almacén"
          type="select"
          [(value)]="warehouseId"
          [options]="warehouseOptions()"
          [disabled]="loadingWarehouses()"
        />
        <ui-field label="Buscar" [(value)]="q" placeholder="Código o nombre" />
      </div>

      @if (!warehouseId()) {
        <ui-empty title="Elige un almacén" body="Selecciona un almacén para ver su stock." />
      } @else {
        <div class="ws-indicators">
          <span class="ws-indicator"
            ><strong>{{ filteredItems().length }}</strong> productos</span
          >
          <span class="ws-indicator" [class.ws-indicator-warn]="noStockCount() > 0">
            <strong>{{ noStockCount() }}</strong> sin stock
          </span>
          <span
            class="ws-indicator ws-indicator-amber"
            [class.ws-indicator-dim]="withAdvanceCount() === 0"
          >
            <strong>{{ withAdvanceCount() }}</strong> con adelanto pendiente
          </span>
        </div>

        <ui-table
          [loading]="loading()"
          [error]="error()"
          errorMessage="No pudimos cargar el stock."
          [empty]="!loading() && !error() && filteredItems().length === 0"
          (retry)="load()"
        >
          <div empty>
            <ui-empty title="Sin resultados" body="No encontramos productos con ese filtro." />
          </div>

          <table class="ui-table-grid ws-table-desktop">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Marca</th>
                <th>Und.</th>
                <th>Stock</th>
                <th>
                  Adelantado
                  <span
                    uiInfoTip="Parte del stock que todavía no llegó físicamente. Clic: ver sus adelantos."
                  ></span>
                </th>
                <th>Actualiz.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.productId) {
                <tr [class.ws-row-dim]="item.quantity === 0">
                  <td class="ws-muted">{{ item.productCode }}</td>
                  <td class="ws-cell-strong">
                    <a
                      class="ws-product-link"
                      [routerLink]="['/inventario/kardex', item.productId]"
                      [queryParams]="{ warehouseId: warehouseId() }"
                    >
                      {{ item.productName }}
                    </a>
                    <div class="ws-muted">{{ item.brandName }} · {{ item.familyName }}</div>
                  </td>
                  <td class="ws-muted">{{ item.brandName }}</td>
                  <td class="ws-muted">{{ item.unitOfMeasure }}</td>
                  <td class="ws-qty">{{ item.quantity }}</td>
                  <td>
                    @if (advancedQty(item.productId); as adv) {
                      <button type="button" class="ws-advance-badge" (click)="goToAdvances(item)">
                        ● {{ adv }}
                      </button>
                    } @else {
                      <span class="ws-muted">—</span>
                    }
                  </td>
                  <td class="ws-muted">{{ dateTimeText(item.updatedAt) }}</td>
                  <td class="ws-row-actions">
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      [routerLink]="['/inventario/kardex', item.productId]"
                      [queryParams]="{ warehouseId: warehouseId() }"
                    >
                      Kardex
                    </button>
                    @if (canAdvance()) {
                      <button uiButton variant="ghost" size="sm" (click)="goToAdvances(item)">
                        Adelantar
                      </button>
                    }
                    @if (canAdjust()) {
                      <button uiButton variant="ghost" size="sm" (click)="goToAdjust(item)">
                        Corregir
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="ws-cards-mobile">
            @for (item of filteredItems(); track item.productId) {
              <div class="ws-card-mobile" [class.ws-row-dim]="item.quantity === 0">
                <a
                  [routerLink]="['/inventario/kardex', item.productId]"
                  [queryParams]="{ warehouseId: warehouseId() }"
                  class="ws-card-mobile-head"
                >
                  <span class="ws-card-mobile-name">{{ item.productName }}</span>
                  <span class="ws-muted">{{ item.quantity }} {{ item.unitOfMeasure }}</span>
                </a>
                <div class="ws-muted">{{ item.productCode }} · {{ item.brandName }}</div>
                @if (advancedQty(item.productId); as adv) {
                  <button
                    type="button"
                    class="ws-advance-badge ws-advance-badge-mobile"
                    (click)="goToAdvances(item)"
                  >
                    ● {{ adv }} adelantado
                  </button>
                }
              </div>
            }
          </div>
        </ui-table>
      }
    </section>
  `,
  styles: [
    `
      .ws-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .ws-head {
        margin-top: 20px;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .ws-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .ws-filters {
        display: grid;
        grid-template-columns: 220px minmax(200px, 1fr);
        gap: 12px;
        margin: 20px 0;
      }
      .ws-indicators {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        padding: 10px 0 16px;
        border-bottom: var(--border-hair);
        margin-bottom: 16px;
        font-size: 13px;
        color: var(--ink-muted);
      }
      .ws-indicator strong {
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .ws-indicator-warn strong {
        color: var(--st-mismatch);
      }
      .ws-indicator-amber strong {
        color: var(--st-in-route);
      }
      .ws-indicator-dim {
        opacity: 0.6;
      }
      .ws-cell-strong {
        font-weight: 800;
      }
      .ws-product-link {
        color: var(--ink);
        text-decoration: none;
      }
      .ws-product-link:hover {
        color: var(--accent-ink);
        text-decoration: underline;
      }
      .ws-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .ws-qty {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .ws-row-dim {
        opacity: 0.5;
      }
      .ws-advance-badge {
        appearance: none;
        border: none;
        background: transparent;
        color: var(--st-in-route);
        font-weight: 800;
        font-size: 13px;
        cursor: pointer;
        padding: 0;
      }
      .ws-advance-badge:hover {
        text-decoration: underline;
      }
      .ws-advance-badge-mobile {
        justify-self: start;
      }
      .ws-row-actions {
        text-align: right;
        white-space: nowrap;
      }
      .ws-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .ws-page {
          padding: var(--sp-4);
        }
        .ws-filters {
          grid-template-columns: 1fr;
        }
        .ws-table-desktop {
          display: none;
        }
        .ws-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .ws-card-mobile {
          display: grid;
          gap: 4px;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
        }
        .ws-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          text-decoration: none;
          color: var(--ink);
        }
        .ws-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class WarehouseStockPage {
  private inventorySvc = inject(InventoryAdminService);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected dateTimeText = dateTimeText;
  protected warehouseId = signal('');
  protected q = signal('');

  protected warehouses = signal<WarehouseView[]>([]);
  protected loadingWarehouses = signal(true);

  protected items = signal<WarehouseStockItem[]>([]);
  protected loading = signal(false);
  protected error = signal(false);

  /** Suma de pendingQuantity por productId, de los adelantos abiertos del almacén. */
  protected advancedByProduct = signal<Map<number, number>>(new Map());

  protected canAdvance = computed(() => this.auth.hasAny('stock.advance'));
  protected canAdjust = computed(() => this.auth.hasAny('config.edit'));

  protected warehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: this.loadingWarehouses() ? 'Cargando…' : 'Selecciona un almacén' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  protected filteredItems = computed(() => {
    const q = this.q().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (i) => i.productName.toLowerCase().includes(q) || i.productCode.toLowerCase().includes(q),
    );
  });

  protected noStockCount = computed(
    () => this.filteredItems().filter((i) => i.quantity === 0).length,
  );
  protected withAdvanceCount = computed(
    () => this.filteredItems().filter((i) => this.advancedByProduct().has(i.productId)).length,
  );

  private warehouseEffect = effect(() => {
    this.warehouseId();
    untracked(() => {
      if (this.warehouseId()) this.load();
    });
  });

  constructor() {
    this.inventorySvc.warehouses().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.loadingWarehouses.set(false);
        if (list.length > 0) this.warehouseId.set(String(list[0].warehouseId));
      },
      error: () => this.loadingWarehouses.set(false),
    });
  }

  protected advancedQty(productId: number): number | null {
    return this.advancedByProduct().get(productId) ?? null;
  }

  load() {
    const warehouseId = Number(this.warehouseId());
    if (!warehouseId) return;
    this.loading.set(true);
    this.error.set(false);
    forkJoin([
      this.inventorySvc.warehouseStock(warehouseId),
      this.loadAllOpenAdvances(warehouseId),
    ]).subscribe({
      next: ([stock, advances]) => {
        this.items.set(stock.items ?? []);
        const byProduct = new Map<number, number>();
        for (const a of advances) {
          byProduct.set(a.productId, (byProduct.get(a.productId) ?? 0) + a.pendingQuantity);
        }
        this.advancedByProduct.set(byProduct);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  /** Trae todas las páginas de adelantos abiertos del almacén (doc 35, sección 5.2). */
  private loadAllOpenAdvances(warehouseId: number) {
    return this.inventorySvc
      .stockAdvances({ warehouseId, onlyOpen: true, size: ADVANCES_PAGE_SIZE, page: 0 })
      .pipe(
        switchMap((first) => {
          if (first.totalPages <= 1) return of(first.content ?? []);
          const rest = Array.from({ length: first.totalPages - 1 }, (_, i) =>
            this.inventorySvc.stockAdvances({
              warehouseId,
              onlyOpen: true,
              size: ADVANCES_PAGE_SIZE,
              page: i + 1,
            }),
          );
          return forkJoin(rest).pipe(
            map((pages) => [...(first.content ?? []), ...pages.flatMap((p) => p.content ?? [])]),
          );
        }),
        catchError(() => of([])),
      );
  }

  protected goToAdvances(item: WarehouseStockItem) {
    this.router.navigate(['/inventario/adelantos'], {
      queryParams: { productId: item.productId, warehouseId: this.warehouseId() },
    });
  }

  protected goToAdjust(item: WarehouseStockItem) {
    this.router.navigate(['/inventario/ajuste'], {
      queryParams: {
        productCode: item.productCode,
        productName: item.productName,
        warehouseId: this.warehouseId(),
      },
    });
  }
}
