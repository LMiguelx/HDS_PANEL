import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { InventoryModuleTabs } from './ui/module-tabs';
import { InventoryAdminService } from './inventory-admin';
import { WarehouseStockItem, WarehouseView } from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';

/**
 * Foto completa del stock de un almacén — GET
 * /inventory/warehouses/{id}/stock, sin paginar (el frontend filtra por
 * texto/familia/marca sobre la respuesta ya traída, como indica el doc).
 */
@Component({
  selector: 'app-warehouse-stock',
  imports: [RouterLink, UiButton, UiField, UiTable, UiEmpty, InventoryModuleTabs],
  template: `
    <app-inventory-module-tabs />
    <section class="ws-page">
      <div class="ws-head">
        <h1>Stock por almacén</h1>
        <p class="ws-sub">{{ countText() }}</p>
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
                <th>Nombre</th>
                <th>Familia</th>
                <th>Marca</th>
                <th>Cantidad</th>
                <th>Actualizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.productId) {
                <tr>
                  <td class="ws-muted">{{ item.productCode }}</td>
                  <td class="ws-cell-strong">{{ item.productName }}</td>
                  <td class="ws-muted">{{ item.familyName }}</td>
                  <td class="ws-muted">{{ item.brandName }}</td>
                  <td class="ws-muted">{{ item.quantity }} {{ item.unitOfMeasure }}</td>
                  <td class="ws-muted">{{ dateTimeText(item.updatedAt) }}</td>
                  <td class="ws-row-action">
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      [routerLink]="['/inventario/kardex', item.productId]"
                      [queryParams]="{ warehouseId: warehouseId() }"
                    >
                      Ver kardex
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="ws-cards-mobile">
            @for (item of filteredItems(); track item.productId) {
              <a
                [routerLink]="['/inventario/kardex', item.productId]"
                [queryParams]="{ warehouseId: warehouseId() }"
                class="ws-card-mobile"
              >
                <div class="ws-card-mobile-head">
                  <span class="ws-card-mobile-name">{{ item.productName }}</span>
                  <span class="ws-muted">{{ item.quantity }} {{ item.unitOfMeasure }}</span>
                </div>
                <div class="ws-muted">{{ item.productCode }} · {{ item.familyName }}</div>
              </a>
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
        margin: 24px 0 20px;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .ws-cell-strong {
        font-weight: 800;
      }
      .ws-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .ws-row-action {
        text-align: right;
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
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .ws-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
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

  protected dateTimeText = dateTimeText;
  protected warehouseId = signal('');
  protected q = signal('');

  protected warehouses = signal<WarehouseView[]>([]);
  protected loadingWarehouses = signal(true);

  protected items = signal<WarehouseStockItem[]>([]);
  protected loading = signal(false);
  protected error = signal(false);

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

  protected countText(): string {
    const n = this.filteredItems().length;
    return n === 1 ? '1 producto' : `${n} productos`;
  }

  load() {
    const warehouseId = Number(this.warehouseId());
    if (!warehouseId) return;
    this.loading.set(true);
    this.error.set(false);
    this.inventorySvc.warehouseStock(warehouseId).subscribe({
      next: (result) => {
        this.items.set(result.items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
