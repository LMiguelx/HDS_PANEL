import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { PromoModuleTabs } from './ui/module-tabs';
import { PromoService } from './promo';
import { LookupService, toUiLookup } from './lookup';
import { dateText } from './promo-format';

interface AllocationView {
  allocationId?: number;
  promoId?: number;
  userId?: number;
  productId?: number;
  productName?: string;
  allocatedQuantity?: number;
  usedQuantity?: number;
  availableQuantity?: number;
  periodStart?: string;
  periodEnd?: string;
}

@Component({
  selector: 'app-allocations-admin',
  imports: [UiButton, UiField, UiTypeahead, UiEmpty, PromoModuleTabs],
  template: `
    <app-promo-module-tabs />
    <section class="alloc-page">
      <div class="alloc-head">
        <div>
          <h1>Dotaciones a vendedores</h1>
          <p class="alloc-sub">Material promocional asignado para repartir. El saldo disponible es el número grande.</p>
        </div>
        <button uiButton variant="primary" (click)="showCreate.set(!showCreate())">Nueva dotación</button>
      </div>
      <hr class="alloc-rule" />

      @if (showCreate()) {
        <div class="alloc-create">
          <h3>Nueva dotación</h3>
          <div class="alloc-create-grid">
            <ui-typeahead
              label="Vendedor — busca por nombre"
              [clearOnPick]="false"
              [search]="userSearch"
              [selected]="createVendor()"
              (picked)="createVendor.set($event)"
            />
            <ui-field label="Promoción" type="select" [(value)]="createPromoId" [options]="promoOptions()" />
            <ui-typeahead
              label="Producto — busca por nombre"
              [clearOnPick]="false"
              [search]="productSearch"
              [selected]="createProduct()"
              (picked)="createProduct.set($event)"
            />
            <ui-field label="Cantidad" type="number" [(value)]="createQuantity" />
            <ui-field label="Desde" type="date" [(value)]="createFrom" />
            <ui-field label="Hasta (opcional)" type="date" [(value)]="createTo" />
          </div>
          @if (createError()) {
            <div class="alloc-error">{{ createError() }}</div>
          }
          <div class="alloc-create-actions">
            <button uiButton variant="secondary" (click)="showCreate.set(false)">Cancelar</button>
            <button uiButton variant="primary" [loading]="creating()" (click)="submitCreate()">Guardar dotación</button>
          </div>
        </div>
      }

      <div class="alloc-lookup">
        <ui-typeahead
          label="Ver dotaciones de un vendedor — busca por nombre"
          [clearOnPick]="false"
          [search]="userSearch"
          [selected]="selectedVendor()"
          (picked)="selectVendor($event)"
        />
      </div>

      @if (!selectedVendor()) {
        <ui-empty
          title="Elige un vendedor para ver sus dotaciones"
          body="Busca por nombre arriba para ver el saldo disponible de cada producto asignado."
        />
      } @else if (loading()) {
        <div class="alloc-skeleton" role="status" aria-label="Cargando"></div>
      } @else if (allocations().length === 0) {
        <ui-empty title="Sin dotaciones" body="Este vendedor todavía no tiene material promocional asignado." />
      } @else {
        <table class="ui-table-grid alloc-table-desktop">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Disponible</th>
              <th>Asignado</th>
              <th>Usado</th>
              <th>Vigencia</th>
            </tr>
          </thead>
          <tbody>
            @for (a of allocations(); track a.allocationId) {
              <tr>
                <td class="alloc-product">{{ a.productName }}</td>
                <td>
                  <span class="alloc-balance" [style.color]="balanceColor(a)">{{ a.availableQuantity ?? 0 }}</span>
                </td>
                <td class="alloc-muted">{{ a.allocatedQuantity ?? 0 }}</td>
                <td class="alloc-muted">{{ a.usedQuantity ?? 0 }}</td>
                <td class="alloc-muted">{{ dateText(a.periodStart) }} – {{ a.periodEnd ? dateText(a.periodEnd) : 'sin fin' }}</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="alloc-cards-mobile">
          @for (a of allocations(); track a.allocationId) {
            <div class="alloc-card-mobile">
              <div class="alloc-product">{{ a.productName }}</div>
              <div class="alloc-card-mobile-cols">
                <div>
                  <div class="alloc-balance" [style.color]="balanceColor(a)">{{ a.availableQuantity ?? 0 }}</div>
                  <div class="alloc-muted-sm">Disponible</div>
                </div>
                <div>
                  <div class="alloc-balance-sm">{{ a.allocatedQuantity ?? 0 }}</div>
                  <div class="alloc-muted-sm">Asignado</div>
                </div>
                <div>
                  <div class="alloc-balance-sm">{{ a.usedQuantity ?? 0 }}</div>
                  <div class="alloc-muted-sm">Usado</div>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .alloc-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .alloc-head {
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
      .alloc-sub {
        margin: 0;
        color: var(--ink-muted);
        font-size: 14px;
      }
      .alloc-rule {
        border: 0;
        border-top: var(--border-hair);
        margin: 16px 0 20px;
      }
      .alloc-create {
        border: 2px solid var(--divider);
        padding: 18px;
        margin-bottom: 24px;
      }
      .alloc-create h3 {
        margin: 0 0 14px;
      }
      .alloc-create-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }
      .alloc-create-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 16px;
      }
      .alloc-error {
        margin-top: 12px;
        color: var(--accent-ink);
        font-size: 13px;
      }
      .alloc-lookup {
        max-width: 460px;
        margin-bottom: 24px;
      }
      .alloc-skeleton {
        height: 160px;
        background: var(--faint);
      }
      .alloc-product {
        font-weight: 800;
      }
      .alloc-balance {
        font-size: 22px;
        font-weight: 800;
        line-height: 1.1;
        font-variant-numeric: var(--tnum);
      }
      .alloc-muted {
        color: var(--ink-muted);
      }
      .alloc-cards-mobile {
        display: none;
      }

      @media (max-width: 767px) {
        .alloc-create-grid {
          grid-template-columns: 1fr;
        }
        .alloc-table-desktop {
          display: none;
        }
        .alloc-cards-mobile {
          display: grid;
          gap: 10px;
        }
        .alloc-card-mobile {
          border: 1px solid var(--hairline);
          padding: 12px 14px;
        }
        .alloc-card-mobile-cols {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        .alloc-balance-sm {
          font-size: 20px;
          font-weight: 800;
        }
        .alloc-muted-sm {
          font-size: 11px;
          color: var(--ink-muted);
        }
      }
    `,
  ],
})
export class AllocationsAdminPage {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/promo-allocations`;
  private lookupSvc = inject(LookupService);
  private promoSvc = inject(PromoService);

  protected dateText = dateText;

  protected selectedVendor = signal<UiLookupItem | null>(null);
  protected allocations = signal<AllocationView[]>([]);
  protected loading = signal(false);

  protected showCreate = signal(false);
  protected createVendor = signal<UiLookupItem | null>(null);
  protected createProduct = signal<UiLookupItem | null>(null);
  protected createPromoId = signal('');
  protected createQuantity = signal('');
  protected createFrom = signal('');
  protected createTo = signal('');
  protected creating = signal(false);
  protected createError = signal('');

  protected promoOptions = signal<UiFieldOption[]>([]);

  protected userSearch = (q: string) => this.lookupSvc.users(q).pipe(map((items) => toUiLookup(items)));
  protected productSearch = (q: string) => this.lookupSvc.products(q).pipe(map((items) => toUiLookup(items)));

  constructor() {
    this.promoSvc.list({ size: 100 }).subscribe((page) => {
      this.promoOptions.set(
        (page.content ?? []).map((p) => ({ value: String(p.promoId), label: p.name ?? '' })),
      );
    });
  }

  protected selectVendor(item: UiLookupItem) {
    this.selectedVendor.set(item);
    this.loading.set(true);
    this.http.get<AllocationView[]>(`${this.base}/by-user/${item.id}`).subscribe({
      next: (list) => {
        this.allocations.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected balanceColor(a: AllocationView): string {
    const avail = a.availableQuantity ?? 0;
    if (avail <= 0) return 'var(--st-sin-stock)';
    if (avail <= 8) return 'var(--st-pendiente)';
    return 'var(--ink)';
  }

  protected submitCreate() {
    const vendor = this.createVendor();
    const product = this.createProduct();
    const promoId = Number(this.createPromoId());
    const qty = Number(this.createQuantity());
    if (!vendor || !product || !promoId || !qty || !this.createFrom()) {
      this.createError.set('Completa vendedor, promoción, producto, cantidad y fecha de inicio.');
      return;
    }
    this.creating.set(true);
    this.createError.set('');
    this.http
      .post(this.base, {
        promoId,
        userId: vendor.id,
        productId: product.id,
        allocatedQuantity: qty,
        periodStart: this.createFrom(),
        periodEnd: this.createTo() || undefined,
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.showCreate.set(false);
          this.createVendor.set(null);
          this.createProduct.set(null);
          this.createQuantity.set('');
          if (this.selectedVendor()?.id === vendor.id) this.selectVendor(vendor);
        },
        error: () => {
          this.creating.set(false);
          this.createError.set('No pudimos guardar la dotación.');
        },
      });
  }
}
