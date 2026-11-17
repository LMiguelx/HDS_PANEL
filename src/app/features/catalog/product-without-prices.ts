import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { CatalogModuleTabs } from './ui/module-tabs';
import { ProductAdminService } from './product-admin';
import { CatalogLookupService } from './catalog-lookup';
import { ProductView } from '../../shared/models/catalog.models';
import { WarehouseView } from '../../shared/models/inventory.models';

/** Productos activos sin ninguna fila de precio — GET /catalog/products/without-prices. */
@Component({
  selector: 'app-product-without-prices',
  imports: [RouterLink, UiButton, UiField, UiTable, UiEmpty, CatalogModuleTabs],
  template: `
    <app-catalog-module-tabs />
    <section class="pwp-page">
      <div class="pwp-head">
        <h1>Productos sin precio</h1>
        <p class="pwp-sub">{{ countText() }}</p>
      </div>

      <div class="pwp-filters">
        <ui-field
          label="Almacén"
          type="select"
          [(value)]="warehouseId"
          [options]="warehouseOptions()"
          [disabled]="loadingWarehouses()"
        />
      </div>

      @if (!warehouseId()) {
        <ui-empty title="Elige un almacén" body="Selecciona un almacén para ver sus productos." />
      } @else {
        <ui-table
          [loading]="loading()"
          [error]="error()"
          errorMessage="No pudimos cargar los productos."
          [empty]="!loading() && !error() && rows().length === 0"
          (retry)="load()"
        >
          <div empty>
            <ui-empty
              variant="al-dia"
              eyebrow="Al día"
              title="Todos los productos tienen precio"
              body="No encontramos productos activos sin ninguna fila de precio configurada."
            />
          </div>

          <table class="ui-table-grid pwp-table-desktop">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Familia</th>
                <th>Marca</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of rows(); track p.productId) {
                <tr>
                  <td class="pwp-muted">{{ p.code }}</td>
                  <td class="pwp-cell-strong">{{ p.name }}</td>
                  <td class="pwp-muted">{{ p.familyName }}</td>
                  <td class="pwp-muted">{{ p.brandName }}</td>
                  <td class="pwp-row-action">
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      [routerLink]="['/precios', p.productId]"
                      [queryParams]="{ warehouseId: warehouseId() }"
                    >
                      Agregar precio
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="pwp-cards-mobile">
            @for (p of rows(); track p.productId) {
              <a
                [routerLink]="['/precios', p.productId]"
                [queryParams]="{ warehouseId: warehouseId() }"
                class="pwp-card-mobile"
              >
                <div class="pwp-card-mobile-head">
                  <span class="pwp-card-mobile-name">{{ p.name }}</span>
                  <span class="pwp-muted">{{ p.code }}</span>
                </div>
                <div class="pwp-muted">{{ p.familyName }} · {{ p.brandName }}</div>
              </a>
            }
          </div>
        </ui-table>

        @if (!loading() && !error() && rows().length > 0) {
          <div class="pwp-pager">
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() === 0"
              (click)="prevPage()"
            >
              Anterior
            </button>
            <span class="pwp-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .pwp-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .pwp-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .pwp-filters {
        display: grid;
        grid-template-columns: 220px;
        gap: 12px;
        margin: 24px 0 20px;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .pwp-cell-strong {
        font-weight: 800;
      }
      .pwp-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .pwp-row-action {
        text-align: right;
      }
      .pwp-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .pwp-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .pwp-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .pwp-page {
          padding: var(--sp-4);
        }
        .pwp-table-desktop {
          display: none;
        }
        .pwp-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .pwp-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .pwp-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .pwp-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class ProductWithoutPricesPage {
  private productSvc = inject(ProductAdminService);
  private lookupSvc = inject(CatalogLookupService);

  protected warehouseId = signal('');
  protected warehouses = signal<WarehouseView[]>([]);
  protected loadingWarehouses = signal(true);

  protected rows = signal<ProductView[]>([]);
  protected totalElements = signal(0);
  protected totalPages = signal(0);
  protected page = signal(0);
  protected size = signal(20);
  protected loading = signal(false);
  protected error = signal(false);

  protected warehouseOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: this.loadingWarehouses() ? 'Cargando…' : 'Selecciona un almacén' },
    ...this.warehouses().map((w) => ({ value: String(w.warehouseId), label: w.name })),
  ]);

  private warehouseEffect = effect(() => {
    this.warehouseId();
    untracked(() => {
      if (!this.warehouseId()) return;
      this.page.set(0);
      this.load();
    });
  });

  constructor() {
    this.lookupSvc.warehouses().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.loadingWarehouses.set(false);
        if (list.length > 0) this.warehouseId.set(String(list[0].warehouseId));
      },
      error: () => this.loadingWarehouses.set(false),
    });
  }

  protected countText(): string {
    const n = this.totalElements();
    return n === 1 ? '1 producto' : `${n} productos`;
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

  load() {
    const warehouseId = Number(this.warehouseId());
    if (!warehouseId) return;
    this.loading.set(true);
    this.error.set(false);
    this.productSvc.withoutPrices(warehouseId, this.page(), this.size()).subscribe({
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
}
