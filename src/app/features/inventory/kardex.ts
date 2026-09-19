import { Component, effect, inject, input, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { InventoryAdminService } from './inventory-admin';
import { KardexResponse } from '../../shared/models/inventory.models';
import { dateTimeText } from '../assignments/assignment-format';

const MOVEMENT_TYPE_NAMES: Record<string, string> = {
  SALE_PROMISE: 'Promesa de venta',
  INVOICE_SYNC: 'Sincronizado con factura',
  RETURN: 'Devolución',
  BONUS_OUT: 'Salida por bonificación',
  BONUS_SUBSTITUTION: 'Sustitución de bonificación',
  MANUAL_ADJUSTMENT: 'Ajuste manual',
  ERP_SYNC: 'Sincronizado con ERP',
  ORDER_EDIT: 'Edición de pedido',
  BONUS_REVERSAL: 'Reversión de bonificación',
};

/** Historial de movimientos de un producto en un almacén — GET /inventory/kardex/{id}. `report.view`. */
@Component({
  selector: 'app-kardex',
  imports: [UiButton, UiEmpty],
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
            <p class="kx-meta">Stock actual: {{ k.currentStock }}</p>
          </div>
        </div>

        @if (k.movements.content.length === 0) {
          <ui-empty title="Sin movimientos" body="Este producto no tiene movimientos registrados." />
        } @else {
          <table class="ui-table-grid kx-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              @for (m of k.movements.content; track m.stockMovementId) {
                <tr>
                  <td class="kx-muted">{{ dateTimeText(m.createdAt) }}</td>
                  <td>{{ movementTypeName(m.movementTypeCode) }}</td>
                  <td [class.kx-negative]="m.quantity < 0" class="kx-qty">{{ m.quantity }}</td>
                  <td class="kx-muted">{{ m.note || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>

          <div class="kx-pager">
            <button uiButton variant="secondary" size="sm" [disabled]="page() === 0" (click)="prevPage()">
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
      .kx-table {
        margin-top: 20px;
      }
      .kx-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .kx-qty {
        font-weight: 800;
        font-variant-numeric: var(--tnum);
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
      }
    `,
  ],
})
export class KardexPage {
  private inventorySvc = inject(InventoryAdminService);

  productId = input('', { alias: 'productId' });
  warehouseId = input('', { alias: 'warehouseId' });

  protected dateTimeText = dateTimeText;
  protected kardex = signal<KardexResponse | null>(null);
  protected loading = signal(true);
  protected error = signal(false);
  protected page = signal(0);

  private loadEffect = effect(() => {
    if (this.productId() && this.warehouseId()) this.load();
  });

  protected movementTypeName(code: string): string {
    return MOVEMENT_TYPE_NAMES[code] ?? code;
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
