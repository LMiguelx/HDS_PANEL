import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../shared/components/page-header';
import { MoneyPipe } from '../../shared/pipes/money';
import { HasPermissionDirective } from '../../shared/directives/has-permission';
import { statusLabel } from '../../shared/ui/status';
import { ToastService } from '../../core/ui/toast';
import { OrderService } from './order';
import { CatalogService } from './catalog';
import { PriceService } from './price';
import { AllocationService } from './allocation';
import { CustomerService } from '../customers/customer';
import { CustomerSummary } from '../../shared/models/customer.models';
import { Product, PaymentCondition } from '../../shared/models/catalog.models';
import { AllocationView } from '../../shared/models/allocation.models';
import {
  CreateOrderCommand,
  OrderCreatedResult,
  SuggestedItem,
} from '../../shared/models/order.models';

interface ItemDraft {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
}
interface GiftDraft {
  allocationId: number;
  productName: string;
  quantity: number;
  available: number;
}

@Component({
  selector: 'app-order-create',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    PageHeaderComponent,
    MoneyPipe,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <app-page-header title="Nuevo pedido" subtitle="Creación como administrador"></app-page-header>

      <!-- 1. Cliente -->
      <mat-card class="card">
        <h3>Cliente</h3>
        @if (customer(); as c) {
          <div class="picked">
            <strong>{{ c.businessName }}</strong>
            <span class="muted">· {{ c.documentNumber }}</span>
            <button mat-button (click)="changeCustomer()">Cambiar</button>
          </div>
        } @else {
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
              <mat-icon matPrefix>search</mat-icon>
              <mat-label>Buscar cliente</mat-label>
              <input
                matInput
                [value]="custQuery()"
                (input)="custQuery.set($any($event.target).value)"
                (keyup.enter)="searchCustomers()"
              />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="searchCustomers()">Buscar</button>
          </div>
          @if (custResults().length) {
            <div class="results">
              @for (c of custResults(); track c.customerId) {
                <button class="row-item" (click)="selectCustomer(c)">
                  <span>{{ c.businessName }}</span
                  ><span class="muted">{{ c.documentNumber }}</span>
                </button>
              }
            </div>
          }
        }
      </mat-card>

      @if (customer()) {
        <!-- 2. Sugerido -->
        @if (suggested().length) {
          <mat-card class="card">
            <h3>Suele comprar</h3>
            <div class="chips">
              @for (s of suggested(); track s.productId) {
                <button class="sug" (click)="addSuggested(s)">
                  <mat-icon>add</mat-icon>
                  {{ s.productName }}
                  <span class="muted">(~{{ s.avgQuantity }})</span>
                </button>
              }
            </div>
          </mat-card>
        }

        <!-- 3. Productos -->
        <mat-card class="card">
          <h3>Productos</h3>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
              <mat-icon matPrefix>search</mat-icon>
              <mat-label>Buscar producto</mat-label>
              <input
                matInput
                [value]="prodQuery()"
                (input)="prodQuery.set($any($event.target).value)"
                (keyup.enter)="searchProducts()"
              />
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="searchProducts()">Buscar</button>
          </div>
          @if (prodResults().length) {
            <div class="results">
              @for (p of prodResults(); track p.productId) {
                <button class="row-item" (click)="addProduct(p)">
                  <span>{{ p.name }}</span
                  >
                  <mat-icon>add</mat-icon>
                </button>
              }
            </div>
          }

          @if (items().length) {
            <div class="items">
              <div class="item head">
                <span>Producto</span><span>Cant.</span><span>P. Unit</span><span>Total</span
              ><span></span>
              </div>
              @for (it of items(); track it.productId) {
                <div class="item">
                  <span class="pname">{{ it.productName }}</span>
                  <input
                    type="number"
                    min="1"
                    [value]="it.quantity"
                    (input)="setQty(it, +$any($event.target).value)"
                  />
                  <span class="num">{{ it.unitPrice != null ? (it.unitPrice | money) : '—' }}</span>
                  <span class="num">{{ it.lineTotal != null ? (it.lineTotal | money) : '—' }}</span>
                  <button mat-icon-button (click)="removeItem(it)" aria-label="Quitar">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              }
            </div>
            <button mat-stroked-button (click)="previewPrices()">
              <mat-icon>calculate</mat-icon>
              Previsualizar precios
            </button>
          } @else {
            <p class="muted">Agrega productos del sugerido o del buscador.</p>
          }
        </mat-card>

        <!-- 4. Dotaciones -->
        @if (myAllocations().length) {
          <mat-card class="card">
            <h3>Dotaciones para regalar</h3>
            <div class="chips">
              @for (a of myAllocations(); track a.allocationId) {
                <button class="sug" [disabled]="a.availableQuantity <= 0" (click)="addGift(a)">
                  <mat-icon>redeem</mat-icon>
                  {{ a.productName }}
                  <span class="muted">(saldo {{ a.availableQuantity }})</span>
                </button>
              }
            </div>
            @if (gifts().length) {
              <div class="items">
                @for (g of gifts(); track g.allocationId) {
                  <div class="item gift">
                    <span class="pname"
                    >{{ g.productName }} <span class="muted">(regalo)</span></span
                    >
                    <input
                      type="number"
                      min="1"
                      [max]="g.available"
                      [value]="g.quantity"
                      (input)="setGiftQty(g, +$any($event.target).value)"
                    />
                    <span class="muted num">máx {{ g.available }}</span
                    ><span></span>
                    <button mat-icon-button (click)="removeGift(g)" aria-label="Quitar">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                }
              </div>
            }
          </mat-card>
        }

        <!-- 5. Condición + nota -->
        <mat-card class="card">
          <div class="row wrap">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Condición de pago</mat-label>
              <mat-select
                [value]="paymentConditionId()"
                (valueChange)="paymentConditionId.set($event)"
              >
                @for (pc of paymentConditions(); track pc.paymentConditionId) {
                  <mat-option [value]="pc.paymentConditionId">{{ pc.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="grow">
              <mat-label>Nota (opcional)</mat-label>
              <input
                matInput
                [value]="note()"
                (input)="note.set($any($event.target).value)"
                maxlength="255"
              />
            </mat-form-field>
          </div>
        </mat-card>

        <!-- 6. Crear -->
        <mat-card class="card summary">
          <div>
            <span class="muted">Total estimado</span><br />
            <strong class="money big">{{ estimatedTotal() | money }}</strong>
            <span class="muted small"> · el total real y las promos los calcula el backend</span>
          </div>
          <button mat-flat-button color="tertiary" [disabled]="!canSubmit()" (click)="submit()">
            <mat-icon>check</mat-icon>
            Crear pedido
          </button>
        </mat-card>
      }

      <!-- 7. Resultado -->
      @if (result(); as r) {
        <mat-card class="card result">
          <h3>Pedido #{{ r.orderId }} creado</h3>
          <div class="head">
            <div>
              <span class="muted">Estado</span><br /><span
              class="status-chip"
              [attr.data-status]="r.statusCode"
            >{{ label(r.statusCode) }}</span
            >
            </div>
            <div>
              <span class="muted">Total</span><br /><strong class="money">{{
                r.totalAmount | money
              }}</strong>
            </div>
            <div><span class="muted">Bonos</span><br />{{ r.bonusLines }} líneas</div>
            <div>
              <span class="muted">Descuento promos</span><br />{{ r.promoDiscountTotal | money }}
            </div>
          </div>
          @if (r.duplicate) {
            <p class="muted">Ya existía (idempotencia): no se duplicó.</p>
          }
          <div class="actions">
            <button mat-stroked-button (click)="goToDetail()">Ver detalle</button>
            <button
              *hasPermission="'order.send_to_billing'"
              mat-flat-button
              color="tertiary"
              (click)="sendToBilling()"
            >
              Enviar a facturación
            </button>
          </div>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `
      .card {
        padding: var(--sp-5);
        margin-bottom: var(--sp-4);
        max-width: var(--card-w-md);
      }
      h3 {
        margin: 0 0 12px;
        font-size: 1rem;
      }
      .row {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .row.wrap {
        flex-wrap: wrap;
      }
      .grow {
        flex: 1 1 auto;
      }
      .picked {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .results {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
      }
      .row-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        cursor: pointer;
        padding: 8px 12px;
        font: inherit;
      }
      .row-item:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .sug {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1px solid var(--mat-sys-outline);
        background: transparent;
        border-radius: 999px;
        padding: 6px 12px;
        cursor: pointer;
        font: inherit;
      }
      .sug:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
      .sug mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .items {
        margin: 12px 0;
      }
      .item {
        display: grid;
        grid-template-columns: 1fr 90px 110px 110px 48px;
        gap: 8px;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .item.head {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.8rem;
        border-bottom: 2px solid var(--mat-sys-outline-variant);
      }
      .item input {
        width: 100%;
        padding: 6px;
        border: 1px solid var(--mat-sys-outline);
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .item .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .item.gift .pname {
        color: var(--mat-sys-tertiary);
      }
      .summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }
      .big {
        font-size: 1.4rem;
      }
      .small {
        font-size: 0.78rem;
      }
      .result .head {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
        margin: 8px 0;
      }
      .result .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
    `,
  ],
})
export class OrderCreatePage {
  private orders = inject(OrderService);
  private customers = inject(CustomerService);
  private catalog = inject(CatalogService);
  private prices = inject(PriceService);
  private allocations = inject(AllocationService);
  private toast = inject(ToastService);
  private router = inject(Router);

  private readonly idempotencyKey = crypto.randomUUID();
  private readonly captureModeId = 1; // TODO: debería venir del canal/catálogo (ver nota)

  // Cliente
  readonly custQuery = signal('');
  readonly custResults = signal<CustomerSummary[]>([]);
  readonly customer = signal<CustomerSummary | null>(null);
  readonly customerTypeId = signal<number | null>(null);

  // Sugerido / productos
  readonly suggested = signal<SuggestedItem[]>([]);
  readonly prodQuery = signal('');
  readonly prodResults = signal<Product[]>([]);
  readonly items = signal<ItemDraft[]>([]);

  // Pago / nota
  readonly paymentConditions = signal<PaymentCondition[]>([]);
  readonly paymentConditionId = signal<number | null>(null);
  readonly note = signal('');

  // Dotaciones
  readonly myAllocations = signal<AllocationView[]>([]);
  readonly gifts = signal<GiftDraft[]>([]);

  // Resultado
  readonly submitting = signal(false);
  readonly result = signal<OrderCreatedResult | null>(null);

  readonly estimatedTotal = computed(() =>
    this.items().reduce((sum, it) => sum + (it.lineTotal ?? 0), 0),
  );

  constructor() {
    this.catalog.paymentConditions().subscribe({
      next: (pc) => {
        this.paymentConditions.set(pc);
        if (pc.length) this.paymentConditionId.set(pc[0].paymentConditionId);
      },
      error: () => {},
    });
    this.allocations.my().subscribe({ next: (a) => this.myAllocations.set(a), error: () => {} });
  }

  label(code: string) {
    return statusLabel(code);
  }

  // ── Cliente ──
  searchCustomers() {
    const q = this.custQuery().trim();
    if (!q) return;
    this.customers
      .search(q, 0, 10)
      .subscribe({
        next: (r) => this.custResults.set(r.content),
        error: () => this.custResults.set([]),
      });
  }
  selectCustomer(c: CustomerSummary) {
    this.customer.set(c);
    this.custResults.set([]);
    this.custQuery.set(c.businessName);
    this.customers
      .detail(c.customerId)
      .subscribe({
        next: (d) => this.customerTypeId.set(d.customerTypeId ?? null),
        error: () => {},
      });
    this.orders
      .suggested(c.customerId)
      .subscribe({ next: (s) => this.suggested.set(s), error: () => this.suggested.set([]) });
  }
  changeCustomer() {
    this.customer.set(null);
    this.customerTypeId.set(null);
    this.suggested.set([]);
    this.items.set([]);
    this.gifts.set([]);
    this.result.set(null);
  }

  // ── Productos ──
  searchProducts() {
    const q = this.prodQuery().trim();
    this.catalog
      .products(q, 0, 10)
      .subscribe({
        next: (r) => this.prodResults.set(r.content),
        error: () => this.prodResults.set([]),
      });
  }
  addProduct(p: Product, qty = 1) {
    if (this.items().some((i) => i.productId === p.productId)) return;
    this.items.update((list) => [
      ...list,
      {
        productId: p.productId,
        productName: p.name,
        quantity: qty,
        unitPrice: null,
        lineTotal: null,
      },
    ]);
    this.prodResults.set([]);
    this.prodQuery.set('');
  }
  addSuggested(s: SuggestedItem) {
    if (this.items().some((i) => i.productId === s.productId)) return;
    const qty = Math.max(1, Math.round(s.avgQuantity || 1));
    this.items.update((list) => [
      ...list,
      {
        productId: s.productId,
        productName: s.productName,
        quantity: qty,
        unitPrice: null,
        lineTotal: null,
      },
    ]);
  }
  setQty(item: ItemDraft, qty: number) {
    const q = Math.max(1, qty || 1);
    this.items.update((list) =>
      list.map((i) =>
        i.productId === item.productId
          ? { ...i, quantity: q, unitPrice: null, lineTotal: null }
          : i,
      ),
    );
  }
  removeItem(item: ItemDraft) {
    this.items.update((list) => list.filter((i) => i.productId !== item.productId));
  }

  previewPrices() {
    const pcId = this.paymentConditionId();
    const ctId = this.customerTypeId();
    if (!pcId || !ctId || !this.items().length) {
      this.toast.info('Necesitas cliente con tipo y condición de pago para previsualizar.');
      return;
    }
    const calls = this.items().map((it) =>
      this.prices.resolve(it.productId, pcId, ctId, it.quantity).pipe(
        map((r) => {
          const price = typeof r === 'number' ? r : (r?.unitPrice ?? null);
          return { ...it, unitPrice: price, lineTotal: price != null ? price * it.quantity : null };
        }),
        catchError(() => of({ ...it, unitPrice: null, lineTotal: null })),
      ),
    );
    forkJoin(calls).subscribe((updated) => this.items.set(updated));
  }

  // ── Dotaciones ──
  addGift(a: AllocationView) {
    if (this.gifts().some((g) => g.allocationId === a.allocationId)) return;
    this.gifts.update((list) => [
      ...list,
      {
        allocationId: a.allocationId,
        productName: a.productName,
        quantity: 1,
        available: a.availableQuantity,
      },
    ]);
  }
  setGiftQty(g: GiftDraft, qty: number) {
    const q = Math.min(g.available, Math.max(1, qty || 1));
    this.gifts.update((list) =>
      list.map((x) => (x.allocationId === g.allocationId ? { ...x, quantity: q } : x)),
    );
  }
  removeGift(g: GiftDraft) {
    this.gifts.update((list) => list.filter((x) => x.allocationId !== g.allocationId));
  }

  // ── Crear ──
  canSubmit() {
    return (
      !!this.customer() &&
      !!this.paymentConditionId() &&
      this.items().length > 0 &&
      !this.submitting()
    );
  }
  submit() {
    if (!this.canSubmit()) return;
    const c = this.customer()!;
    this.submitting.set(true);
    const cmd: CreateOrderCommand = {
      customerId: c.customerId,
      paymentConditionId: this.paymentConditionId()!,
      captureModeId: this.captureModeId,
      note: this.note() || undefined,
      idempotencyKey: this.idempotencyKey,
      items: this.items().map((i) => ({ productId: i.productId, quantity: i.quantity })),
      allocationItems: this.gifts().length
        ? this.gifts().map((g) => ({ allocationId: g.allocationId, quantity: g.quantity }))
        : undefined,
    };
    this.orders.create(cmd).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.result.set(res);
        if (res.duplicate) this.toast.info('El pedido ya existía: no se duplicó (idempotencia).');
        else this.toast.success('Pedido creado');
      },
      error: () => this.submitting.set(false),
    });
  }

  goToDetail() {
    const r = this.result();
    if (r) void this.router.navigate(['/pedidos', r.orderId]);
  }
  sendToBilling() {
    const r = this.result();
    if (!r) return;
    this.orders.sendToBilling(r.orderId).subscribe(() => {
      this.toast.success('Enviado a facturación');
      this.goToDetail();
    });
  }
}
