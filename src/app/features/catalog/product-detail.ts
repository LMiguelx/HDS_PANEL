import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiCard } from '../../shared/ui/card/card';
import { UiStatus } from '../../shared/ui/status/status';
import { UiBadge } from '../../shared/ui/badge/badge';
import { UiMenu } from '../../shared/ui/menu/menu';
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
import { dateTimeText } from '../assignments/assignment-format';

/**
 * Ficha de producto (GET /catalog/products/{id}) + escala de precios
 * (GET /prices/by-product/{id}), cada una con su propia carga y estado —
 * doc 38, sección 7. La escala antes nunca se pedía porque `loadPrices()`
 * leía `productId()` en el constructor, cuando el input de ruta todavía
 * está vacío (ARCHITECTURE_PANEL 8.9 / doc 38 sección 2.1): ahora se carga
 * con un `effect()` reactivo, igual que el detalle.
 */
@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, UiButton, UiEmpty, UiCard, UiStatus, UiBadge, UiMenu],
  template: `
    <section class="pd-page">
      <p class="pd-breadcrumb"><a routerLink="/precios">Catálogo y precios</a> › Producto</p>

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
        <ui-card class="pd-head-card">
          <div class="pd-head">
            <div class="pd-head-identity">
              <span class="pd-icon-badge">
                <span class="material-icons" aria-hidden="true">inventory_2</span>
              </span>
              <div>
                <div class="pd-head-chips">
                  <span class="pd-code-chip">{{ p.code }}</span>
                  <ui-status
                    [label]="p.active ? 'Activo' : 'Inactivo'"
                    [status]="p.active ? 'vigente' : 'vencida'"
                  />
                </div>
                <h1>{{ p.name }}</h1>
                <p class="pd-meta">{{ p.familyName }} · {{ p.brandName }}</p>
              </div>
            </div>
            <div class="pd-actions">
              @if (canViewKardex()) {
                <button
                  uiButton
                  variant="secondary"
                  [routerLink]="['/inventario/kardex', p.productId]"
                  [queryParams]="{ warehouseId: resolvedWarehouseId() }"
                >
                  Ver kardex
                </button>
              }
              @if (canEdit()) {
                <button uiButton variant="primary" (click)="edit(p)">
                  <span class="material-icons" aria-hidden="true">edit</span>
                  Editar
                </button>
                <ui-menu label="Más acciones">
                  @if (p.active) {
                    <button type="button" (click)="deactivate(p)">Desactivar producto</button>
                  } @else {
                    <button type="button" (click)="activate(p)">Activar producto</button>
                  }
                </ui-menu>
              }
            </div>
          </div>
        </ui-card>

        <div class="pd-grid">
          <ui-card class="pd-prices-card">
            @if (!p.active) {
              <p class="pd-inactive-notice">
                Producto desactivado: actívalo para cambiar sus precios.
              </p>
            }
            <div class="pd-prices-head">
              <div>
                <h2 class="pd-section-title">Escala de precios</h2>
                <p class="pd-section-sub">Precios definidos para este producto</p>
              </div>
              @if (canEditPrices() && p.active) {
                <button uiButton variant="secondary" size="sm" (click)="addPrice(p)">
                  + Agregar precio
                </button>
              }
            </div>

            @if (pricesLoading()) {
              <div class="pd-prices-skeleton" role="status" aria-label="Cargando">
                @for (_ of skeletonRows; track $index) {
                  <div class="pd-prices-skeleton-row"></div>
                }
              </div>
            } @else if (pricesError()) {
              <ui-empty
                variant="error"
                title="No pudimos cargar la escala de precios"
                actionLabel="Reintentar"
                (action)="loadPrices()"
              />
            } @else if (sortedPrices().length === 0) {
              <ui-empty
                title="Este producto aún no tiene escala de precios"
                body="Agrega el primer precio para empezar."
                [actionLabel]="canEditPrices() && p.active ? 'Agregar precio' : ''"
                (action)="addPrice(p)"
              />
            } @else {
              <table class="ui-table-grid pd-prices-table">
                <thead>
                  <tr>
                    <th>Condición de pago</th>
                    <th>Tipo de cliente</th>
                    <th class="pd-col-right">Desde</th>
                    <th class="pd-col-right">Precio unitario</th>
                    <th>Actualizado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (price of sortedPrices(); track price.priceId) {
                    <tr>
                      <td>{{ price.paymentConditionName }}</td>
                      <td class="pd-muted">{{ price.customerTypeName }}</td>
                      <td class="pd-col-right pd-tnum">Desde {{ price.minQuantity }}</td>
                      <td class="pd-col-right pd-tnum pd-cell-strong">
                        {{ formatSoles(price.unitPrice) }}
                      </td>
                      <td class="pd-muted">{{ dateTimeText(price.updatedAt) }}</td>
                      <td class="pd-row-actions">
                        @if (canEditPrices() && p.active) {
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
          </ui-card>

          <div class="pd-side">
            <ui-card title="Detalles del producto" class="pd-detail-card">
              <div class="pd-kv-grid">
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
                  <span class="pd-value">{{ p.weightKg != null ? p.weightKg + ' kg' : '—' }}</span>
                </div>
                <div class="pd-field">
                  <span class="pd-label">Elegible para bonificación</span>
                  <ui-badge [tone]="p.isBonusEligible ? 'success' : 'neutral'">
                    {{ p.isBonusEligible ? 'Sí' : 'No' }}
                  </ui-badge>
                </div>
              </div>
            </ui-card>

            <ui-card class="pd-stock-card">
              <span class="pd-stock-label">Stock</span>
              <div class="pd-stock-row">
                <span class="pd-stock-value">{{ p.stock }}</span>
                <span class="pd-stock-unit">{{ p.unitOfMeasure }}</span>
                <span class="pd-stock-chip">{{ warehouseName() }}</span>
              </div>
            </ui-card>
          </div>
        </div>
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
      .pd-breadcrumb {
        margin: 0 0 var(--sp-4);
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .pd-breadcrumb a {
        color: var(--accent-ink);
        text-decoration: none;
      }
      .pd-breadcrumb a:hover {
        text-decoration: underline;
      }
      .pd-skeleton {
        height: 400px;
        background: var(--faint);
      }
      .pd-head-card {
        margin-bottom: var(--sp-5);
      }
      .pd-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-5);
        flex-wrap: wrap;
      }
      .pd-head-identity {
        display: flex;
        align-items: flex-start;
        gap: var(--sp-4);
        min-width: 0;
      }
      .pd-icon-badge {
        flex: none;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--accent-wash);
        border-radius: var(--radius-control);
      }
      .pd-icon-badge .material-icons {
        color: var(--accent-ink);
        font-size: 24px;
      }
      .pd-head-chips {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        margin-bottom: var(--sp-1);
      }
      .pd-code-chip {
        font-size: var(--fs-meta);
        font-variant-numeric: var(--tnum);
        color: var(--ink-muted);
        background: var(--faint);
        padding: 2px var(--sp-2);
        border-radius: var(--radius-control);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 2px 0 2px;
        color: var(--ink);
      }
      .pd-meta {
        margin: 0;
        color: var(--ink-muted);
        font-size: var(--fs-dense);
      }
      .pd-actions {
        display: flex;
        gap: var(--sp-3);
        flex-wrap: wrap;
        align-items: center;
      }
      .pd-actions .material-icons {
        font-size: 18px;
      }

      .pd-grid {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: var(--sp-6);
        align-items: start;
      }
      .pd-inactive-notice {
        margin: 0 0 var(--sp-4);
        font-size: var(--fs-dense);
        color: var(--status-warn);
        background: color-mix(in srgb, var(--status-warn) 10%, transparent);
        border-radius: var(--radius-control);
        padding: var(--sp-3) var(--sp-4);
      }
      .pd-prices-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--sp-4);
      }
      .pd-section-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .pd-section-sub {
        margin: 2px 0 0;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
      }
      .pd-prices-table {
        margin-top: var(--sp-4);
      }
      .pd-prices-skeleton {
        margin-top: var(--sp-4);
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
      }
      .pd-prices-skeleton-row {
        height: 36px;
        background: var(--faint);
      }
      .pd-muted {
        color: var(--ink-muted);
        font-size: var(--fs-meta);
      }
      .pd-col-right {
        text-align: right;
      }
      .pd-tnum {
        font-variant-numeric: var(--tnum);
      }
      .pd-cell-strong {
        font-weight: 800;
      }
      .pd-row-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--sp-2);
      }

      .pd-side {
        display: flex;
        flex-direction: column;
        gap: var(--sp-5);
      }
      .pd-kv-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: var(--sp-4) var(--sp-5);
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
        font-size: var(--fs-body);
        color: var(--ink);
      }
      .pd-stock-label {
        font-size: var(--fs-label);
        letter-spacing: var(--ls-label);
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .pd-stock-row {
        display: flex;
        align-items: baseline;
        gap: var(--sp-2);
        margin-top: var(--sp-2);
        flex-wrap: wrap;
      }
      .pd-stock-value {
        font-size: 34px;
        font-weight: 800;
        color: var(--ink);
        font-variant-numeric: var(--tnum);
      }
      .pd-stock-unit {
        font-size: var(--fs-dense);
        color: var(--ink-muted);
      }
      .pd-stock-chip {
        margin-left: auto;
        font-size: var(--fs-meta);
        color: var(--ink-muted);
        background: var(--faint);
        padding: 2px var(--sp-2);
        border-radius: var(--radius-control);
      }

      @media (max-width: 900px) {
        .pd-grid {
          grid-template-columns: 1fr;
        }
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
  protected dateTimeText = dateTimeText;
  protected skeletonRows = Array.from({ length: 5 });

  protected canEdit = computed(() => this.auth.hasAny('product.edit'));
  protected showPrices = computed(() => this.auth.hasAny('price.view', 'price.edit'));
  protected canEditPrices = computed(() => this.auth.hasAny('price.edit'));
  protected canViewKardex = computed(() => this.auth.hasAny('report.view'));

  protected product = signal<ProductView | null>(null);
  protected loading = signal(true);
  protected error = signal(false);

  protected prices = signal<PriceView[]>([]);
  protected pricesLoading = signal(true);
  protected pricesError = signal(false);

  protected sortedPrices = computed(() =>
    [...this.prices()].sort(
      (a, b) =>
        a.paymentConditionName.localeCompare(b.paymentConditionName) ||
        a.customerTypeName.localeCompare(b.customerTypeName) ||
        a.minQuantity - b.minQuantity,
    ),
  );

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

  /** Pedida con el mismo patrón reactivo que el detalle — antes se pedía en el constructor y `productId()` todavía estaba vacío (doc 38, sección 7.1). */
  private loadPricesEffect = effect(() => {
    const id = this.productId();
    if (!id || !this.showPrices()) return;
    this.loadPrices();
  });

  constructor() {
    this.lookupSvc.warehouses().subscribe({ next: (list) => this.warehouses.set(list) });
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

  protected loadPrices() {
    const id = Number(this.productId());
    if (!id) return;
    this.pricesLoading.set(true);
    this.pricesError.set(false);
    this.priceSvc.byProduct(id).subscribe({
      next: (list) => {
        this.prices.set(list);
        this.pricesLoading.set(false);
      },
      error: () => {
        this.pricesLoading.set(false);
        this.pricesError.set(true);
      },
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
        message: `Se eliminará el precio de ${price.paymentConditionName} · ${price.customerTypeName} desde ${price.minQuantity}. ¿Eliminar?`,
        confirmLabel: 'Eliminar',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (confirmed) this.priceSvc.remove(price.priceId).subscribe(() => this.loadPrices());
      });
  }
}
