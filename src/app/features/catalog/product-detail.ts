import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { UiButton } from '../../shared/ui/button/button';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { AuthService } from '../../core/auth/auth';
import { ProductAdminService } from './product-admin';
import { PriceAdminService } from './price-admin';
import { CatalogLookupService } from './catalog-lookup';
import { ProductFormDialog } from './ui/product-form-dialog';
import { PriceFormDialog, PriceFormDialogData } from './ui/price-form-dialog';
import { ProductView } from '../../shared/models/catalog.models';
import { PriceView } from '../../shared/models/price.models';
import { WarehouseView } from '../../shared/models/inventory.models';
import { formatSoles } from '../../shared/pipes/money';

/**
 * Ficha de producto (GET /catalog/products/{id}) + escala de precios
 * (GET /prices/by-product/{id}). El endpoint no expone si el producto está
 * activo/inactivo — solo ofrece las acciones de activar/desactivar.
 */
@Component({
  selector: 'app-product-detail',
  imports: [UiButton, UiEmpty],
  template: `
    <section class="pd-page">
      @if (loading()) {
        <div class="pd-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (error()) {
        <ui-empty
          variant="error"
          title="No pudimos cargar el producto"
          body="Intenta de nuevo en unos segundos."
          actionLabel="Reintentar"
          (action)="load()"
        />
      } @else if (product(); as p) {
        <div class="pd-head">
          <div>
            <p class="pd-eyebrow">{{ p.code }}</p>
            <h1>{{ p.name }}</h1>
            <p class="pd-meta">{{ p.familyName }} · {{ p.brandName }}</p>
          </div>
          @if (canEdit()) {
            <div class="pd-actions">
              <button uiButton variant="secondary" (click)="edit(p)">Editar</button>
              <button uiButton variant="secondary" (click)="activate(p)">Activar</button>
              <button uiButton variant="secondary" (click)="deactivate(p)">Desactivar</button>
            </div>
          }
        </div>

        <div class="pd-grid">
          <div class="pd-field">
            <span class="pd-label">Código de barras</span>
            <span class="pd-value">{{ p.barcode || '—' }}</span>
          </div>
          <div class="pd-field">
            <span class="pd-label">Unidad de medida</span>
            <span class="pd-value">{{ p.unitOfMeasure || '—' }}</span>
          </div>
          <div class="pd-field">
            <span class="pd-label">Unidades por bulto</span>
            <span class="pd-value">{{ p.unitsPerPackage ?? '—' }}</span>
          </div>
          <div class="pd-field">
            <span class="pd-label">Peso</span>
            <span class="pd-value">{{ p.weightKg ?? '—' }} kg</span>
          </div>
          <div class="pd-field">
            <span class="pd-label">Elegible para bonificación</span>
            <span class="pd-value">{{ p.isBonusEligible ? 'Sí' : 'No' }}</span>
          </div>
          <div class="pd-field">
            <span class="pd-label">Stock ({{ warehouseName() }})</span>
            <span class="pd-value pd-value-strong">{{ p.stock }}</span>
          </div>
        </div>

        @if (showPrices()) {
          <div class="pd-prices-head">
            <h2 class="pd-section-title">Escala de precios</h2>
            @if (canEditPrices()) {
              <button uiButton variant="secondary" size="sm" (click)="addPrice(p)">
                Agregar precio
              </button>
            }
          </div>

          @if (pricesLoading()) {
            <div class="pd-prices-skeleton" role="status" aria-label="Cargando"></div>
          } @else if (prices().length === 0) {
            <ui-empty
              title="Sin precios configurados"
              body="Este producto todavía no tiene ninguna fila de precio."
            />
          } @else {
            <table class="ui-table-grid pd-prices-table">
              <thead>
                <tr>
                  <th>Condición de pago</th>
                  <th>Tipo de cliente</th>
                  <th>Cant. mínima</th>
                  <th>Precio</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (price of prices(); track price.priceId) {
                  <tr>
                    <td>{{ price.paymentConditionName }}</td>
                    <td class="pd-muted">
                      {{ price.customerTypeName || '#' + price.customerTypeId }}
                    </td>
                    <td class="pd-muted">{{ price.minQuantity }}</td>
                    <td class="pd-cell-strong">{{ formatSoles(price.unitPrice) }}</td>
                    <td class="pd-row-actions">
                      @if (canEditPrices()) {
                        <button uiButton variant="ghost" size="sm" (click)="editPrice(p, price)">
                          Editar
                        </button>
                        <button uiButton variant="ghost" size="sm" (click)="deletePrice(price)">
                          Eliminar
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        }
      }
    </section>
  `,
  styles: [
    `
      .pd-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .pd-skeleton,
      .pd-prices-skeleton {
        height: 200px;
        background: var(--faint);
      }
      .pd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      .pd-eyebrow {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 4px 0 4px;
        color: var(--ink);
      }
      .pd-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .pd-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .pd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
        gap: 20px;
        margin-top: 20px;
      }
      .pd-field {
        display: grid;
        gap: 4px;
      }
      .pd-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .pd-value {
        font-size: 15px;
        color: var(--ink);
      }
      .pd-value-strong {
        font-weight: 800;
      }
      .pd-prices-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-top: 32px;
      }
      .pd-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .pd-prices-table {
        margin-top: 14px;
      }
      .pd-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .pd-cell-strong {
        font-weight: 800;
      }
      .pd-row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }

      @media (max-width: 767px) {
        .pd-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class ProductDetailPage {
  private productSvc = inject(ProductAdminService);
  private priceSvc = inject(PriceAdminService);
  private lookupSvc = inject(CatalogLookupService);
  private dialog = inject(UiDialogService);
  private auth = inject(AuthService);

  productId = input('', { alias: 'productId' });
  warehouseIdParam = input('', { alias: 'warehouseId' });

  protected formatSoles = formatSoles;

  protected canEdit = computed(() => this.auth.hasAny('product.edit'));
  protected showPrices = computed(() => this.auth.hasAny('price.view', 'price.edit'));
  protected canEditPrices = computed(() => this.auth.hasAny('price.edit'));

  protected product = signal<ProductView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  protected prices = signal<PriceView[]>([]);
  protected pricesLoading = signal(true);

  protected warehouses = signal<WarehouseView[]>([]);
  protected resolvedWarehouseId = signal<number | null>(null);

  protected warehouseName = computed(() => {
    const id = this.resolvedWarehouseId();
    return this.warehouses().find((w) => w.warehouseId === id)?.name ?? '—';
  });

  private loadEffect = effect(() => {
    const id = this.productId();
    const paramWarehouseId = this.warehouseIdParam();
    if (!id) return;
    if (paramWarehouseId) {
      this.resolvedWarehouseId.set(Number(paramWarehouseId));
      this.load();
    } else if (this.warehouses().length > 0) {
      this.resolvedWarehouseId.set(this.warehouses()[0].warehouseId);
      this.load();
    }
  });

  constructor() {
    this.lookupSvc.warehouses().subscribe({ next: (list) => this.warehouses.set(list) });
    if (this.showPrices()) this.loadPrices();
  }

  load() {
    const id = Number(this.productId());
    const warehouseId = this.resolvedWarehouseId();
    if (!id || !warehouseId) return;
    this.loading.set(true);
    this.error.set(false);
    this.productSvc.detail(id, warehouseId).subscribe({
      next: (detail) => {
        this.product.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private loadPrices() {
    const id = Number(this.productId());
    if (!id) return;
    this.pricesLoading.set(true);
    this.priceSvc.byProduct(id).subscribe({
      next: (list) => {
        this.prices.set(list);
        this.pricesLoading.set(false);
      },
      error: () => this.pricesLoading.set(false),
    });
  }

  protected edit(p: ProductView) {
    this.dialog
      .open<ProductFormDialog, { product: ProductView }, { productId: number } | false>(
        ProductFormDialog,
        { data: { product: p }, width: '640px' },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  protected activate(p: ProductView) {
    this.productSvc.activate(p.productId).subscribe(() => this.load());
  }

  protected deactivate(p: ProductView) {
    this.dialog
      .confirm({
        title: 'Desactivar producto',
        message: `¿Desactivar "${p.name}"? Dejará de aparecer disponible para nuevos pedidos.`,
        confirmLabel: 'Desactivar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.productSvc.deactivate(p.productId).subscribe(() => this.load());
      });
  }

  protected addPrice(p: ProductView) {
    this.openPriceDialog({ productId: p.productId, productName: p.name });
  }

  protected editPrice(p: ProductView, price: PriceView) {
    this.openPriceDialog({ productId: p.productId, productName: p.name, price });
  }

  private openPriceDialog(data: PriceFormDialogData) {
    this.dialog
      .open<PriceFormDialog, PriceFormDialogData, PriceView | false>(PriceFormDialog, {
        data,
        width: '560px',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.loadPrices();
      });
  }

  protected deletePrice(price: PriceView) {
    this.dialog
      .confirm({
        title: 'Eliminar precio',
        message: `¿Eliminar el precio de ${price.paymentConditionName} (mín. ${price.minQuantity})? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.priceSvc.remove(price.priceId).subscribe(() => this.loadPrices());
      });
  }
}
