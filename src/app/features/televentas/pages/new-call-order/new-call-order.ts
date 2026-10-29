import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { UiButton } from '../../../../shared/ui/button/button';
import { UiField, UiFieldOption } from '../../../../shared/ui/field/field';
import { UiCard } from '../../../../shared/ui/card/card';
import { UiEmpty } from '../../../../shared/ui/empty/empty';
import { UiBadge } from '../../../../shared/ui/badge/badge';
import { UiTabs, UiTabItem } from '../../../../shared/ui/tabs/tabs';
import { ToastService } from '../../../../core/ui/toast';
import { TelesalesDayStore } from '../../data-access/televentas.store';
import { TelesalesSessionService } from '../../data-access/televentas-session';
import { TelesalesApi } from '../../data-access/televentas.api';
import { RouteStore } from '../../../orders/route-store';
import { CustomerService } from '../../../customers/customer';
import { ProductAdminService } from '../../../catalog/product-admin';
import { AllocationService } from '../../../sales/allocation';
import { CustomerDetail, CustomerSummary } from '../../../../shared/models/customer.models';
import { ProductView } from '../../../../shared/models/catalog.models';
import { SuggestedItem } from '../../../../shared/models/counter-order.models';
import {
  MobilePromoCatalogView,
  MobilePromoProgressView,
} from '../../../../shared/models/promo-simulation.models';
import { PromoCatalogPanel } from '../../../promos/ui/promo-catalog-panel';
import { AllocationView } from '../../../../shared/models/allocation.models';
import {
  MobileChoiceOptionView,
  MobileChoiceView,
  PriceResolved,
  PromoChoiceCommand,
} from '../../domain/televentas.models';
import { formatSoles } from '../../../../shared/pipes/money';
import { isWholeQuantity, toWholeQuantity } from '../../../../shared/utils/quantity';
import { ratingText } from '../../../customers/customer-format';

interface CartLine {
  productId: number;
  productName: string;
  quantity: number;
  source: 'catalog' | 'suggested';
}

interface AllocationRow {
  allocationId: number;
  productName: string;
  promoName: string | null;
  periodEnd: string | null;
  available: number;
}

type FormTab = 'catalogo' | 'sugerido' | 'promociones' | 'dotacion';

const TABS: UiTabItem[] = [
  { value: 'catalogo', label: 'Catálogo' },
  { value: 'sugerido', label: 'Sugerido' },
  { value: 'promociones', label: 'Promociones' },
  { value: 'dotacion', label: 'Dotación' },
];

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function inputNumber(input: HTMLInputElement): number {
  return input.value.trim() === '' ? Number.NaN : Number(input.value);
}

/**
 * Nuevo pedido por llamada — doc 42, sección 7. Misma distribución de dos
 * columnas que el pedido de mostrador (doc 30), pero el cliente viene de la
 * cartera del vendedor, sin selector de canal, siempre a domicilio y con
 * dotación. El registro va por `POST /api/orders` (el de la app), no por
 * `/orders/counter`: el motor de precios también es el de la app
 * (`/prices/resolve` + `/mobile/promos/draft-preview`), así que no
 * reutiliza `counter-order-form.ts` más allá del patrón visual.
 */
@Component({
  selector: 'app-new-call-order',
  imports: [UiButton, UiField, UiCard, UiEmpty, UiBadge, UiTabs, PromoCatalogPanel],
  templateUrl: './new-call-order.html',
  styleUrls: ['./new-call-order.scss'],
})
export class NewCallOrderPage {
  private api = inject(TelesalesApi);
  private customerSvc = inject(CustomerService);
  private productSvc = inject(ProductAdminService);
  private allocationSvc = inject(AllocationService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected store = inject(TelesalesDayStore);
  protected session = inject(TelesalesSessionService);
  protected routeStore = inject(RouteStore);

  customerIdParam = input<string | undefined>(undefined, { alias: 'customerId' });
  assignmentIdParam = input<string | undefined>(undefined, { alias: 'assignmentId' });

  protected formatSoles = formatSoles;
  protected ratingText = ratingText;
  protected tabs = TABS;

  protected jornadaOpen = computed(
    () => !!this.routeStore.route() && !this.routeStore.route()!.endTime,
  );

  protected customer = signal<CustomerDetail | null>(null);
  protected customerLoading = signal(false);
  protected customerError = signal(false);
  protected assignmentId = signal<number | null>(null);

  protected customerSearch = signal('');
  protected customerResults = computed<CustomerSummary[]>(() => {
    if (this.customer()) return [];
    const q = normalize(this.customerSearch());
    if (!q) return [];
    const all = [...this.store.portfolio(), ...this.store.coverage()];
    return all
      .filter(
        (c) =>
          normalize(c.businessName).includes(q) ||
          normalize(c.code).includes(q) ||
          normalize(c.documentNumber).includes(q),
      )
      .slice(0, 20);
  });

  protected paymentConditionId = signal('');
  protected paymentConditionOptions = computed<UiFieldOption[]>(() => [
    { value: '', label: 'Selecciona' },
    ...this.session.paymentConditions().map((p) => ({
      value: String(p.paymentConditionId),
      label: p.name,
    })),
  ]);

  protected note = signal('');
  protected activeTab = signal<FormTab>('catalogo');

  protected productQuery = signal('');
  protected productBrandId = signal('');
  protected brandOptions = signal<UiFieldOption[]>([{ value: '', label: 'Todas las marcas' }]);
  protected products = signal<ProductView[]>([]);
  protected productsLoading = signal(false);

  protected suggested = signal<SuggestedItem[]>([]);
  protected suggestedLoading = signal(false);
  protected promoCatalog = signal<MobilePromoCatalogView | null>(null);
  protected promoCatalogLoading = signal(false);
  protected promoCatalogError = signal(false);
  private promoCatalogFeaturedOnly = true;

  protected allocations = signal<AllocationView[]>([]);
  protected allocationQuantities = signal<Map<number, number>>(new Map());
  protected allocationRows = computed<AllocationRow[]>(() =>
    this.allocations().map((a) => ({
      allocationId: a.allocationId,
      productName: a.productName,
      promoName: a.promoName,
      periodEnd: a.periodEnd,
      available: a.availableQuantity,
    })),
  );

  protected lines = signal<CartLine[]>([]);
  protected prices = signal<Map<number, PriceResolved>>(new Map());
  protected pricesLoading = signal(false);
  protected promoProgress = signal<MobilePromoProgressView[]>([]);
  protected draftChoices = signal<MobileChoiceView[]>([]);
  private draftChoiceSelections = signal<Map<string, number[]>>(new Map());

  protected subtotal = computed(() =>
    this.lines().reduce((sum, l) => sum + (this.prices().get(l.productId)?.subtotal ?? 0), 0),
  );
  protected allocationCount = computed(
    () => Array.from(this.allocationQuantities().values()).filter((q) => q > 0).length,
  );

  protected submitting = signal(false);
  private idempotencyKey = signal(newIdempotencyKey());
  private previewTrigger$ = new Subject<void>();
  private productSearchTrigger$ = new Subject<void>();

  protected canSubmit = computed(
    () =>
      this.jornadaOpen() &&
      !this.submitting() &&
      !!this.customer() &&
      !!this.assignmentId() &&
      !!this.paymentConditionId() &&
      this.lines().length > 0,
  );

  protected submitDisabledReason = computed(() => {
    if (!this.jornadaOpen()) return 'Abre tu jornada para registrar el pedido';
    if (!this.customer()) return 'Elige un cliente';
    if (!this.assignmentId()) return 'Este cliente no tiene una asignación vigente';
    if (!this.paymentConditionId()) return 'Elige la condición de pago';
    if (this.lines().length === 0) return 'Agrega productos';
    return '';
  });

  constructor() {
    this.store.ensureLoaded();
    this.store.ensureFullAssignmentsLoaded();
    this.session.ensureLoaded();

    // El `assignmentId` puede llegar vacío aunque haya cliente: se resuelve
    // apenas el plan o la cartera completa terminen de cargar.
    effect(() => {
      const customer = this.customer();
      const plan = this.store.plan();
      const full = this.store.fullAssignments();
      untracked(() => {
        if (!customer || this.assignmentId()) return;
        const fromPlan = plan.find((s) => s.customerId === customer.customerId);
        if (fromPlan) {
          this.assignmentId.set(fromPlan.assignmentId);
          return;
        }
        const fromFull = full.find((a) => a.customerId === customer.customerId);
        if (fromFull) this.assignmentId.set(fromFull.assignmentId);
      });
    });

    // Query params (doc 38, sección 2.2: ausentes llegan undefined) —
    // preselección cuando se entra desde Mi día.
    effect(() => {
      const customerId = Number(this.customerIdParam());
      const assignmentId = Number(this.assignmentIdParam());
      untracked(() => {
        if (!customerId) return;
        if (assignmentId) this.assignmentId.set(assignmentId);
        this.loadCustomer(customerId);
      });
    });

    this.previewTrigger$
      .pipe(
        debounceTime(400),
        switchMap(() => {
          const customer = this.customer();
          const paymentConditionId = Number(this.paymentConditionId());
          const lines = this.lines();
          if (!customer || !paymentConditionId || lines.length === 0) {
            this.prices.set(new Map());
            this.promoProgress.set([]);
            this.draftChoices.set([]);
            this.draftChoiceSelections.set(new Map());
            return of(null);
          }
          this.pricesLoading.set(true);
          const customerTypeId = customer.customerTypeId ?? 0;
          const priceCalls = lines.map((l) =>
            this.api
              .resolvePrice(l.productId, paymentConditionId, customerTypeId, l.quantity)
              .pipe(catchError(() => of(null))),
          );
          return forkJoin(priceCalls).pipe(
            switchMap((results) => {
              const map = new Map<number, PriceResolved>();
              for (const r of results) if (r) map.set(r.productId, r);
              this.prices.set(map);
              const draftCmd = {
                customerId: customer.customerId,
                paymentConditionId,
                lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
              };
              return forkJoin({
                progress: this.api.draftPreview(draftCmd).pipe(catchError(() => of([]))),
                choices: this.api.draftChoices(draftCmd).pipe(catchError(() => of([]))),
              });
            }),
          );
        }),
      )
      .subscribe((result) => {
        this.pricesLoading.set(false);
        if (!result) return;
        this.promoProgress.set(result.progress ?? []);
        this.draftChoices.set(result.choices ?? []);
        this.pruneStaleChoiceSelections(result.choices ?? []);
      });

    effect(() => {
      this.lines();
      this.paymentConditionId();
      this.customer();
      untracked(() => this.previewTrigger$.next());
    });

    this.productSearchTrigger$
      .pipe(
        debounceTime(300),
        switchMap(() => {
          const warehouseId = this.session.warehouseId();
          if (!warehouseId) return of(null);
          this.productsLoading.set(true);
          return this.productSvc
            .list({
              warehouseId,
              q: this.productQuery() || undefined,
              brandId: this.productBrandId() ? Number(this.productBrandId()) : undefined,
              page: 0,
              size: 20,
            })
            .pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((page) => {
        this.productsLoading.set(false);
        this.products.set(page?.content ?? []);
      });

    effect(() => {
      this.productQuery();
      this.productBrandId();
      this.session.warehouseId();
      untracked(() => this.productSearchTrigger$.next());
    });
  }

  private loadCustomer(customerId: number) {
    this.customerLoading.set(true);
    this.customerError.set(false);
    this.customerSvc.detail(customerId).subscribe({
      next: (detail) => {
        this.customer.set(detail);
        this.customerLoading.set(false);
        this.loadCustomerExtras(customerId);
      },
      error: () => {
        this.customerLoading.set(false);
        this.customerError.set(true);
      },
    });
  }

  private loadCustomerExtras(customerId: number) {
    this.suggestedLoading.set(true);
    this.api.suggested(customerId).subscribe({
      next: (list) => {
        this.suggested.set(list);
        this.suggestedLoading.set(false);
      },
      error: () => this.suggestedLoading.set(false),
    });
    this.loadPromoCatalog(customerId, true);
    this.allocationSvc.mine().subscribe({
      next: (list) => this.allocations.set(list),
      error: () => this.allocations.set([]),
    });
  }

  /** `featuredOnly` por defecto `true` (doc 49, sección 10.1); si no hay destacadas, abre en Todas. */
  private loadPromoCatalog(customerId: number, featuredOnly: boolean) {
    this.promoCatalogFeaturedOnly = featuredOnly;
    this.promoCatalogLoading.set(true);
    this.promoCatalogError.set(false);
    this.api.availablePromos(customerId, featuredOnly).subscribe({
      next: (catalog) => {
        this.promoCatalogLoading.set(false);
        if (featuredOnly && catalog.featuredCount === 0) {
          this.loadPromoCatalog(customerId, false);
          return;
        }
        this.promoCatalog.set(catalog);
      },
      error: () => {
        this.promoCatalogLoading.set(false);
        this.promoCatalogError.set(true);
      },
    });
  }

  protected onCatalogFeaturedOnlyChange(featuredOnly: boolean) {
    const customerId = this.customer()?.customerId;
    if (customerId != null) this.loadPromoCatalog(customerId, featuredOnly);
  }

  protected retryPromoCatalog() {
    const customerId = this.customer()?.customerId;
    if (customerId != null) this.loadPromoCatalog(customerId, this.promoCatalogFeaturedOnly);
  }

  protected pickCustomer(c: CustomerSummary) {
    this.loadCustomer(c.customerId);
  }

  protected changeCustomer() {
    this.customer.set(null);
    this.assignmentId.set(null);
    this.lines.set([]);
    this.customerSearch.set('');
  }

  protected hasLine(productId: number): boolean {
    return this.lines().some((l) => l.productId === productId);
  }

  protected addProduct(p: ProductView) {
    if (this.hasLine(p.productId)) {
      this.lines.update((list) =>
        list.map((l) => (l.productId === p.productId ? { ...l, quantity: l.quantity + 1 } : l)),
      );
      return;
    }
    this.lines.update((list) => [
      ...list,
      { productId: p.productId, productName: p.name, quantity: 1, source: 'catalog' },
    ]);
  }

  protected addSuggested(item: SuggestedItem) {
    if (this.hasLine(item.productId)) return;
    const quantity = toWholeQuantity(item.avgQuantity, 1) ?? 1;
    this.lines.update((list) => [
      ...list,
      { productId: item.productId, productName: item.productName, quantity, source: 'suggested' },
    ]);
  }

  protected updateQuantity(line: CartLine, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const raw = inputNumber(input);
    const value = toWholeQuantity(raw, 1);
    if (value == null) {
      input.value = String(line.quantity);
      return;
    }
    if (!isWholeQuantity(raw)) {
      this.toast.info(`Las cantidades van en unidades enteras: se dejó ${value}.`);
    }
    input.value = String(value);
    this.lines.update((list) =>
      list.map((l) => (l.productId === line.productId ? { ...l, quantity: value } : l)),
    );
  }

  protected removeLine(line: CartLine) {
    this.lines.update((list) => list.filter((l) => l.productId !== line.productId));
  }

  /** `promoId-tier-benefitGroup` — la llave que se envía en `PromoChoiceCommand`. */
  protected choiceKey(c: MobileChoiceView): string {
    return `${c.promoId}-${c.tier}-${c.benefitGroup}`;
  }

  protected isChoiceOptionSelected(c: MobileChoiceView, opt: MobileChoiceOptionView): boolean {
    return (this.draftChoiceSelections().get(this.choiceKey(c)) ?? []).includes(opt.benefitLine);
  }

  protected isChoiceMulti(c: MobileChoiceView): boolean {
    return (c.chooseCount ?? 1) > 1;
  }

  protected draftChoiceSelectionsFor(c: MobileChoiceView): number[] {
    return this.draftChoiceSelections().get(this.choiceKey(c)) ?? [];
  }

  /** "Dejar para supervisión" = sin selección: el premio queda pendiente (doc 47, sección 13.1). */
  protected selectChoiceNone(c: MobileChoiceView) {
    this.draftChoiceSelections.update((map) => {
      const next = new Map(map);
      next.delete(this.choiceKey(c));
      return next;
    });
  }

  protected toggleChoiceOption(c: MobileChoiceView, opt: MobileChoiceOptionView) {
    const key = this.choiceKey(c);
    this.draftChoiceSelections.update((map) => {
      const next = new Map(map);
      if (!this.isChoiceMulti(c)) {
        next.set(key, [opt.benefitLine]);
        return next;
      }
      const current = next.get(key) ?? [];
      next.set(
        key,
        current.includes(opt.benefitLine)
          ? current.filter((l) => l !== opt.benefitLine)
          : [...current, opt.benefitLine],
      );
      return next;
    });
  }

  /** Si el carrito deja de ganar un premio, su elección se descarta (doc 47, sección 13.1). */
  private pruneStaleChoiceSelections(choices: MobileChoiceView[]) {
    const validKeys = new Set(choices.map((c) => this.choiceKey(c)));
    this.draftChoiceSelections.update((map) => {
      const next = new Map<string, number[]>();
      for (const [key, value] of map) if (validKeys.has(key)) next.set(key, value);
      return next;
    });
  }

  private buildPromoChoices(): PromoChoiceCommand[] {
    const selections = this.draftChoiceSelections();
    const result: PromoChoiceCommand[] = [];
    for (const c of this.draftChoices()) {
      const benefitLines = selections.get(this.choiceKey(c)) ?? [];
      if (benefitLines.length === (c.chooseCount ?? 1)) {
        result.push({
          promoId: c.promoId,
          tier: c.tier,
          benefitGroup: c.benefitGroup,
          benefitLines,
        });
      }
    }
    return result;
  }

  protected allocationQuantity(row: AllocationRow): number {
    return this.allocationQuantities().get(row.allocationId) ?? 0;
  }

  protected setAllocationQuantity(row: AllocationRow, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const raw = inputNumber(input);
    const value = toWholeQuantity(raw, 0, row.available) ?? this.allocationQuantity(row);
    if (Number.isFinite(raw) && !isWholeQuantity(raw)) {
      this.toast.info(`Las cantidades van en unidades enteras: se dejó ${value}.`);
    }
    input.value = String(value);
    this.allocationQuantities.update((cur) => {
      const next = new Map(cur);
      next.set(row.allocationId, value);
      return next;
    });
  }

  protected submit() {
    const customer = this.customer();
    const assignmentId = this.assignmentId();
    const paymentConditionId = Number(this.paymentConditionId());
    if (!customer || !assignmentId || !paymentConditionId || this.lines().length === 0) return;

    const allocationItems = Array.from(this.allocationQuantities().entries())
      .filter(([, qty]) => qty > 0)
      .map(([allocationId, quantity]) => ({ allocationId, quantity }));

    const promoChoices = this.buildPromoChoices();

    this.submitting.set(true);
    this.api
      .createOrder({
        assignmentId,
        paymentConditionId,
        note: this.note().trim() || undefined,
        idempotencyKey: this.idempotencyKey(),
        catalogItems: this.lines()
          .filter((l) => l.source === 'catalog')
          .map((l) => ({ productId: l.productId, quantity: l.quantity })),
        predictedItems: this.lines()
          .filter((l) => l.source === 'suggested')
          .map((l) => ({ productId: l.productId, quantity: l.quantity })),
        allocationItems,
        remote: true,
        ...(promoChoices.length > 0 ? { promoChoices } : {}),
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          if (result.duplicate) {
            this.router.navigate(['/pedidos/detalle', result.orderId]);
            return;
          }
          if (result.pendingChoiceCount > 0) {
            this.toast.success('Pedido registrado; falta elegir el premio de una promoción.');
          } else if (result.pendingBonusLines > 0) {
            this.toast.success(
              `Pedido registrado, pero ${result.pendingBonusLines} bonificación(es) quedaron sin stock.`,
            );
          } else {
            this.toast.success('Pedido registrado.');
          }
          this.idempotencyKey.set(newIdempotencyKey());
          this.store.markCalled(customer.customerId);
          this.store.refreshAfterAction();
          this.router.navigate(['/pedidos/detalle', result.orderId]);
        },
        error: (err) => {
          this.submitting.set(false);
          const detalle = err?.error?.detail ?? err?.error?.message;
          this.toast.error(detalle || 'No pudimos registrar el pedido.');
        },
      });
  }

  protected cancel() {
    this.router.navigate(['/televentas']);
  }
}
