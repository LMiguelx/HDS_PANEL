import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiCard } from '../../shared/ui/card/card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { OrderSimulationService } from './order-simulation';
import { CatalogLookupService } from '../catalog/catalog-lookup';
import { LookupService, toUiLookup } from './lookup';
import {
  OrderSimulationView,
  SimulateOrderCommand,
} from '../../shared/models/promo-simulation.models';
import { formatSoles } from '../../shared/pipes/money';

interface CartLine {
  productId: number;
  productName: string;
  quantity: number;
}

/**
 * Simular pedido — doc 30, sección 10: igual que el panel de la derecha de
 * Nuevo pedido, pero sin registrar nada. Sirve para probar promociones
 * antes de salir a vender. Puede llegar con `?channelId=` desde el botón
 * "Simular" del detalle de una promoción.
 */
@Component({
  selector: 'app-simulate-order-page',
  imports: [UiField, UiTypeahead, UiCard, UiEmpty],
  template: `
    <section class="sim-page">
      <div class="sim-head">
        <p class="sim-eyebrow">Promociones</p>
        <h1>Simular pedido</h1>
        <p class="sim-sub">Simulación — no se guarda nada.</p>
      </div>

      <ui-card variant="section" class="sim-bar">
        <ui-typeahead
          label="Cliente"
          placeholder="Busca por razón social o código"
          [clearOnPick]="false"
          [search]="searchCustomers"
          [(selected)]="customer"
        />
        <ui-field
          label="Canal de venta"
          type="select"
          [(value)]="salesChannelId"
          [options]="channelOptions()"
        />
        <ui-field
          label="Condición de pago"
          type="select"
          [(value)]="paymentConditionId"
          [options]="paymentConditionOptions()"
        />
      </ui-card>

      <div class="sim-grid">
        <div class="sim-left">
          <ui-typeahead
            label="Agregar producto"
            placeholder="Busca por nombre"
            [clearOnPick]="true"
            [search]="searchProducts"
            (picked)="addProduct($event)"
          />
          <div class="sim-lines">
            @if (lines().length === 0) {
              <ui-empty title="Sin productos" body="Agrega productos para simular el pedido." />
            } @else {
              @for (line of lines(); track line.productId) {
                <div class="sim-line-row">
                  <span class="sim-line-name">{{ line.productName }}</span>
                  <input
                    class="sim-line-qty"
                    type="number"
                    min="0.001"
                    step="0.001"
                    [value]="line.quantity"
                    (change)="updateQuantity(line, $event)"
                  />
                  <button type="button" class="sim-line-remove" (click)="removeLine(line)">
                    ✕
                  </button>
                </div>
              }
            }
          </div>
        </div>

        <div class="sim-right">
          <ui-card variant="work" class="sim-result-card">
            <h2 class="sim-result-title">Resultado</h2>
            @if (simulating()) {
              <p class="sim-muted">Calculando…</p>
            } @else if (simResult(); as s) {
              <div class="sim-result-lines">
                @for (sl of s.lines; track sl.productId) {
                  <div class="sim-result-line-row">
                    <span>{{ sl.quantity }} × {{ sl.productName }}</span>
                    <span class="sim-muted">{{ formatSoles(sl.subtotal) }}</span>
                  </div>
                }
              </div>

              @if (s.appliedPromos.length > 0) {
                <h3 class="sim-result-subtitle">Promociones aplicadas</h3>
                @for (promo of s.appliedPromos; track promo.promoId) {
                  <div class="sim-result-promo">
                    <div class="sim-result-promo-name">{{ promo.promoName }}</div>
                    @for (g of promo.granted; track g.displayText) {
                      <div class="sim-muted">{{ g.displayText }}</div>
                    }
                    @for (c of promo.pendingChoices; track c.groupLabel) {
                      <div class="sim-muted">{{ c.groupLabel }} — se elegiría al entregar</div>
                    }
                  </div>
                }
              } @else {
                <p class="sim-muted">Ninguna promoción se aplica con este carrito.</p>
              }

              @if (s.nearPromos.length > 0) {
                <h3 class="sim-result-subtitle">Cerca de ganar</h3>
                @for (np of s.nearPromos; track np.promoId) {
                  <div class="sim-near-promo">
                    <div class="sim-muted">{{ np.progressText }}</div>
                    <div class="sim-near-track">
                      <div class="sim-near-fill" [style.width.%]="np.percentComplete"></div>
                    </div>
                  </div>
                }
              }

              <div class="sim-totals">
                <div class="sim-total-row">
                  <span>Bruto</span><span>{{ formatSoles(s.totalAmount) }}</span>
                </div>
                <div class="sim-total-row">
                  <span>Descuento</span><span>{{ formatSoles(s.discountAmount) }}</span>
                </div>
                <div class="sim-total-row sim-total-strong">
                  <span>Neto</span><span>{{ formatSoles(s.netAmount) }}</span>
                </div>
              </div>
            } @else {
              <p class="sim-muted">Elige cliente, condición de pago y agrega productos.</p>
            }
          </ui-card>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .sim-page {
        width: 100%;
        box-sizing: border-box;
        padding: var(--sp-8);
      }
      .sim-head {
        margin-bottom: 20px;
      }
      .sim-eyebrow {
        margin: 0;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      h1 {
        font: var(--fw-display) var(--fs-display) / var(--lh-display) var(--font-sans);
        margin: 2px 0 4px;
        color: var(--ink);
      }
      .sim-sub {
        margin: 0;
        font-size: 13px;
        font-weight: 800;
        color: var(--accent-ink);
      }
      .sim-bar {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
        gap: 14px;
        margin-bottom: 24px;
      }
      .sim-muted {
        color: var(--ink-muted);
        font-size: 13px;
      }
      .sim-grid {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 28px;
        align-items: start;
      }
      .sim-lines {
        display: grid;
        gap: 1px;
        background: var(--hairline);
        border: 1px solid var(--hairline);
        margin-top: 16px;
      }
      .sim-line-row {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--bg);
        padding: 10px 12px;
      }
      .sim-line-name {
        flex: 1;
        font-size: 14px;
      }
      .sim-line-qty {
        width: 80px;
        font-family: var(--font-sans);
        font-size: 14px;
        min-height: var(--touch-min);
        border: 1px solid var(--divider);
        padding: 0 8px;
        background: var(--surface-sunk);
        color: var(--ink);
      }
      .sim-line-remove {
        border: 0;
        background: transparent;
        color: var(--ink-muted);
        cursor: pointer;
        min-height: var(--touch-min);
        min-width: 36px;
      }
      .sim-line-remove:hover {
        color: var(--ink);
      }
      .sim-right {
        position: sticky;
        top: 76px;
      }
      .sim-result-card {
        display: grid;
        gap: 14px;
      }
      .sim-result-title {
        font: var(--fw-h2) var(--fs-h2) / var(--lh-h2) var(--font-sans);
        margin: 0;
        color: var(--ink);
      }
      .sim-result-subtitle {
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-muted);
        margin: 4px 0 0;
      }
      .sim-result-lines {
        display: grid;
        gap: 6px;
      }
      .sim-result-line-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }
      .sim-result-promo {
        padding: 8px 0;
        border-top: 1px dashed var(--hairline);
      }
      .sim-result-promo-name {
        font-weight: 700;
        font-size: 13px;
      }
      .sim-near-promo {
        display: grid;
        gap: 6px;
      }
      .sim-near-track {
        height: 8px;
        background: var(--faint);
      }
      .sim-near-fill {
        height: 100%;
        background: var(--accent);
      }
      .sim-totals {
        border-top: var(--border-rule);
        padding-top: 12px;
        display: grid;
        gap: 6px;
      }
      .sim-total-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
      }
      .sim-total-strong {
        font-size: 18px;
        font-weight: 800;
      }

      @media (max-width: 900px) {
        .sim-grid {
          grid-template-columns: 1fr;
        }
        .sim-right {
          position: static;
        }
      }

      @media (max-width: 767px) {
        .sim-page {
          padding: var(--sp-4);
        }
      }
    `,
  ],
})
export class SimulateOrderPage {
  private simulationSvc = inject(OrderSimulationService);
  private catalogSvc = inject(CatalogLookupService);
  private lookupSvc = inject(LookupService);

  channelIdParam = input('', { alias: 'channelId' });

  protected formatSoles = formatSoles;

  protected customer = signal<UiLookupItem | null>(null);
  protected salesChannelId = signal('');
  protected channelOptions = signal<UiFieldOption[]>([{ value: '', label: 'Sin canal' }]);
  protected paymentConditions = signal<UiFieldOption[]>([]);
  protected paymentConditionId = signal('');
  protected paymentConditionOptions = signal<UiFieldOption[]>([{ value: '', label: 'Selecciona' }]);

  protected lines = signal<CartLine[]>([]);
  protected simResult = signal<OrderSimulationView | null>(null);
  protected simulating = signal(false);

  protected searchCustomers = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));
  protected searchProducts = (q: string) =>
    this.lookupSvc.products(q).pipe(map((items) => toUiLookup(items)));

  private simTrigger$ = new Subject<void>();

  private seedChannelEffect = effect(() => {
    const channelId = this.channelIdParam();
    untracked(() => {
      if (channelId) this.salesChannelId.set(channelId);
    });
  });

  constructor() {
    this.catalogSvc.paymentConditions().subscribe((list) => {
      this.paymentConditionOptions.set([
        { value: '', label: 'Selecciona' },
        ...list.map((p) => ({ value: String(p.paymentConditionId), label: p.name })),
      ]);
    });
    this.lookupSvc.salesChannels().subscribe((list) => {
      this.channelOptions.set([
        { value: '', label: 'Sin canal' },
        ...list.map((i) => ({ value: String(i.id), label: i.name ?? '' })),
      ]);
    });

    this.simTrigger$
      .pipe(
        debounceTime(400),
        switchMap(() => {
          const cmd = this.buildSimulateCommand();
          if (!cmd) return of(null);
          this.simulating.set(true);
          return this.simulationSvc.simulateOrder(cmd).pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((result) => {
        this.simulating.set(false);
        this.simResult.set(result);
      });

    effect(() => {
      this.lines();
      this.customer();
      this.salesChannelId();
      this.paymentConditionId();
      untracked(() => this.simTrigger$.next());
    });
  }

  private buildSimulateCommand(): SimulateOrderCommand | null {
    const customer = this.customer();
    const paymentConditionId = Number(this.paymentConditionId());
    const lines = this.lines();
    if (!customer || !paymentConditionId || lines.length === 0) return null;
    return {
      customerId: customer.id,
      paymentConditionId,
      salesChannelId: this.salesChannelId() ? Number(this.salesChannelId()) : 0,
      lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    };
  }

  protected addProduct(item: UiLookupItem) {
    const existing = this.lines().find((l) => l.productId === item.id);
    if (existing) {
      this.lines.update((list) =>
        list.map((l) => (l.productId === item.id ? { ...l, quantity: l.quantity + 1 } : l)),
      );
      return;
    }
    this.lines.update((list) => [
      ...list,
      { productId: item.id, productName: item.name, quantity: 1 },
    ]);
  }

  protected updateQuantity(line: CartLine, ev: Event) {
    const value = Number((ev.target as HTMLInputElement).value);
    if (!(value > 0)) return;
    this.lines.update((list) =>
      list.map((l) => (l.productId === line.productId ? { ...l, quantity: value } : l)),
    );
  }

  protected removeLine(line: CartLine) {
    this.lines.update((list) => list.filter((l) => l.productId !== line.productId));
  }
}
