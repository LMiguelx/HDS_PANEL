import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { InventoryAdminService } from './inventory-admin';
import { KardexResponse, WarehouseView } from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';
import { movementReference } from './inventory-format';

/**
 * Historial de movimientos de un producto en un almacén — GET
 * /inventory/kardex/{id}. `report.view`. Punto de llegada común para saber
 * qué pasó con un producto: el nombre del tipo y de quien lo hizo ya llegan
 * listos desde el backend (doc 35, sección 9).
 */
@Component({
  selector: 'app-kardex',
  imports: [RouterLink, UiButton, UiField, UiEmpty],
  template: `
    <section class="kx-page">
      @if (loading()) {
        <div class="kx-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el kardex"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (kardex(); as k) {
        <div class="kx-head">
          <div>
            <h1>{{ k.productName }}</h1>
            <p class="kx-meta">
              Stock actual en este almacén: <strong>{{ k.currentStock }}</strong>
            </p>
          </div>
          <ui-field
            label="Almacén"
            type="select"
            [value]="selectedWarehouseId()"
            (valueChange)="onWarehouseChange($event)"
            [options]="warehouseOptions()"
            class="kx-warehouse-select"
          />
        </div>

        @if (k.movements.content.length === 0) {
          <ui-empty
            title="Sin movimientos"
            body="Este producto no tiene movimientos en este almacén."
          />
        } @else {
          <table class="ui-table-grid kx-table">
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
              @for (m of k.movements.content; track m.stockMovementId) {
                <tr>
                  <td class="kx-muted">{{ dateTimeText(m.createdAt) }}</td>
                  <td>{{ m.movementTypeName }}</td>
                  <td
                    [class.kx-negative]="m.quantity < 0"
                    [class.kx-positive]="m.quantity > 0"
                    class="kx-qty"
                  >
                    {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                  </td>
                  <td>
                    @if (ref(m).route) {
                      <a [routerLink]="ref(m).route" class="kx-link">{{ ref(m).text }}</a>
                    } @else {
                      <span class="kx-muted">{{ ref(m).text }}</span>
                    }
                  </td>
                  <td class="kx-muted">{{ m.note || '—' }}</td>
                  <td class="kx-muted">{{ m.createdByName || 'Automático' }}</td>
                </tr>
              }
            </tbody>
          </table>

          <div class="kx-pager">
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() === 0"
              (click)="prevPage()"
            >
              Anterior
            </button>
            <span class="kx-pager-label">
              Página {{ page() + 1 }} de {{ k.movements.totalPages || 1 }}
            </span>
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() + 1 >= k.movements.totalPages"
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
      .kx-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .kx-skeleton {
        height: 240px;
        background: var(--faint);
      }
      .kx-head {
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
      .kx-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .kx-meta strong {
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .kx-warehouse-select {
        width: 220px;
      }
      .kx-table {
        margin-top: 20px;
        width: 100%;
      }
      .kx-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .kx-link {
        font-size: 13px;
        color: var(--accent-ink);
      }
      .kx-qty {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
      }
      .kx-positive {
        color: var(--st-open);
      }
      .kx-negative {
        color: var(--accent-ink);
      }
      .kx-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .kx-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }

      @media (max-width: 767px) {
        .kx-page {
          padding: var(--sp-4);
        }
        .kx-table {
          display: block;
          overflow-x: auto;
        }
      }
    `,
  ],
})
export class KardexPage {
  private inventorySvc = inject(InventoryAdminService);
  private router = inject(Router);

  productId = input('', { alias: 'productId' });
  warehouseId = input('', { alias: 'warehouseId' });

  protected dateTimeText = dateTimeText;
  protected ref = (m: { referenceTable: string | null; referenceId: string | null }) =>
    movementReference(m.referenceTable, m.referenceId);

  protected kardex = signal<KardexResponse | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected page = signal(0);

  protected warehouses = signal<WarehouseView[]>([]);
  protected selectedWarehouseId = signal('');
  protected warehouseOptions = computed<UiFieldOption[]>(() =>
    this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  );

  private loadEffect = effect(() => {
    if (this.productId() && this.warehouseId()) {
      this.selectedWarehouseId.set(this.warehouseId());
      this.page.set(0);
      this.load();
    }
  });

  constructor() {
    this.inventorySvc.warehouses().subscribe((list) => this.warehouses.set(list));
  }

  protected onWarehouseChange(value: string) {
    if (value === this.warehouseId()) return;
    this.router.navigate(['/inventario/kardex', this.productId()], {
      queryParams: { warehouseId: value },
    });
  }

  load() {
    const productId = Number(this.productId());
    const warehouseId = Number(this.warehouseId());
    if (!productId || !warehouseId) return;
    this.loading.set(true);
    this.error.set(false);
    this.inventorySvc.kardex(productId, warehouseId, this.page()).subscribe({
      next: (result) => {
        this.kardex.set(result);
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
    this.page.update((p) => p + 1);
    this.load();
  }
}
