import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { format } from 'date-fns';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { UiButton } from '../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../shared/ui/field/field';
import { UiTypeahead, UiLookupItem } from '../../shared/ui/typeahead/typeahead';
import { UiCard } from '../../shared/ui/card/card';
import { UiEmpty } from '../../shared/ui/empty/empty';
import { OrderSimulationService } from './order-simulation';
import { CatalogLookupService } from '../catalog/catalog-lookup';
import { LookupService, toUiLookup } from './lookup';
import { PromoService } from './promo';
import { PromoDetail } from './promo.types';
import { dateText } from './promo-format';
import { benefitText } from './domain/promo-texts';
import {
  OrderSimulationView,
  SimulateOrderCommand,
  TestedPromoView,
} from '../../shared/models/promo-simulation.models';
import { formatSoles } from '../../shared/pipes/money';

interface CartLine {
  productId: number;
  productName: string;
  quantity: number;
}

/**
 * Simular pedido — doc 30, sección 10, con la promoción en prueba del
 * doc 44, sección 9: igual que el panel de la derecha de Nuevo pedido,
 * pero sin registrar nada. Puede llegar con `?channelId=` desde el botón
 * "Simular" del detalle de una promoción (vigente), o con `?promoId=` para
 * probar una promoción puntual aunque esté apagada o fuera de fecha.
 */
@Component({
  selector: 'app-simulate-order-page',
  imports: [UiField, UiTypeahead, UiCard, UiEmpty, UiButton],
  template: `
    <section class="sim-page">
      <div class="sim-head">
        <p class="sim-eyebrow">Promociones</p>
        <h1>Simular pedido</h1>
        <p class="sim-sub">Simulación — no se guarda nada.</p>
      </div>

      @if (testedPromoMeta(); as tp) {
        <div class="sim-tested-chip">
          <span class="sim-tested-chip-code">EN PRUEBA · {{ tp.code }} · {{ tp.name }}</span>
          @if (testedPromoBadge(tp); as badge) {
            <span class="sim-tested-chip-badge">{{ badge }}</span>
          }
          <button
            type="button"
            class="sim-tested-chip-close"
            title="Quitar promoción en prueba"
            (click)="removeTestedPromo()"
          >
            ✕
          </button>
        </div>
        @if (fromWizardParam() === '1') {
          <button type="button" class="sim-back-link" (click)="goBackToWizard()">
            ← Volver al asistente
          </button>
        }
      }

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
          @if (scopeHintText(); as hint) {
            <p class="sim-scope-hint">{{ hint }}</p>
          }
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
          @if (testedPromo(); as tp) {
            <ui-card
              variant="work"
              class="sim-tested-card"
              [class.sim-tested-ok]="tp.eligible && tp.earned"
              [class.sim-tested-warn]="tp.eligible && !tp.earned"
              [class.sim-tested-bad]="!tp.eligible"
            >
              @if (tp.eligible && tp.earned) {
                <div class="sim-tested-head">✓ Gana</div>
                @for (g of testedGrantedBenefits(); track $index) {
                  <div class="sim-tested-line">{{ benefitText(g) }}</div>
                }
                @if (tp.progressText) {
                  <div class="sim-muted sim-tested-progress">{{ tp.progressText }}</div>
                }
              } @else if (tp.eligible) {
                <div class="sim-tested-head">No gana todavía</div>
                <div class="sim-tested-line">{{ tp.progressText }}</div>
                @if (tp.nextThreshold) {
                  <div class="sim-near-track">
                    <div class="sim-near-fill" [style.width.%]="testedProgressPercent(tp)"></div>
                  </div>
                }
              } @else {
                <div class="sim-tested-head">No le llega a este pedido</div>
                <div class="sim-tested-line">{{ tp.notEligibleReason }}</div>
                @if (showUseChannelSuggestion()) {
                  <button
                    uiButton
                    variant="secondary"
                    size="sm"
                    class="sim-use-channel"
                    (click)="useTestedPromoChannel()"
                  >
                    Usar canal {{ testedPromoMeta()?.salesChannelName }}
                  </button>
                }
              }
            </ui-card>
          }
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
                  @if (sl.discountAmount) {
                    <div class="sim-result-line-discount">
                      <span>Descuento: − {{ formatSoles(sl.discountAmount) }}</span>
                      <span class="sim-result-line-net"
                        >Neto: {{ formatSoles(sl.netSubtotal) }}</span
                      >
                    </div>
                  }
                }
              </div>

              @if (s.appliedPromos.length > 0) {
                <h3 class="sim-result-subtitle">Promociones aplicadas</h3>
                @for (promo of s.appliedPromos; track promo.promoId) {
                  <div class="sim-result-promo">
                    <div class="sim-result-promo-name">
                      {{ promo.promoName }}
                      @if (promo.promoId === testedPromoMeta()?.promoId) {
                        <span class="sim-tested-tag">En prueba</span>
                      }
                    </div>
                    @for (g of promo.granted; track g.displayText) {
                      <div class="sim-muted">{{ g.displayText }}</div>
                    }
                    @for (c of promo.pendingChoices; track c.groupLabel) {
                      <div class="sim-pending-choice">
                        <div class="sim-pending-choice-title">
                          Premio a elegir · {{ c.groupLabel }}
                        </div>
                        <div class="sim-muted">El vendedor lo elige al tomar el pedido.</div>
                        @for (opt of c.options; track opt.displayText) {
                          <div class="sim-muted">{{ opt.displayText }}</div>
                        }
                      </div>
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
                    <div class="sim-muted">
                      {{ np.progressText }}
                      @if (np.promoId === testedPromoMeta()?.promoId) {
                        <span class="sim-tested-tag">En prueba</span>
                      }
                    </div>
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
      .sim-result-line-discount {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        color: var(--status-danger);
        margin-top: -2px;
        margin-bottom: 4px;
      }
      .sim-result-line-net {
        font-weight: 700;
      }
      .sim-pending-choice {
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px dashed var(--hairline);
      }
      .sim-pending-choice-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--accent-ink);
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
      .sim-tested-chip {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border: 2px solid var(--accent);
        margin-bottom: 8px;
        font-size: 13px;
      }
      .sim-tested-chip-code {
        font-weight: 800;
        letter-spacing: 0.02em;
      }
      .sim-tested-chip-badge {
        font-size: 12px;
        color: var(--ink-muted);
      }
      .sim-tested-chip-close {
        border: 0;
        background: transparent;
        color: var(--ink-muted);
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
      }
      .sim-tested-chip-close:hover {
        color: var(--ink);
      }
      .sim-back-link {
        display: block;
        border: 0;
        background: transparent;
        color: var(--accent-ink);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        padding: 0 0 16px;
      }
      .sim-scope-hint {
        margin: -10px 0 14px;
        font-size: 12px;
        color: var(--ink-muted);
      }
      .sim-tested-card {
        display: grid;
        gap: 8px;
        margin-bottom: 16px;
        border-left-width: 4px;
      }
      .sim-tested-ok {
        border-left-color: var(--status-ok);
      }
      .sim-tested-warn {
        border-left-color: var(--status-warn);
      }
      .sim-tested-bad {
        border-left-color: var(--status-danger);
      }
      .sim-tested-head {
        font-size: 15px;
        font-weight: 800;
        color: var(--ink);
      }
      .sim-tested-line {
        font-size: 14px;
        color: var(--ink);
      }
      .sim-tested-progress {
        margin-top: 2px;
      }
      .sim-use-channel {
        justify-self: start;
        margin-top: 4px;
      }
      .sim-tested-tag {
        margin-left: 6px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--accent-ink);
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
  private promoSvc = inject(PromoService);
  private router = inject(Router);

  channelIdParam = input('', { alias: 'channelId' });
  /** Promoción en prueba (doc 44, sección 9.3) y de dónde se vino (para el enlace de vuelta). */
  promoIdParam = input('', { alias: 'promoId' });
  fromWizardParam = input('', { alias: 'fromWizard' });

  protected formatSoles = formatSoles;
  protected benefitText = benefitText;

  protected customer = signal<UiLookupItem | null>(null);
  protected salesChannelId = signal('');
  protected channelOptions = signal<UiFieldOption[]>([{ value: '', label: 'Sin canal' }]);
  protected paymentConditions = signal<UiFieldOption[]>([]);
  protected paymentConditionId = signal('');
  protected paymentConditionOptions = signal<UiFieldOption[]>([{ value: '', label: 'Selecciona' }]);

  protected lines = signal<CartLine[]>([]);
  protected simResult = signal<OrderSimulationView | null>(null);
  protected simulating = signal(false);

  /** La promoción en prueba precargada (chip + ayudas), null si se quitó o no se pidió. */
  protected testedPromoMeta = signal<PromoDetail | null>(null);
  protected testedPromo = computed(
    (): TestedPromoView | null => this.simResult()?.testedPromo ?? null,
  );

  protected testedGrantedBenefits = computed(() => {
    const tp = this.testedPromo();
    const s = this.simResult();
    if (!tp || !s) return [];
    return s.appliedPromos.find((ap) => ap.promoId === tp.promoId)?.granted ?? [];
  });

  protected showUseChannelSuggestion = computed(() => {
    const tp = this.testedPromo();
    return (
      !!tp &&
      !tp.eligible &&
      !!tp.notEligibleReason?.startsWith('La promoción es del canal') &&
      !!this.testedPromoMeta()?.salesChannelId
    );
  });

  /** "Agrega productos de la marca/familia {nombre}" o "...hasta llegar a S/ {monto}" — sección 9.3. */
  protected scopeHintText = computed(() => {
    const p = this.testedPromoMeta();
    if (!p || p.promoType === 'CUSTOMER_LIST') return '';
    if (p.measureType === 'AMOUNT') {
      const amount = p.tiers?.[0]?.fromAmount;
      return amount != null ? `Agrega productos hasta llegar a ${formatSoles(amount)}` : '';
    }
    const nonProduct = (p.conditions ?? []).find(
      (c) => c.scope === 'FAMILY' || c.scope === 'BRAND',
    );
    if (!nonProduct) return '';
    const kind = nonProduct.scope === 'FAMILY' ? 'familia' : 'marca';
    const name = nonProduct.scope === 'FAMILY' ? nonProduct.familyName : nonProduct.brandName;
    return `Agrega productos de la ${kind} ${name}`;
  });

  protected searchCustomers = (q: string) =>
    this.lookupSvc.customers(q).pipe(map((items) => toUiLookup(items)));
  protected searchProducts = (q: string) => {
    const brandCondition = (this.testedPromoMeta()?.conditions ?? []).find(
      (c) => c.scope === 'BRAND',
    );
    return this.lookupSvc
      .products(q, brandCondition?.brandId ? { brandId: brandCondition.brandId } : {})
      .pipe(map((items) => toUiLookup(items)));
  };

  private simTrigger$ = new Subject<void>();

  private seedChannelEffect = effect(() => {
    const channelId = this.channelIdParam();
    untracked(() => {
      if (channelId) this.salesChannelId.set(channelId);
    });
  });

  private seedTestedPromoEffect = effect(() => {
    const promoId = this.promoIdParam();
    untracked(() => {
      if (promoId) this.loadTestedPromo(Number(promoId));
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
      this.testedPromoMeta();
      untracked(() => this.simTrigger$.next());
    });
  }

  private loadTestedPromo(promoId: number) {
    this.promoSvc.detail(promoId).subscribe({
      next: (p) => {
        this.testedPromoMeta.set(p);
        if (p.salesChannelId) this.salesChannelId.set(String(p.salesChannelId));
        this.prefillLinesFromPromo(p);
      },
      error: () => this.testedPromoMeta.set(null),
    });
    this.catalogSvc.paymentConditions().subscribe((list) => {
      if (list.length && !this.paymentConditionId()) {
        this.paymentConditionId.set(String(list[0].paymentConditionId));
      }
    });
  }

  private prefillLinesFromPromo(p: PromoDetail) {
    if (p.promoType === 'CUSTOMER_LIST' || p.measureType === 'AMOUNT') {
      this.lines.set([]);
      return;
    }
    const productConditions = (p.conditions ?? []).filter(
      (c) => c.scope === 'PRODUCT' && c.productId,
    );
    if (productConditions.length === 0) {
      this.lines.set([]);
      return;
    }
    const firstQuantity = p.tiers?.[0]?.fromQuantity ?? 1;
    this.lines.set(
      productConditions.map((c, i) => ({
        productId: c.productId!,
        productName: c.productName ?? '',
        quantity: i === 0 ? firstQuantity : 0,
      })),
    );
  }

  protected testedPromoBadge(p: {
    active?: boolean | null;
    startDate?: string | null;
    endDate?: string | null;
  }): string {
    if (!p.active) return 'Apagada · en prueba';
    const today = format(new Date(), 'yyyy-MM-dd');
    if (p.startDate && p.startDate > today) return `Empieza el ${dateText(p.startDate)}`;
    if (p.endDate && p.endDate < today) return `Venció el ${dateText(p.endDate)}`;
    return '';
  }

  protected testedProgressPercent(tp: TestedPromoView): number {
    if (!tp.nextThreshold) return 0;
    return Math.min(100, Math.round((tp.measuredValue / tp.nextThreshold) * 100));
  }

  protected useTestedPromoChannel() {
    const channelId = this.testedPromoMeta()?.salesChannelId;
    if (channelId) this.salesChannelId.set(String(channelId));
  }

  protected removeTestedPromo() {
    this.testedPromoMeta.set(null);
  }

  protected goBackToWizard() {
    const id = this.testedPromoMeta()?.promoId;
    if (!id) return;
    this.router.navigate(['/promociones', id, 'editar'], { queryParams: { step: 5 } });
  }

  private buildSimulateCommand(): SimulateOrderCommand | null {
    const customer = this.customer();
    const paymentConditionId = Number(this.paymentConditionId());
    const lines = this.lines();
    if (!customer || !paymentConditionId || lines.length === 0) return null;
    const promoId = this.testedPromoMeta()?.promoId;
    return {
      customerId: customer.id,
      paymentConditionId,
      salesChannelId: this.salesChannelId() ? Number(this.salesChannelId()) : 0,
      lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      ...(promoId ? { promoId } : {}),
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
