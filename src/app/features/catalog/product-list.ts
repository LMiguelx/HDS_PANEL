import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTable } from '../../shared/ui/table/table';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { UiDialogService } from '../../shared/ui/dialog/dialog';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { CatalogModuleTabs } from './ui/module-tabs';
import { ProductFormDialog } from './ui/product-form-dialog';
import { ProductAdminService } from './product-admin';
import { CatalogLookupService } from './catalog-lookup';
import { BrandView, FamilyView, ProductView } from '../../shared/models/catalog.models';
import { WarehouseView } from '../../shared/models/inventory.models';

/**
 * Búsqueda de productos (GET /catalog/products) — sin permiso especial para
 * leer, pero `warehouseId` es obligatorio (trae el stock real de ese
 * almacén). El selector de almacén se pide una sola vez y se reusa.
 */
@Component({
  selector: 'app-product-list',
  imports: [
    RouterLink,
    UiButton,
    UiField,
    UiTable,
    UiEmpty,
    HasPermissionDirective,
    CatalogModuleTabs,
  ],
  template: `
    <app-catalog-module-tabs />
    <section class="pl-page">
      <div class="pl-head">
        <div>
          <h1>Catálogo de productos</h1>
          <p class="pl-sub">{{ countText() }}</p>
        </div>
        <button uiButton variant="primary" *hasPermission="'product.edit'" (click)="openCreate()">
          Nuevo producto
        </button>
      </div>

      <div class="pl-filters">
        <ui-field
          label="Almacén"
          type="select"
          [(value)]="warehouseId"
          [options]="warehouseOptions()"
          [disabled]="loadingWarehouses()"
        />
        <ui-field label="Buscar" [(value)]="q" placeholder="Código o nombre" />
        <ui-field
          label="Marca"
          type="select"
          [(value)]="brandId"
          [options]="brandOptions()"
          [disabled]="loadingBrands()"
        />
        <ui-field
          label="Familia"
          type="select"
          [(value)]="familyId"
          [options]="familyOptions()"
          [disabled]="loadingFamilies()"
        />
      </div>

      @if (!warehouseId()) {
        <ui-empty
          title="Elige un almacén"
          body="El catálogo muestra el stock real de un almacén — selecciona uno para empezar."
        />
      } @else {
        <ui-table
          [loading]="loading()"
          [error]="error()"
          errorMessage="No pudimos cargar los productos."
          [empty]="!loading() && !error() && rows().length === 0"
          (retry)="load()"
        >
          <div empty>
            <ui-empty title="Sin productos" body="No encontramos productos con esos criterios." />
          </div>

          <table class="ui-table-grid pl-table-desktop">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Familia</th>
                <th>Marca</th>
                <th>Stock</th>
                <th>Bonificable</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of rows(); track p.productId) {
                <tr>
                  <td class="pl-muted">{{ p.code }}</td>
                  <td class="pl-cell-strong">{{ p.name }}</td>
                  <td class="pl-muted">{{ p.familyName }}</td>
                  <td class="pl-muted">{{ p.brandName }}</td>
                  <td class="pl-muted">{{ p.stock }}</td>
                  <td class="pl-muted">{{ p.isBonusEligible ? 'Sí' : 'No' }}</td>
                  <td class="pl-row-action">
                    <button
                      uiButton
                      variant="ghost"
                      size="sm"
                      [routerLink]="['/precios', p.productId]"
                      [queryParams]="{ warehouseId: warehouseId() }"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="pl-cards-mobile">
            @for (p of rows(); track p.productId) {
              <a
                [routerLink]="['/precios', p.productId]"
                [queryParams]="{ warehouseId: warehouseId() }"
                class="pl-card-mobile"
              >
                <div class="pl-card-mobile-head">
                  <span class="pl-card-mobile-name">{{ p.name }}</span>
                  <span class="pl-muted">{{ p.code }}</span>
                </div>
                <div class="pl-muted">
                  {{ p.familyName }} · {{ p.brandName }} · Stock {{ p.stock }}
                  @if (p.isBonusEligible) {
                    · Bonificable
                  }
                </div>
              </a>
            }
          </div>
        </ui-table>

        @if (!loading() && !error() && rows().length > 0) {
          <div class="pl-pager">
            <button
              uiButton
              variant="secondary"
              size="sm"
              [disabled]="page() === 0"
              (click)="prevPage()"
            >
              Anterior
            </button>
            <span class="pl-pager-label">Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span>
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
      .pl-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .pl-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 0 0 4px;
        color: var(--ink);
      }
      .pl-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .pl-filters {
        display: grid;
        grid-template-columns: 180px minmax(200px, 1fr) 200px 200px;
        gap: 12px;
        margin: 24px 0 20px;
        padding-bottom: 20px;
        border-bottom: var(--border-hair);
      }
      .pl-cell-strong {
        font-weight: 800;
      }
      .pl-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .pl-row-action {
        text-align: right;
      }
      .pl-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 24px;
      }
      .pl-pager-label {
        font-size: 13px;
        color: var(--ink-muted);
        font-variant-numeric: var(--tnum);
      }
      .pl-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .pl-page {
          padding: var(--sp-4);
        }
        .pl-filters {
          grid-template-columns: 1fr;
        }
        .pl-table-desktop {
          display: none;
        }
        .pl-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .pl-card-mobile {
          display: block;
          border: 1px solid var(--hairline);
          padding: 12px 14px;
          text-decoration: none;
          color: var(--ink);
        }
        .pl-card-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .pl-card-mobile-name {
          font-weight: 800;
          font-size: 15px;
        }
      }
    `,
  ],
})
export class ProductListPage implements OnInit, OnDestroy {
  private productSvc = inject(ProductAdminService);
  private lookupSvc = inject(CatalogLookupService);
  private dialog = inject(UiDialogService);
  private router = inject(Router);

  protected warehouseId = signal('');
  protected q = signal('');
  protected brandId = signal('');
  protected familyId = signal('');

  protected warehouses = signal<WarehouseView[]>([]);
  protected loadingWarehouses = signal(true);
  protected brands = signal<BrandView[]>([]);
  protected loadingBrands = signal(true);
  protected families = signal<FamilyView[]>([]);
  protected loadingFamilies = signal(true);

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

  protected brandOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todas las marcas' },
    ...this.brands().map((b) => ({ value: String(b.brandId), label: b.name })),
  ]);

  protected familyOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Todas las familias' },
    ...this.families()
      .filter((f) => !this.brandId() || f.brandId === Number(this.brandId()))
      .map((f) => ({ value: String(f.familyId), label: f.name })),
  ]);

  private reload$ = new Subject<void>();
  private filtersEffect = effect(() => {
    this.warehouseId();
    this.q();
    this.brandId();
    this.familyId();
    untracked(() => this.reload$.next());
  });

  ngOnInit() {
    this.reload$.pipe(debounceTime(250)).subscribe(() => {
      if (!this.warehouseId()) return;
      this.page.set(0);
      this.load();
    });
  }

  ngOnDestroy() {
    this.reload$.complete();
  }

  constructor() {
    this.lookupSvc.warehouses().subscribe({
      next: (list) => {
        this.warehouses.set(list);
        this.loadingWarehouses.set(false);
        if (list.length > 0) this.warehouseId.set(String(list[0].warehouseId));
      },
      error: () => this.loadingWarehouses.set(false),
    });
    this.lookupSvc.brands().subscribe({
      next: (list) => {
        this.brands.set(list);
        this.loadingBrands.set(false);
      },
      error: () => this.loadingBrands.set(false),
    });
    this.lookupSvc.families().subscribe({
      next: (list) => {
        this.families.set(list);
        this.loadingFamilies.set(false);
      },
      error: () => this.loadingFamilies.set(false),
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
    this.productSvc
      .list({
        warehouseId,
        q: this.q() || undefined,
        brandId: this.brandId() ? Number(this.brandId()) : undefined,
        familyId: this.familyId() ? Number(this.familyId()) : undefined,
        page: this.page(),
        size: this.size(),
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

  protected openCreate() {
    this.dialog
      .open<ProductFormDialog, { product?: ProductView }, { productId: number } | false>(
        ProductFormDialog,
        { data: {}, width: '640px' },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.router.navigate(['/precios', result.productId], {
            queryParams: { warehouseId: this.warehouseId() },
          });
        }
      });
  }
}
